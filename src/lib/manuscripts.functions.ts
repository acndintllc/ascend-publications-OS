/* Manuscript submission + versioning server functions.
   Lightweight per-user track separate from the full package wizard.
   Each manuscript record persists forever; resubmits append a new version. */
import { createServerFn } from "@tanstack/react-start";
import { requireUser, requireOwner } from "@/integrations/supabase/role-middleware";
import { z } from "zod";

const BUCKET = "publication-manuscripts";

const submitSchema = z.object({
  title: z.string().min(1).max(200),
  filename: z.string().min(1).max(200),
  format: z.enum(["md", "docx", "pdf"]),
  contentBase64: z.string().min(1),
});

const resubmitSchema = z.object({
  manuscriptId: z.string().uuid(),
  filename: z.string().min(1).max(200),
  format: z.enum(["md", "docx", "pdf"]),
  contentBase64: z.string().min(1),
});

export interface ManuscriptReport {
  issues: Array<{ severity: string; code: string; message: string }>;
  unresolvedCitations: string[];
  orphanVeraAnchors: number[];
  rhythm: Array<{
    index: number; title: string; words: number; paragraphs: number;
    sections: number; pullquotes: number; dialogue: number;
  }>;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function runValidation(
  format: "md" | "docx" | "pdf",
  bytes: Uint8Array,
): Promise<{ report: ManuscriptReport; status: "report_ready" }> {
  if (format === "pdf") {
    return {
      report: {
        issues: [{ severity: "info", code: "PDF000", message: "PDF accepted without structural validation." }],
        unresolvedCitations: [],
        orphanVeraAnchors: [],
        rhythm: [],
      },
      status: "report_ready",
    };
  }
  try {
    const pipeline = await import("@/manuscript/pipeline");
    const result =
      format === "docx"
        ? pipeline.ingestDocx(bytes)
        : pipeline.ingestMarkdown(new TextDecoder().decode(bytes));
    return { report: result.report as ManuscriptReport, status: "report_ready" };
  } catch (e) {
    return {
      report: {
        issues: [{
          severity: "error", code: "PARSE000",
          message: `Failed to parse manuscript: ${e instanceof Error ? e.message : String(e)}`,
        }],
        unresolvedCitations: [],
        orphanVeraAnchors: [],
        rhythm: [],
      },
      status: "report_ready",
    };
  }
}

export const submitManuscript = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ownerId = context.userId;
    const now = new Date().toISOString();

    // 1. Create parent manuscript row.
    const { data: parent, error: pErr } = await supabaseAdmin
      .from("publication_manuscripts")
      .insert({
        owner_id: ownerId,
        title: data.title,
        current_version: 1,
        status: "validation_running",
        last_activity_at: now,
      } as never)
      .select("*")
      .single();
    if (pErr) throw new Error(pErr.message);
    const manuscriptId = (parent as { id: string }).id;

    // 2. Upload to storage.
    const bytes = b64ToBytes(data.contentBase64);
    const safe = data.filename.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
    const path = `${ownerId}/${manuscriptId}/v1/${safe}`;
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { upsert: false });
    if (up.error) throw new Error(`upload failed: ${up.error.message}`);

    // 3. Run validation.
    const { report, status } = await runValidation(data.format, bytes);

    // 4. Persist version row + flip parent status.
    const { error: vErr } = await supabaseAdmin
      .from("publication_manuscript_versions")
      .insert({
        manuscript_id: manuscriptId,
        owner_id: ownerId,
        version: 1,
        storage_path: path,
        filename: data.filename,
        format: data.format,
        report: report as never,
        status,
      } as never);
    if (vErr) throw new Error(vErr.message);

    await supabaseAdmin
      .from("publication_manuscripts")
      .update({ status, last_activity_at: new Date().toISOString() } as never)
      .eq("id", manuscriptId);

    return { manuscriptId, version: 1, report, status };
  });

export const resubmitManuscript = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => resubmitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ownerId = context.userId;

    const { data: parent, error: pErr } = await supabaseAdmin
      .from("publication_manuscripts")
      .select("*")
      .eq("id", data.manuscriptId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!parent) throw new Error("Manuscript not found");
    const p = parent as { id: string; owner_id: string; current_version: number };
    if (!context.isOwner && p.owner_id !== ownerId) {
      throw new Error("Forbidden");
    }

    const nextVersion = p.current_version + 1;

    // Flip to validation_running before work begins.
    await supabaseAdmin
      .from("publication_manuscripts")
      .update({
        status: "revision_submitted",
        last_activity_at: new Date().toISOString(),
      } as never)
      .eq("id", p.id);

    const bytes = b64ToBytes(data.contentBase64);
    const safe = data.filename.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
    const path = `${p.owner_id}/${p.id}/v${nextVersion}/${safe}`;
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { upsert: false });
    if (up.error) throw new Error(`upload failed: ${up.error.message}`);

    const { report, status } = await runValidation(data.format, bytes);

    const { error: vErr } = await supabaseAdmin
      .from("publication_manuscript_versions")
      .insert({
        manuscript_id: p.id,
        owner_id: p.owner_id,
        version: nextVersion,
        storage_path: path,
        filename: data.filename,
        format: data.format,
        report: report as never,
        status,
      } as never);
    if (vErr) throw new Error(vErr.message);

    await supabaseAdmin
      .from("publication_manuscripts")
      .update({
        status,
        current_version: nextVersion,
        last_activity_at: new Date().toISOString(),
      } as never)
      .eq("id", p.id);

    return { manuscriptId: p.id, version: nextVersion, report, status };
  });

export const listMyManuscripts = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("publication_manuscripts")
      .select("*")
      .eq("owner_id", context.userId)
      .order("last_activity_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      title: string;
      current_version: number;
      status: string;
      created_at: string;
      last_activity_at: string;
    }>;
  });

export const getManuscriptDetail = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator((d: { manuscriptId: string }) =>
    z.object({ manuscriptId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: parent, error: pErr } = await supabaseAdmin
      .from("publication_manuscripts")
      .select("*")
      .eq("id", data.manuscriptId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!parent) throw new Error("Manuscript not found");
    const p = parent as { id: string; owner_id: string };
    if (!context.isOwner && p.owner_id !== context.userId) {
      throw new Error("Forbidden");
    }
    const { data: versions, error: vErr } = await supabaseAdmin
      .from("publication_manuscript_versions")
      .select("*")
      .eq("manuscript_id", data.manuscriptId)
      .order("version", { ascending: false });
    if (vErr) throw new Error(vErr.message);
    return { manuscript: parent, versions: versions ?? [] };
  });

export const listAllManuscripts = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("publication_manuscripts")
      .select("*")
      .order("last_activity_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      id: string;
      owner_id: string;
      title: string;
      current_version: number;
      status: string;
      created_at: string;
      last_activity_at: string;
    }>;

    // Resolve emails via admin auth API.
    const owners = Array.from(new Set(rows.map((r) => r.owner_id)));
    const emailMap = new Map<string, string>();
    await Promise.all(
      owners.map(async (uid) => {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (u?.user?.email) emailMap.set(uid, u.user.email);
        } catch {
          /* ignore */
        }
      }),
    );

    const STALE_DAYS = 14;
    const cutoff = Date.now() - STALE_DAYS * 86400_000;
    return rows.map((r) => ({
      ...r,
      email: emailMap.get(r.owner_id) ?? null,
      stale:
        r.status === "report_ready" &&
        new Date(r.last_activity_at).getTime() < cutoff,
    }));
  });
