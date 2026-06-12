/* PTL-028 Phase 17A — External KindleGen / KPR runner.
   Loads the active Kindle EPUB artifact, POSTs it to an external conversion
   endpoint (ASCEND_KINDLEGEN_URL) authenticated by an Authorization header
   bearer of ASCEND_KINDLEGEN_TOKEN (falls back to ASCEND_RUNNER_SECRET).
   The remote service is expected to return the converted KFX/KPF bytes.
   We then register the result through the SAME signed callback used by all
   runners — preserving versioning, audit, and registry behavior. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { StandardRunnerResult } from "./runner-provider";

const BUCKET = "publication-assets";
const PROVIDER_ID = "external-kindlegen";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
}

async function loadActiveKindle(slug: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin.from("publication_artifacts" as never) as any)
    .select("*").eq("slug", slug).eq("kind", "kindle").eq("is_active", true)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const dl = await supabaseAdmin.storage.from(BUCKET).download(data.storage_path);
  if (dl.error || !dl.data) throw new Error(`download kindle source: ${dl.error?.message ?? "no data"}`);
  return { storage_path: data.storage_path, bytes: new Uint8Array(await dl.data.arrayBuffer()) };
}

export interface ExternalKindlegenInput {
  slug: string;
  origin: string;
  sourceQueueId?: string | null;
  actor?: string;
  /** ms before we give up on the external runner */
  timeoutMs?: number;
}

export async function runExternalKindlegen(input: ExternalKindlegenInput): Promise<StandardRunnerResult> {
  const warnings: string[] = [];
  const callbackSecret = process.env.ASCEND_RUNNER_SECRET;
  const endpoint = process.env.ASCEND_KINDLEGEN_URL;
  const token = process.env.ASCEND_KINDLEGEN_TOKEN ?? callbackSecret;

  if (!callbackSecret) {
    return {
      ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
      errors: ["ASCEND_RUNNER_SECRET not configured"],
      callback_status: null, failure: "provider_unavailable",
    };
  }
  if (!endpoint || !token) {
    return {
      ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
      errors: ["ASCEND_KINDLEGEN_URL not configured (fall back to reference KFX stub)"],
      callback_status: null, failure: "provider_unavailable",
    };
  }

  const src = await loadActiveKindle(input.slug);
  if (!src) {
    return {
      ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
      errors: [`No active kindle artifact for slug=${input.slug}`],
      callback_status: null, failure: "invalid_artifact",
    };
  }

  // POST the EPUB bytes to the remote converter and expect KFX/KPF bytes back.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 60_000);
  let kfxBytes: Uint8Array;
  try {
    const epubAb = new ArrayBuffer(src.bytes.byteLength);
    new Uint8Array(epubAb).set(src.bytes);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/epub+zip",
        "authorization": `Bearer ${token}`,
        "x-ascend-slug": input.slug,
        "x-ascend-format": "kfx",
      },
      body: epubAb,
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
        errors: [`External converter ${res.status}: ${txt.slice(0, 400)}`],
        callback_status: null, failure: "generation_failed",
      };
    }
    kfxBytes = new Uint8Array(await res.arrayBuffer());
    if (kfxBytes.byteLength < 16) {
      return {
        ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
        errors: ["External converter returned implausibly small payload"],
        callback_status: null, failure: "invalid_artifact",
      };
    }
  } catch (e) {
    const aborted = (e as { name?: string }).name === "AbortError";
    return {
      ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
      errors: [aborted ? "External converter timed out" : String(e)],
      callback_status: null, failure: aborted ? "timeout" : "generation_failed",
    };
  } finally {
    clearTimeout(timer);
  }

  // Upload converted bytes.
  const storagePath = `${input.slug}/_runner/kfx/${Date.now()}-${input.slug}.kfx`;
  const ab = new ArrayBuffer(kfxBytes.byteLength);
  new Uint8Array(ab).set(kfxBytes);
  const up = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, ab, {
    contentType: "application/vnd.amazon.ebook", upsert: true,
  });
  if (up.error) {
    return {
      ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
      errors: [`Upload failed: ${up.error.message}`],
      callback_status: null, failure: "callback_failure",
    };
  }

  // Signed callback registration.
  const payload = {
    slug: input.slug,
    kind: "kindle" as const,
    target: "kdp" as string | null,
    filename: `${input.slug}.kfx`,
    storage_path: storagePath,
    byte_size: kfxBytes.byteLength,
    media_type: "application/vnd.amazon.ebook",
    source_queue_id: input.sourceQueueId ?? null,
    runner_id: input.actor ?? PROVIDER_ID,
    validation: {
      runner: PROVIDER_ID,
      external_endpoint: endpoint,
      bytes: kfxBytes.byteLength,
      ts: new Date().toISOString(),
    },
  };
  const body = JSON.stringify(payload);
  const sig = await sign(body, callbackSecret);
  const url = `${input.origin.replace(/\/+$/, "")}/api/public/render/callback`;

  let cbStatus = 0;
  let parsedBody: unknown = null;
  try {
    const cb = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ascend-signature": sig },
      body,
    });
    cbStatus = cb.status;
    const t = await cb.text();
    try { parsedBody = JSON.parse(t) as unknown; } catch { parsedBody = t; }
    const safeBody = (typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody ?? null));
    if (!cb.ok) {
      return {
        ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
        errors: [`Callback ${cb.status}`],
        callback_status: cbStatus,
        failure: "callback_failure",
        validation: { callback_body: safeBody },
      };
    }
  } catch (e) {
    return {
      ok: false, provider: PROVIDER_ID, kind: "kindle", warnings,
      errors: [String(e)],
      callback_status: null, failure: "callback_failure",
    };
  }

  const { data: signed } = await supabaseAdmin.storage.from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  return {
    ok: true, provider: PROVIDER_ID, kind: "kindle", warnings,
    errors: [],
    callback_status: cbStatus,
    artifact_path: storagePath,
    signed_url: signed?.signedUrl ?? null,
    validation: { callback_body: parsedBody, bytes: kfxBytes.byteLength },
  };
}
