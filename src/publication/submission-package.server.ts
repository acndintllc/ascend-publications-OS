/* PTL-027 Phase 16B — KDP-first submission package builder (server-only).
   Combines: metadata serializer + ISBN + active EPUB/Kindle artifacts +
   cover asset. Produces a JSON manifest with signed URLs the downstream
   submission runner can ingest. Validates required fields per platform. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERIALIZERS } from "./serializers";
import { publicationMetadataSchema, type DistributionTarget, type AdapterIssue } from "./metadata";
import { isValidIsbn13, ISBN_REQUIRED_TARGETS } from "./isbn";
import { getRecord, getMetadata, listAssets } from "./persistence.server";
import { listIsbns } from "./registry-extra.server";
import { listArtifacts } from "./runner.server";

const BUCKET = "publication-assets";
const SIGNED_TTL = 60 * 60 * 24 * 7;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface SubmissionPackage {
  slug: string;
  platform: DistributionTarget;
  ready: boolean;
  issues: AdapterIssue[];
  manifest: {
    metadata: JsonValue;
    serialized: { filename: string; mediaType: string; body: string };
    isbn: { isbn: string; format: string } | null;
    artifacts: Array<{
      kind: string; target: string | null; version: number;
      filename: string; media_type: string; storage_path: string;
      signed_url: string | null;
    }>;
    cover: { url: string; signed_url: string | null } | null;
  };
}



export async function buildSubmissionPackage(slug: string, platform: DistributionTarget): Promise<SubmissionPackage> {
  const [record, metaRow, assets, isbns, artifacts] = await Promise.all([
    getRecord(slug), getMetadata(slug), listAssets(slug),
    listIsbns(slug), listArtifacts(slug),
  ]);
  if (!record) throw new Error(`Unknown publication: ${slug}`);

  const issues: AdapterIssue[] = [];

  const parsed = publicationMetadataSchema.safeParse({
    title: record.title,
    subtitle: record.subtitle ?? undefined,
    description: metaRow?.description || record.title,
    keywords: metaRow?.keywords ?? [],
    categories: metaRow?.categories ?? [],
    author: record.author,
    contributors: metaRow?.contributors ?? [],
    language: record.language,
    audience: record.audience ?? undefined,
    publicationDate: record.publication_date ?? undefined,
    isbn: metaRow?.isbn ?? undefined,
    publisher: metaRow?.publisher ?? "ASCEND Media",
    rights: metaRow?.rights ?? undefined,
  });
  if (!parsed.success) {
    return {
      slug, platform, ready: false,
      issues: [{ level: "error", field: "metadata", message: parsed.error.issues[0]?.message ?? "metadata invalid" }],
      manifest: {
        metadata: null,
        serialized: { filename: "", mediaType: "", body: "" },
        isbn: null, artifacts: [], cover: null,
      },
    };
  }
  const metadata = parsed.data;
  const serializer = SERIALIZERS[platform];
  if (!serializer) {
    issues.push({ level: "error", field: "platform", message: `No serializer for ${platform}` });
  }
  const ser = serializer ? serializer(metadata, slug) : { filename: "", mediaType: "", body: "", issues: [] as AdapterIssue[] };
  issues.push(...ser.issues);

  // ISBN selection & validation
  const usableIsbn = isbns.find((r) => isValidIsbn13(r.isbn) && (r.status === "assigned" || r.status === "registered"));
  if (ISBN_REQUIRED_TARGETS.includes(platform) && !usableIsbn) {
    issues.push({ level: "error", field: "isbn", message: `${platform}: requires a valid assigned/registered ISBN-13` });
  }
  if (isbns.some((r) => !isValidIsbn13(r.isbn))) {
    issues.push({ level: "warning", field: "isbn", message: "One or more registered ISBNs fail checksum" });
  }

  // Required artifacts per platform
  const active = artifacts.filter((a) => a.is_active);
  const needEpub = platform !== "kdp"; // KDP accepts kindle preferentially
  const needKindle = platform === "kdp";
  const epub = active.find((a) => a.kind === "epub");
  const kindle = active.find((a) => a.kind === "kindle");
  if (needEpub && !epub) issues.push({ level: "error", field: "artifact", message: `${platform}: missing active EPUB artifact` });
  if (needKindle && !kindle) issues.push({ level: "error", field: "artifact", message: `${platform}: missing active Kindle artifact (run KFX runner)` });

  // Cover asset
  const cover = assets.find((a) => a.is_active && /cover/i.test(a.kind));
  if (!cover) issues.push({ level: "error", field: "asset", message: `${platform}: missing cover asset` });

  // Sign URLs for included artifacts
  const wanted = [epub, kindle].filter(Boolean).filter((a) => {
    if (platform === "kdp") return a!.kind === "kindle" || a!.kind === "epub";
    return a!.kind === "epub";
  });
  const signedArtifacts = await Promise.all(wanted.map(async (a) => {
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(a!.storage_path, SIGNED_TTL);
    return {
      kind: a!.kind, target: a!.target, version: a!.version,
      filename: a!.filename, media_type: a!.media_type,
      storage_path: a!.storage_path, signed_url: data?.signedUrl ?? null,
    };
  }));

  let coverSigned: string | null = null;
  if (cover && cover.url.startsWith("publication-assets/")) {
    const path = cover.url.replace(/^publication-assets\//, "");
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
    coverSigned = data?.signedUrl ?? null;
  }

  const ready = issues.every((i) => i.level !== "error");
  return {
    slug, platform, ready, issues,
    manifest: {
      metadata,
      serialized: { filename: ser.filename, mediaType: ser.mediaType, body: ser.body },
      isbn: usableIsbn ? { isbn: usableIsbn.isbn, format: usableIsbn.format } : null,
      artifacts: signedArtifacts,
      cover: cover ? { url: cover.url, signed_url: coverSigned } : null,
    },
  };
}
