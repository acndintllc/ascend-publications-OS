/* PTL-025 Phase 14A — External runner callback.
   The external PDF / KFX runner POSTs the final artifact metadata here.
   Authenticated via HMAC-SHA256 over the raw body using ASCEND_RUNNER_SECRET.
   On success, registers a new artifact row (versioned, supersedes prior
   active) and updates the originating distribution queue entry. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const callbackSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(["pdf", "kindle"]),
  target: z.string().nullable().optional(),
  filename: z.string().min(1),
  storage_path: z.string().min(1),
  byte_size: z.number().int().nonnegative(),
  media_type: z.string().min(1),
  source_queue_id: z.string().uuid().nullable().optional(),
  validation: z.record(z.string(), z.any()).optional(),
  runner_id: z.string().optional(),
  status: z.enum(["generated", "failed"]).optional(),
});

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verify(sig: string | null, body: string): Promise<boolean> {
  const secret = process.env.ASCEND_RUNNER_SECRET;
  if (!secret || !sig) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = toHex(mac);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/render/callback")({
  server: {
    handlers: {
      GET: () => new Response(JSON.stringify({
        ok: true, contract: "POST signed body to register a runner artifact.",
        headers: ["x-ascend-signature: HMAC-SHA256(body, ASCEND_RUNNER_SECRET)"],
      }, null, 2), { headers: { "content-type": "application/json" } }),
      POST: async ({ request }) => {
        const body = await request.text();
        if (!(await verify(request.headers.get("x-ascend-signature"), body))) {
          return new Response(JSON.stringify({ ok: false, error: "Invalid signature" }),
            { status: 401, headers: { "content-type": "application/json" } });
        }
        let parsed;
        try { parsed = callbackSchema.parse(JSON.parse(body)); }
        catch (e) {
          return new Response(JSON.stringify({ ok: false, error: String(e) }),
            { status: 400, headers: { "content-type": "application/json" } });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Compute next version + supersede prior active.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabaseAdmin.from("publication_artifacts" as never)
          .select("version").eq("slug", parsed.slug).eq("kind", parsed.kind);
        q = parsed.target == null ? q.is("target", null) : q.eq("target", parsed.target);
        const { data: vrows } = await q.order("version", { ascending: false }).limit(1);
        const nextVersion = ((vrows?.[0] as { version: number } | undefined)?.version ?? 0) + 1;

        const reportedStatus = parsed.status ?? "generated";
        const failed = reportedStatus === "failed";

        // Only supersede prior active when this is a success row.
        if (!failed) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let su: any = supabaseAdmin.from("publication_artifacts" as never)
            .update({
              is_active: false, status: "superseded",
              superseded_at: new Date().toISOString(),
            } as never)
            .eq("slug", parsed.slug).eq("kind", parsed.kind).eq("is_active", true);
          su = parsed.target == null ? su.is("target", null) : su.eq("target", parsed.target);
          await su;
        }

        const insertRow = {
          slug: parsed.slug, kind: parsed.kind, target: parsed.target ?? null,
          version: nextVersion, is_active: !failed,
          storage_bucket: "publication-assets",
          storage_path: parsed.storage_path,
          filename: parsed.filename,
          byte_size: parsed.byte_size,
          media_type: parsed.media_type,
          status: reportedStatus,
          validation: parsed.validation ?? {},
          source_queue_id: parsed.source_queue_id ?? null,
          generated_by: parsed.runner_id ?? "external-runner",
        };
        const { data: artifact, error } = await supabaseAdmin
          .from("publication_artifacts" as never)
          .insert(insertRow as never).select("*").single();
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { "content-type": "application/json" } });
        }

        // Record event
        await supabaseAdmin.from("publication_events" as never).insert({
          slug: parsed.slug,
          event_type: failed ? "auto_prepare_failed" : "export.requested",
          payload: {
            runner_callback: true,
            kind: parsed.kind, target: parsed.target ?? null,
            storage_path: parsed.storage_path, version: nextVersion,
            source_queue_id: parsed.source_queue_id ?? null,
            status: reportedStatus,
          } as never,
          actor: parsed.runner_id ?? "external-runner",
        } as never);

        // Sign URL (7d) for queue artifact_url update — only on success.
        let signedUrl: string | null = null;
        if (!failed) {
          const { data: signed } = await supabaseAdmin.storage
            .from("publication-assets")
            .createSignedUrl(parsed.storage_path, 60 * 60 * 24 * 7);
          signedUrl = signed?.signedUrl ?? null;
          if (parsed.source_queue_id && signedUrl) {
            await supabaseAdmin.from("publication_distribution_queue" as never)
              .update({ artifact_url: signedUrl, updated_at: new Date().toISOString() } as never)
              .eq("id", parsed.source_queue_id);
          }
        }


        return new Response(JSON.stringify({
          ok: true,
          artifact_id: (artifact as { id: string }).id,
          signed_url: signedUrl,
          status: reportedStatus,
        }), { headers: { "content-type": "application/json" } });
      },
    },
  },
});
