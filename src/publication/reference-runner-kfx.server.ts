/* PTL-027 Phase 16A — Reference external KFX runner (in-Worker).
   Mirrors reference-runner.server.ts shape for PDF. Real KFX requires
   Amazon's native KindleGen/KPR binaries (per PTL-016 / PTL-026), so this
   in-Worker runner emits a KFX-shaped wrapper around the active Kindle
   EPUB-format artifact and registers it through the same signed callback
   contract used by the external runner. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "publication-assets";

export type KfxRunnerMode = "ok" | "invalid_signature" | "missing_artifact" | "failed_generation";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface KfxRunnerResult {
  ok: boolean;
  mode: KfxRunnerMode;
  callback_status: number;
  callback_body: Json;
  artifact_path?: string;
  signed_url?: string | null;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
}

/** KFX-style container: 8-byte magic + length-prefixed EPUB payload.
    Not a real KFX file (which needs Amazon's proprietary toolchain) but
    a deterministic, runner-produced wrapper distinguishable from EPUB. */
function wrapAsKfxContainer(epub: Uint8Array, slug: string): Uint8Array {
  const enc = new TextEncoder();
  const magic = enc.encode("KFXSTUB\0");
  const meta = enc.encode(JSON.stringify({
    runner: "reference-kfx-runner-in-worker",
    slug,
    payload: "epub",
    note: "Replace with native KindleGen/KPR output for real distribution.",
    ts: new Date().toISOString(),
  }));
  const metaLenBuf = new Uint8Array(4);
  new DataView(metaLenBuf.buffer).setUint32(0, meta.length, false);
  const payloadLenBuf = new Uint8Array(4);
  new DataView(payloadLenBuf.buffer).setUint32(0, epub.length, false);
  const total = magic.length + 4 + meta.length + 4 + epub.length;
  const out = new Uint8Array(total);
  let o = 0;
  out.set(magic, o); o += magic.length;
  out.set(metaLenBuf, o); o += 4;
  out.set(meta, o); o += meta.length;
  out.set(payloadLenBuf, o); o += 4;
  out.set(epub, o);
  return out;
}

async function loadActiveKindleSource(slug: string): Promise<{
  storage_path: string; bytes: Uint8Array;
} | null> {
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

export interface KfxRunInput {
  slug: string;
  origin: string;
  sourceQueueId?: string | null;
  mode?: KfxRunnerMode;
  actor?: string;
}

export async function runReferenceKfx(input: KfxRunInput): Promise<KfxRunnerResult> {
  const mode: KfxRunnerMode = input.mode ?? "ok";
  const secret = process.env.ASCEND_RUNNER_SECRET;
  if (!secret) throw new Error("ASCEND_RUNNER_SECRET not configured");

  let storagePath: string | null = null;
  let byteSize = 0;

  if (mode === "missing_artifact") {
    storagePath = `${input.slug}/_runner/kfx/missing-${Date.now()}.kfx`;
  } else if (mode === "failed_generation") {
    storagePath = `${input.slug}/_runner/kfx/failed-${Date.now()}.kfx`;
  } else {
    const src = await loadActiveKindleSource(input.slug);
    if (!src) throw new Error(`no active kindle artifact for slug=${input.slug}`);
    const kfx = wrapAsKfxContainer(src.bytes, input.slug);
    storagePath = `${input.slug}/_runner/kfx/${Date.now()}-${input.slug}.kfx`;
    const ab = new ArrayBuffer(kfx.byteLength);
    new Uint8Array(ab).set(kfx);
    const up = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, ab, {
      contentType: "application/vnd.amazon.ebook", upsert: true,
    });
    if (up.error) throw new Error(`upload: ${up.error.message}`);
    byteSize = kfx.byteLength;
  }

  const payload = {
    slug: input.slug,
    kind: "kindle" as const,
    target: "kdp" as string | null,
    filename: `${input.slug}.kfx`,
    storage_path: storagePath!,
    byte_size: byteSize,
    media_type: "application/vnd.amazon.ebook",
    source_queue_id: input.sourceQueueId ?? null,
    runner_id: input.actor ?? "reference-kfx-runner-in-worker",
    validation: {
      runner: "reference-kfx-runner-in-worker",
      mode,
      kfx_stub: true,
      ts: new Date().toISOString(),
    },
    ...(mode === "failed_generation" ? { status: "failed" as const } : {}),
  };
  const body = JSON.stringify(payload);
  const realSig = await sign(body, secret);
  const signature = mode === "invalid_signature" ? "0".repeat(realSig.length) : realSig;

  const url = `${input.origin.replace(/\/+$/, "")}/api/public/render/callback`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ascend-signature": signature },
    body,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }

  let signedUrl: string | null = null;
  if (res.ok && mode === "ok" && storagePath) {
    const { data } = await supabaseAdmin.storage.from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    signedUrl = data?.signedUrl ?? null;
  }
  return {
    ok: res.ok, mode,
    callback_status: res.status,
    callback_body: parsed as Json,
    artifact_path: storagePath ?? undefined,
    signed_url: signedUrl,
  };
}
