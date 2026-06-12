/* PTL-025 Phase 14A — External runner callback.
   The external PDF / KFX runner POSTs the final artifact metadata here.
   Authenticated via HMAC-SHA256 over the raw body using ASCEND_RUNNER_SECRET.
   On success, registers a new artifact row (versioned, supersedes prior
   active) and updates the originating distribution queue entry. */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
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
  validation: z.record(z.unknown()).optional(),
  runner_id: z.string().optional(),
});

function verify(sig: string | null, body: string): boolean {
  const secret = process.env.ASCEND_RUNNER_SECRET;
  if (!secret || !sig) return false;
  const expected = createHmac("sha256", secret).update(Buffer.from(body, "utf8")).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
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
        if (!verify(request.headers.get("x-ascend-signature"), body)) {
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let su: any = supabaseAdmin.from("publication_artifacts" as never)
          .update({
            is_active: false, status: "superseded",
            superseded_at: new Date().toISOString(),
          } as never)
          .eq("slug", parsed.slug).eq("kind", parsed.kind).eq("is_active", true);
        su = parsed.target == null ? su.is("target", null) : su.eq("target", parsed.target);
        await su;

        const insertRow = {
          slug: parsed.slug, kind: parsed.kind, target: parsed.target ?? null,
          version: nextVersion, is_active: true,
          storage_bucket: "publication-assets",
          storage_path: parsed.storage_path,
          filename: parsed.filename,
          byte_size: parsed.byte_size,
          media_type: parsed.media_type,
          status: "generated",
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
          event_type: "export.requested",
          payload: {
            runner_callback: true,
            kind: parsed.kind, target: parsed.target ?? null,
            storage_path: parsed.storage_path, version: nextVersion,
            source_queue_id: parsed.source_queue_id ?? null,
          } as never,
          actor: "external-runner",
        } as never);

        // Sign URL (7d) for queue artifact_url update
        const { data: signed } = await supabaseAdmin.storage
          .from("publication-assets")
          .createSignedUrl(parsed.storage_path, 60 * 60 * 24 * 7);

        if (parsed.source_queue_id && signed?.signedUrl) {
          await supabaseAdmin.from("publication_distribution_queue" as never)
            .update({ artifact_url: signed.signedUrl, updated_at: new Date().toISOString() } as never)
            .eq("id", parsed.source_queue_id);
        }

        return new Response(JSON.stringify({
          ok: true,
          artifact_id: (artifact as { id: string }).id,
          signed_url: signed?.signedUrl ?? null,
        }), { headers: { "content-type": "application/json" } });
      },
    },
  },
});
