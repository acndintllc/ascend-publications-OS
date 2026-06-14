/* Manuscript resolver — bridges bundled library and Supabase-stored
   uploads. Server-only: pulls bytes from the publication-manuscripts
   bucket via the admin client. */
import { getManuscript } from "@/manuscript/library";
import { parseManuscript } from "@/manuscript/ingest/markdown";
import { parseDocx } from "@/manuscript/ingest/docx";
import { parseBib } from "@/manuscript/enrich/citations";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ACADocument, BibEntry } from "@/manuscript/schema/aca";
import type { VeraSidecar } from "@/manuscript/enrich/vera";

const BUCKET = "publication-manuscripts";

export interface ResolvedManuscript {
  slug: string;
  doc: ACADocument;
  bib: BibEntry[];
  veraSidecar?: VeraSidecar;
  source: "bundled" | "uploaded";
}

async function downloadText(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Download failed for ${path}: ${error?.message ?? "no data"}`);
  return await data.text();
}

async function downloadBytes(path: string): Promise<Uint8Array> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Download failed for ${path}: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function resolveManuscriptForSlug(slug: string): Promise<ResolvedManuscript | undefined> {
  const bundled = getManuscript(slug);
  if (bundled) {
    return { slug, doc: bundled.doc, bib: bundled.bib, veraSidecar: bundled.veraSidecar, source: "bundled" };
  }
  const { data, error } = await supabaseAdmin
    .from("publication_sources")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return undefined;
  const row = data as {
    slug: string; format: "md" | "docx"; storage_path: string;
    bib_path: string | null; vera_path: string | null;
  };
  const doc =
    row.format === "docx"
      ? parseDocx(await downloadBytes(row.storage_path))
      : parseManuscript(await downloadText(row.storage_path));
  const bib = row.bib_path ? parseBib(await downloadText(row.bib_path)) : [];
  const veraSidecar = row.vera_path
    ? (JSON.parse(await downloadText(row.vera_path)) as VeraSidecar)
    : undefined;
  return { slug, doc, bib, veraSidecar, source: "uploaded" };
}
