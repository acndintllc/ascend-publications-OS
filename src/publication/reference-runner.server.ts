/* PTL-026 Phase 15A — Reference external PDF runner (in-Worker).
   Pure-JS, Worker-safe. Demonstrates the full external-runner round-trip:
     1. Reads the active `pdf-source` artifact for a slug.
     2. Downloads its HTML bytes from the publication-assets bucket.
     3. Renders a minimal valid single-page PDF (hand-rolled, Helvetica
        from PDF base-14 — no font embedding, no native deps).
     4. Uploads the PDF to the bucket under <slug>/_runner/pdf/.
     5. HMAC-signs a callback payload with ASCEND_RUNNER_SECRET.
     6. POSTs to /api/public/render/callback over HTTP, exercising the
        real signature-verification + artifact-registration path.

   Failure simulation is also supported for Phase 15C validation. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "publication-assets";

export type RunnerMode = "ok" | "invalid_signature" | "missing_artifact" | "failed_generation";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface RunnerResult {
  ok: boolean;
  mode: RunnerMode;
  callback_status: number;
  callback_body: Json;
  artifact_path?: string;
  signed_url?: string | null;
}

/* ─── Tiny PDF builder ────────────────────────────────────────────────── */

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLines(text: string, width = 90): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    if (!para.trim()) { out.push(""); continue; }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > width) {
        out.push(line); line = w;
      } else {
        line = line ? line + " " + w : w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function stripHtml(html: string): string {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
  return body
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Build a minimal multi-page PDF (Helvetica) from arbitrary text. */
function buildPdf(title: string, body: string): Uint8Array {
  const linesPerPage = 48;
  const all = [
    `ASCEND · ${title}`,
    "",
    "(Reference PDF — produced by the in-Worker reference runner.)",
    "",
    ...wrapLines(body, 90),
  ];
  const pages: string[][] = [];
  for (let i = 0; i < all.length; i += linesPerPage) pages.push(all.slice(i, i + linesPerPage));
  if (pages.length === 0) pages.push(["(empty manuscript)"]);

  // Object layout: 1 Catalog, 2 Pages, then per page: Page + Contents.
  // Font is the last object.
  const pageObjStart = 3;
  const fontObjNum = pageObjStart + pages.length * 2;
  const kids: string[] = [];
  for (let i = 0; i < pages.length; i++) kids.push(`${pageObjStart + i * 2} 0 R`);

  const objects: string[] = [];
  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(`<< /Type /Pages /Kids [ ${kids.join(" ")} ] /Count ${pages.length} >>`);

  pages.forEach((lines, idx) => {
    const contentsNum = pageObjStart + idx * 2 + 1;
    const pageNum = pageObjStart + idx * 2;
    objects[pageNum - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentsNum} 0 R >>`;
    let stream = "BT /F1 11 Tf 14 TL 54 740 Td\n";
    lines.forEach((ln, i) => {
      const safe = escapePdfString(ln || " ");
      stream += i === 0 ? `(${safe}) Tj\n` : `T* (${safe}) Tj\n`;
    });
    stream += "ET";
    objects[contentsNum - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontObjNum - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;

  // Assemble
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  const encoder = new TextEncoder();
  // Use byte length tracking via a binary buffer
  const chunks: Uint8Array[] = [encoder.encode(pdf)];
  let pos = chunks[0].length;
  objects.forEach((body, i) => {
    offsets[i] = pos;
    const objStr = `${i + 1} 0 obj\n${body}\nendobj\n`;
    const enc = encoder.encode(objStr);
    chunks.push(enc); pos += enc.length;
  });
  const xrefStart = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { xref += String(o).padStart(10, "0") + " 00000 n \n"; });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(encoder.encode(xref));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/* ─── HMAC helpers (Web Crypto, Worker-safe) ──────────────────────────── */

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
}

/* ─── Runner ──────────────────────────────────────────────────────────── */

async function loadActivePdfSource(slug: string): Promise<{
  storage_path: string; bytes: Uint8Array;
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin.from("publication_artifacts" as never) as any)
    .select("*").eq("slug", slug).eq("kind", "pdf-source").eq("is_active", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const dl = await supabaseAdmin.storage.from(BUCKET).download(data.storage_path);
  if (dl.error || !dl.data) throw new Error(`download pdf-source: ${dl.error?.message ?? "no data"}`);
  const buf = new Uint8Array(await dl.data.arrayBuffer());
  return { storage_path: data.storage_path, bytes: buf };
}

export interface RunReferenceInput {
  slug: string;
  origin: string;                    // e.g. https://x.lovable.app
  sourceQueueId?: string | null;
  mode?: RunnerMode;                 // default "ok"
  actor?: string;
}

export async function runReferencePdf(input: RunReferenceInput): Promise<RunnerResult> {
  const mode: RunnerMode = input.mode ?? "ok";
  const secret = process.env.ASCEND_RUNNER_SECRET;
  if (!secret) throw new Error("ASCEND_RUNNER_SECRET not configured");

  // 15C — missing artifact path: skip loading, post a callback that points
  // at a nonexistent storage path; the callback still registers, but the
  // path will fail to sign later — useful to demonstrate handling.
  let storagePath: string | null = null;
  let byteSize = 0;

  if (mode === "missing_artifact") {
    storagePath = `${input.slug}/_runner/pdf/missing-${Date.now()}.pdf`;
    byteSize = 0;
  } else if (mode === "failed_generation") {
    // Don't upload; post a "failed" callback the registry can record.
    storagePath = `${input.slug}/_runner/pdf/failed-${Date.now()}.pdf`;
    byteSize = 0;
  } else {
    const src = await loadActivePdfSource(input.slug);
    if (!src) throw new Error(`no active pdf-source artifact for slug=${input.slug}`);
    const html = new TextDecoder().decode(src.bytes);
    const pdf = buildPdf(input.slug, stripHtml(html));
    storagePath = `${input.slug}/_runner/pdf/${Date.now()}-${input.slug}.pdf`;
    const ab = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(ab).set(pdf);
    const up = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, ab, {
      contentType: "application/pdf", upsert: true,
    });
    if (up.error) throw new Error(`upload: ${up.error.message}`);
    byteSize = pdf.byteLength;
  }

  const payload = {
    slug: input.slug,
    kind: "pdf" as const,
    target: null as string | null,
    filename: `${input.slug}.pdf`,
    storage_path: storagePath!,
    byte_size: byteSize,
    media_type: "application/pdf",
    source_queue_id: input.sourceQueueId ?? null,
    runner_id: input.actor ?? "reference-runner-in-worker",
    validation: {
      runner: "reference-runner-in-worker",
      mode,
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
  try { parsed = JSON.parse(text); } catch { /* keep as text */ }

  // Sign URL if generation succeeded.
  let signedUrl: string | null = null;
  if (res.ok && mode === "ok" && storagePath) {
    const { data } = await supabaseAdmin.storage.from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    signedUrl = data?.signedUrl ?? null;
  }

  return {
    ok: res.ok,
    mode,
    callback_status: res.status,
    callback_body: parsed,
    artifact_path: storagePath ?? undefined,
    signed_url: signedUrl,
  };
}
