/* Manuscript library (Phase 3C).
   Bundles every manuscripts/<slug>/manuscript.md at build time via
   Vite import.meta.glob — no server fs required at runtime. */
import { parseManuscript } from "./ingest/markdown";
import type { ACADocument } from "./schema/aca";

const sources = import.meta.glob("/manuscripts/*/manuscript.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export interface LibraryEntry {
  slug: string;
  doc: ACADocument;
}

const cache: LibraryEntry[] = Object.entries(sources)
  .map(([path, raw]) => {
    const m = /\/manuscripts\/([^/]+)\/manuscript\.md$/.exec(path);
    if (!m) return null;
    const doc = parseManuscript(raw);
    return { slug: m[1], doc };
  })
  .filter((x): x is LibraryEntry => x !== null)
  .sort((a, b) => a.doc.frontmatter.title.localeCompare(b.doc.frontmatter.title));

export function listManuscripts(): LibraryEntry[] {
  return cache;
}

export function getManuscript(slug: string): LibraryEntry | undefined {
  return cache.find((e) => e.slug === slug);
}
