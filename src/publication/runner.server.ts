/* PTL-026 Phase 13A — External-runner integration (in-Worker fast path).
   Builds final EPUB / Kindle EPUB / PDF-source / publication-package /
   per-store-package artifacts from a slug, uploads bytes to the
   `publication-assets` Supabase Storage bucket, and registers them in
   `publication_artifacts`. Real native PDF / KFX compilation still
   happens off-Worker per the runner contract (PTL-016); this module
   provides the upstream artifacts the runner consumes. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ACADocument } from "@/manuscript/schema/aca";
import { buildEpub } from "@/manuscript/package/epub-zip";
import { renderChapterXHTML } from "@/manuscript/package/epub-xhtml";
import { manuscriptCSS } from "@/manuscript/package/epub-css";
import { buildPackage, buildStorePackage } from "./packager";
import { adaptForAllTargets, type DistributionTarget, type PublicationMetadata } from "./metadata";
import type { PublicationProfile } from "./profiles";
import type { AssetRecord } from "./assets";
import type { ReadinessReport } from "./readiness";

const BUCKET = "publication-assets";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

export type ArtifactKind = "epub" | "kindle" | "pdf-source" | "package" | "store-package";

export type ArtifactValidationValue =
  | string | number | boolean | null
  | ArtifactValidationValue[]
  | { [key: string]: ArtifactValidationValue };
export type ArtifactValidation = { [key: string]: ArtifactValidationValue };

export interface ArtifactRow {
  id: string;
  slug: string;
  kind: string;
  target: string | null;
  version: number;
  is_active: boolean;
  storage_bucket: string;
  storage_path: string;
  filename: string;
  byte_size: number;
  media_type: string;
  status: "pending" | "generated" | "validated" | "failed" | "superseded";
  validation: ArtifactValidation;
  source_queue_id: string | null;
  generated_by: string | null;
  generated_at: string;
  superseded_at: string | null;
}

export interface GenerateInputs {
  slug: string;
  doc: ACADocument;
  metadata: PublicationMetadata;
  profile: PublicationProfile;
  assets: AssetRecord[];
  readiness: ReadinessReport;
  /** Optional distribution targets to also produce per-store sub-packages. */
  storeTargets?: DistributionTarget[];
  sourceQueueId?: string | null;
  actor?: string;
}

export interface GenerateResult {
  artifacts: ArtifactRow[];
  packageUrl: string | null;
  signedUrls: Record<string, string>; // path -> signed URL
}

function printableHtml(doc: ACADocument): string {
  const xhtml = renderChapterXHTML(doc);
  const m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(xhtml);
  const body = m ? m[1] : xhtml;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${doc.frontmatter.title}</title><style>${manuscriptCSS()}
@page { size: 6in 9in; margin: 0.75in; }</style></head><body>${body}</body></html>`;
}

function safe(s: string) {
  return s.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
}

async function uploadBytes(path: string, bytes: Uint8Array, contentType: string) {
  // Copy underlying buffer to a plain ArrayBuffer (avoid SharedArrayBuffer mismatch).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, ab, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload (${path}): ${error.message}`);
}

async function signUrl(path: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

async function nextVersion(slug: string, kind: string, target: string | null): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabaseAdmin
    .from("publication_artifacts" as never)
    .select("version")
    .eq("slug", slug)
    .eq("kind", kind);
  q = target == null ? q.is("target", null) : q.eq("target", target);
  const { data, error } = await q.order("version", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { version: number }[];
  return (rows[0]?.version ?? 0) + 1;
}

async function supersedeActive(slug: string, kind: string, target: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabaseAdmin
    .from("publication_artifacts" as never)
    .update({ is_active: false, status: "superseded", superseded_at: new Date().toISOString() } as never)
    .eq("slug", slug)
    .eq("kind", kind)
    .eq("is_active", true);
  q = target == null ? q.is("target", null) : q.eq("target", target);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

async function insertArtifact(row: Omit<ArtifactRow, "id" | "generated_at" | "superseded_at" | "is_active"> & {
  is_active?: boolean;
}): Promise<ArtifactRow> {
  await supersedeActive(row.slug, row.kind, row.target);
  const insert = { ...row, is_active: true };
  const { data, error } = await supabaseAdmin
    .from("publication_artifacts" as never)
    .insert(insert as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ArtifactRow;
}

async function emitArtifact(input: {
  slug: string;
  kind: ArtifactKind;
  target: string | null;
  filename: string;
  bytes: Uint8Array;
  mediaType: string;
  validation: Record<string, unknown>;
  sourceQueueId?: string | null;
  actor?: string;
}): Promise<ArtifactRow> {
  const version = await nextVersion(input.slug, input.kind, input.target);
  const path = `${safe(input.slug)}/_artifacts/${input.kind}${input.target ? `-${safe(input.target)}` : ""}/v${version}-${input.filename}`;
  await uploadBytes(path, input.bytes, input.mediaType);
  return insertArtifact({
    slug: input.slug,
    kind: input.kind,
    target: input.target,
    version,
    storage_bucket: BUCKET,
    storage_path: path,
    filename: input.filename,
    byte_size: input.bytes.byteLength,
    media_type: input.mediaType,
    status: "generated",
    validation: input.validation,
    source_queue_id: input.sourceQueueId ?? null,
    generated_by: input.actor ?? "in-worker-runner",
  });
}

/** Build & register the full set of artifacts for a publication. */
export async function generateArtifacts(input: GenerateInputs): Promise<GenerateResult> {
  const { slug, doc, metadata, profile, assets, readiness } = input;
  const targets = profile.behavior.export.targets;
  const adapterErrors = adaptForAllTargets(metadata).flatMap((a) =>
    a.issues.filter((i) => i.level === "error").map((i) => `${a.target}: ${i.message}`),
  );

  const validation = {
    readiness_percent: readiness.percent,
    readiness_ready: readiness.ready,
    adapter_errors: adapterErrors,
    blockers: readiness.blockers,
  };

  const artifacts: ArtifactRow[] = [];
  const enc = new TextEncoder();

  if (targets.includes("epub")) {
    const epub = buildEpub(doc, "epub3");
    artifacts.push(await emitArtifact({
      slug, kind: "epub", target: null,
      filename: epub.filename, bytes: epub.bytes, mediaType: "application/epub+zip",
      validation, sourceQueueId: input.sourceQueueId, actor: input.actor,
    }));
  }
  if (targets.includes("kindle")) {
    const kfx = buildEpub(doc, "kindle");
    artifacts.push(await emitArtifact({
      slug, kind: "kindle", target: null,
      filename: kfx.filename, bytes: kfx.bytes, mediaType: "application/epub+zip",
      validation, sourceQueueId: input.sourceQueueId, actor: input.actor,
    }));
  }
  if (targets.includes("pdf")) {
    const html = printableHtml(doc);
    artifacts.push(await emitArtifact({
      slug, kind: "pdf-source", target: null,
      filename: `${slug}.print.html`, bytes: enc.encode(html), mediaType: "text/html",
      validation: { ...validation, runner: "external-pdf-runner-required" },
      sourceQueueId: input.sourceQueueId, actor: input.actor,
    }));
  }

  // Full publication package — always emitted.
  const pkg = buildPackage({ slug, doc, metadata, profile, assets, readiness });
  const pkgArtifact = await emitArtifact({
    slug, kind: "package", target: null,
    filename: pkg.filename, bytes: pkg.bytes, mediaType: "application/zip",
    validation, sourceQueueId: input.sourceQueueId, actor: input.actor,
  });
  artifacts.push(pkgArtifact);

  // Per-store sub-packages.
  for (const target of input.storeTargets ?? []) {
    const sp = buildStorePackage({ slug, doc, metadata, profile, assets, readiness }, target);
    artifacts.push(await emitArtifact({
      slug, kind: "store-package", target,
      filename: sp.filename, bytes: sp.bytes, mediaType: "application/zip",
      validation, sourceQueueId: input.sourceQueueId, actor: input.actor,
    }));
  }

  const signedUrls: Record<string, string> = {};
  for (const a of artifacts) {
    const url = await signUrl(a.storage_path);
    if (url) signedUrls[a.storage_path] = url;
  }
  const packageUrl = signedUrls[pkgArtifact.storage_path] ?? null;
  return { artifacts, packageUrl, signedUrls };
}

export async function listArtifacts(slug: string): Promise<ArtifactRow[]> {
  const { data, error } = await supabaseAdmin
    .from("publication_artifacts" as never)
    .select("*")
    .eq("slug", slug)
    .order("generated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ArtifactRow[];
}

export async function signArtifact(path: string): Promise<string | null> {
  return signUrl(path);
}
