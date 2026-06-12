/* Manuscript library (Phase 3C + 3D + 6A + 6B).
   Bundles manuscripts/<slug>/{manuscript.md|.docx, citations.bib,
   vera.json} at build time via Vite import.meta.glob, runs
   enrichment, and retains failed manuscripts so the library UI
   can report them. */
import { parseManuscript } from "./ingest/markdown";
import { parseDocx } from "./ingest/docx";
import { parseBib, resolveCitations } from "./enrich/citations";
import { computeReadingStats } from "./enrich/reading-stats";
import { attachVera, type VeraSidecar } from "./enrich/vera";
import { validateManuscript, type ValidationReport } from "./validate";
import type { ACADocument, BibEntry } from "./schema/aca";

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
  bib: BibEntry[];
  veraSidecar?: VeraSidecar;
  report: ValidationReport;
}

export interface LibraryFailure {
  slug: string;
  error: string;
}

interface LibraryState {
  entries: LibraryEntry[];
  failures: LibraryFailure[];
}

const state: LibraryState = (() => {
  const entries: LibraryEntry[] = [];
  const failures: LibraryFailure[] = [];

  for (const [path, raw] of Object.entries(mdSources)) {
    const slug = slugOf(path);
    if (!slug) continue;
    try {
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
      const report = validateManuscript(doc, bib, sidecar);
      entries.push({ slug, doc, bib, veraSidecar: sidecar, report });
    } catch (err) {
      failures.push({
        slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  entries.sort((a, b) => a.doc.frontmatter.title.localeCompare(b.doc.frontmatter.title));
  failures.sort((a, b) => a.slug.localeCompare(b.slug));
  return { entries, failures };
})();

export function listManuscripts(): LibraryEntry[] {
  return state.entries;
}

export function listFailures(): LibraryFailure[] {
  return state.failures;
}

export function getManuscript(slug: string): LibraryEntry | undefined {
  return state.entries.find((e) => e.slug === slug);
}
