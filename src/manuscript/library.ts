/* Manuscript library (Phase 3C + 3D).
   Bundles manuscripts/<slug>/{manuscript.md, citations.bib, vera.json}
   at build time via Vite import.meta.glob, then runs enrichment. */
import { parseManuscript } from "./ingest/markdown";
import { parseBib, resolveCitations } from "./enrich/citations";
import { computeReadingStats } from "./enrich/reading-stats";
import { attachVera, type VeraSidecar } from "./enrich/vera";
import type { ACADocument } from "./schema/aca";

const mdSources = import.meta.glob("/manuscripts/*/manuscript.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const bibSources = import.meta.glob("/manuscripts/*/citations.bib", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const veraSources = import.meta.glob("/manuscripts/*/vera.json", {
  import: "default",
  eager: true,
}) as Record<string, VeraSidecar>;

const slugOf = (p: string) => /\/manuscripts\/([^/]+)\//.exec(p)?.[1];
const indexBy = <T>(src: Record<string, T>) => {
  const out = new Map<string, T>();
  for (const [p, v] of Object.entries(src)) {
    const s = slugOf(p);
    if (s) out.set(s, v);
  }
  return out;
};

const bibIndex = indexBy(bibSources);
const veraIndex = indexBy(veraSources);

export interface LibraryEntry {
  slug: string;
  doc: ACADocument;
}

const cache: LibraryEntry[] = Object.entries(mdSources)
  .map(([path, raw]) => {
    const slug = slugOf(path);
    if (!slug) return null;
    const parsed = parseManuscript(raw);

    const bib = bibIndex.get(slug) ? parseBib(bibIndex.get(slug)!) : [];
    const { blocks: bibBlocks, used } = resolveCitations(parsed.blocks, bib);

    const sidecar = veraIndex.get(slug);
    const { blocks: veraBlocks, notes: veraNotes } = attachVera(bibBlocks, sidecar);

    const stats = computeReadingStats(veraBlocks);

    const doc: ACADocument = {
      ...parsed,
      blocks: veraBlocks,
      enrichment: { stats, bibliography: used, vera: veraNotes },
    };
    return { slug, doc };
  })
  .filter((x): x is LibraryEntry => x !== null)
  .sort((a, b) => a.doc.frontmatter.title.localeCompare(b.doc.frontmatter.title));

export function listManuscripts(): LibraryEntry[] {
  return cache;
}

export function getManuscript(slug: string): LibraryEntry | undefined {
  return cache.find((e) => e.slug === slug);
}
