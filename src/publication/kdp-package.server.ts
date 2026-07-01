/* Phase 18 Revision — KDP Distribution Package builder.
   Assembles a single downloadable folder (as .zip) containing every file
   an operator needs to complete a manual KDP submission. Reuses data
   that already exists inside the Publishing OS. No new validation. */
import { zipSync, strToU8, type Zippable } from "fflate";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveManuscriptForSlug } from "@/manuscript/resolver.server";
import { buildEpub } from "@/manuscript/package/epub-zip";
import {
  getRecord,
  getMetadata,
  listAssets,
  listEvents,
  recordEvent,
} from "./persistence.server";

const BUCKET = "publication-assets";

function safeFolder(s: string): string {
  return s.replace(/[^a-z0-9 &._-]+/gi, " ").replace(/\s+/g, " ").trim();
}

function extOf(path: string): string {
  const m = /\.[a-z0-9]+$/i.exec(path);
  return m ? m[0].toLowerCase() : "";
}

function formatMetadataTxt(input: {
  title: string;
  subtitle: string | null;
  series: string | null;
  volume: number | null;
  edition: string | null;
  author: string;
  contributors: string[];
  description: string;
  keywords: string[];
  categories: string[];
  language: string;
  isbn: string | null;
  publisher: string;
  rights: string | null;
  readingLevel: string | null;
  audience: string | null;
  publicationDate: string | null;
}): string {
  const lines: string[] = [];
  const add = (label: string, val: string | null | undefined) => {
    if (val && String(val).trim().length > 0) lines.push(`${label}: ${val}`);
  };
  add("Title", input.title);
  add("Subtitle", input.subtitle);
  add("Series", input.series);
  add("Volume", input.volume != null ? String(input.volume) : null);
  add("Edition", input.edition);
  add("Author", input.author);
  if (input.contributors.length) add("Contributors", input.contributors.join(", "));
  add("Language", input.language);
  add("Publisher", input.publisher);
  add("ISBN", input.isbn);
  add("Publication Date", input.publicationDate);
  add("Audience", input.audience);
  add("Reading Level", input.readingLevel);
  add("Rights", input.rights);
  lines.push("");
  lines.push("Categories:");
  for (const c of input.categories) lines.push(`  - ${c}`);
  if (input.categories.length === 0) lines.push("  (none)");
  lines.push("");
  lines.push(`Keywords (${input.keywords.length}):`);
  for (const k of input.keywords) lines.push(`  - ${k}`);
  if (input.keywords.length === 0) lines.push("  (none)");
  lines.push("");
  lines.push("Description:");
  lines.push(input.description || "(none)");
  lines.push("");
  lines.push("Publication Notes:");
  lines.push("  Copy the fields above directly into the KDP submission form.");
  return lines.join("\n");
}

function formatSummaryTxt(input: {
  slug: string;
  title: string;
  version: string;
  packageVersion: number;
  approvedAt: string | null;
  generatedAt: string;
  publicationStatus: string;
  packageStatus: string;
  assetStatus: Array<{ kind: string; active: boolean; url: string }>;
  artifactStatus: Array<{ kind: string; version: number; active: boolean; filename: string }>;
}): string {
  const lines: string[] = [
    `Publication Name: ${input.title}`,
    `Slug: ${input.slug}`,
    `Version: ${input.version}`,
    `Status: ${input.publicationStatus}`,
    `Approval Date: ${input.approvedAt ?? "—"}`,
    `Package Generated Date: ${input.generatedAt}`,
    `Package Version: v${input.packageVersion}`,
    `Package Status: ${input.packageStatus}`,
    "",
    "Asset Status:",
  ];
  if (input.assetStatus.length === 0) lines.push("  (no assets)");
  for (const a of input.assetStatus) {
    lines.push(`  - ${a.kind}: ${a.active ? "active" : "inactive"} — ${a.url}`);
  }
  lines.push("");
  lines.push("Artifact Status:");
  if (input.artifactStatus.length === 0) lines.push("  (no artifacts)");
  for (const a of input.artifactStatus) {
    lines.push(`  - ${a.kind} v${a.version}: ${a.active ? "active" : "inactive"} — ${a.filename}`);
  }
  return lines.join("\n");
}

export interface KdpPackageResult {
  filename: string;
  mediaType: "application/zip";
  contentBase64: string;
  byteLength: number;
  packageVersion: number;
  generatedAt: string;
  folderName: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export async function buildKdpDistributionPackage(slug: string): Promise<KdpPackageResult> {
  const { listArtifacts } = await import("./runner.server");
  const [record, meta, assets, events, artifacts] = await Promise.all([
    getRecord(slug),
    getMetadata(slug),
    listAssets(slug),
    listEvents(slug, 200),
    listArtifacts(slug),
  ]);
  if (!record) throw new Error(`Unknown publication: ${slug}`);

  const lib = await resolveManuscriptForSlug(slug);
  if (!lib) throw new Error(`No manuscript source for ${slug}`);

  const activeAssets = assets.filter((a) => a.is_active);
  const cover = activeAssets.find((a) => /cover/i.test(a.kind)) ?? null;

  const priorPackages = events.filter((e) => e.event_type === "kdp.package.generated").length;
  const packageVersion = priorPackages + 1;
  const generatedAt = new Date().toISOString();
  const approvedEvent = events.find((e) => {
    const p = e.payload as unknown as Record<string, unknown> | null;
    return e.event_type === "status.changed" && p && (p.submission_status === "approved" || p.to === "ready");
  });
  const approvedAt = approvedEvent?.created_at ?? null;

  const folderName = safeFolder(record.title || slug);
  const files: Zippable = {};

  // Interior — Kindle EPUB built from the approved manuscript source.
  const interior = buildEpub(lib.doc, "kindle");
  files[`${folderName}/Interior/${slug}.epub`] = interior.bytes;

  // Cover — pull the active cover binary from storage.
  if (cover) {
    const storagePath = cover.url.startsWith(`${BUCKET}/`)
      ? cover.url.slice(BUCKET.length + 1)
      : cover.url;
    try {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(storagePath);
      if (error || !data) throw new Error(error?.message ?? "download failed");
      const buf = new Uint8Array(await data.arrayBuffer());
      const ext = extOf(storagePath) || ".jpg";
      files[`${folderName}/Cover/${slug}-cover${ext}`] = buf;
    } catch (e) {
      files[`${folderName}/Cover/README.txt`] = strToU8(
        `Cover asset was registered but could not be downloaded: ${String(e)}\nSource: ${cover.url}\n`,
      );
    }
  }

  // Metadata.txt — human-readable, copy/paste into KDP.
  const metadataTxt = formatMetadataTxt({
    title: record.title,
    subtitle: record.subtitle,
    series: record.series,
    volume: record.volume,
    edition: null,
    author: record.author,
    contributors: meta?.contributors ?? [],
    description: meta?.description ?? "",
    keywords: (meta?.keywords ?? []).slice(0, 7),
    categories: meta?.categories ?? [],
    language: record.language,
    isbn: meta?.isbn ?? null,
    publisher: meta?.publisher ?? "ASCEND Media",
    rights: meta?.rights ?? null,
    readingLevel: meta?.reading_level ?? null,
    audience: record.audience,
    publicationDate: record.publication_date,
  });
  files[`${folderName}/Metadata.txt`] = strToU8(metadataTxt);

  // Publication Summary.txt — manifest.
  const summary = formatSummaryTxt({
    slug,
    title: record.title,
    version: record.version,
    packageVersion,
    approvedAt,
    generatedAt,
    publicationStatus: record.status,
    packageStatus: "ready",
    assetStatus: assets.map((a) => ({ kind: a.kind, active: a.is_active, url: a.url })),
    artifactStatus: artifacts.map((a) => ({ kind: a.kind, version: a.version, active: a.is_active, filename: a.filename })),
  });
  files[`${folderName}/Publication Summary.txt`] = strToU8(summary);

  const zipBytes = zipSync(files);

  await recordEvent({
    slug,
    event_type: "kdp.package.generated",
    payload: {
      package_version: packageVersion,
      generated_at: generatedAt,
      byte_length: zipBytes.byteLength,
      cover_included: !!cover,
    },
    ownerId: record.owner_id,
  });

  return {
    filename: `${folderName}.kdp-package.zip`,
    mediaType: "application/zip",
    contentBase64: bytesToBase64(zipBytes),
    byteLength: zipBytes.byteLength,
    packageVersion,
    generatedAt,
    folderName,
  };
}

/** Report the most recent KDP package generation for a slug (no side effects). */
export async function getLatestKdpPackageInfo(slug: string): Promise<{
  packageVersion: number;
  generatedAt: string;
} | null> {
  const events = await listEvents(slug, 200);
  const generated = events.filter((e) => e.event_type === "kdp.package.generated");
  if (generated.length === 0) return null;
  const latest = generated[0];
  const payload = (latest.payload as unknown as { package_version?: number; generated_at?: string }) ?? {};
  return {
    packageVersion: payload.package_version ?? generated.length,
    generatedAt: payload.generated_at ?? latest.created_at,
  };
}
