/* Shared enrichment pipeline (PTL-019 Phase 7B).
   Used by the build-time library and the runtime live-preview route
   so dropped files render identically to bundled manuscripts. */
import { parseManuscript } from "./ingest/markdown";
import { parseDocx } from "./ingest/docx";
import { parseBib, resolveCitations } from "./enrich/citations";
import { computeReadingStats } from "./enrich/reading-stats";
import { attachVera, type VeraSidecar } from "./enrich/vera";
import { validateManuscript, type ValidationReport } from "./validate";
import type { ACADocument, BibEntry } from "./schema/aca";

export interface EnrichInputs {
  bib?: BibEntry[];
  vera?: VeraSidecar;
}

export interface EnrichResult {
  doc: ACADocument;
  report: ValidationReport;
}

export function enrich(parsed: ACADocument, inputs: EnrichInputs = {}): EnrichResult {
  const bib = inputs.bib ?? [];
  const { blocks: bibBlocks, used } = resolveCitations(parsed.blocks, bib);
  const { blocks: veraBlocks, notes: veraNotes } = attachVera(bibBlocks, inputs.vera);
  const stats = computeReadingStats(veraBlocks);
  const doc: ACADocument = {
    ...parsed,
    blocks: veraBlocks,
    enrichment: { stats, bibliography: used, vera: veraNotes },
  };
  const report = validateManuscript(doc, bib, inputs.vera);
  return { doc, report };
}

export function ingestMarkdown(raw: string, inputs: EnrichInputs = {}): EnrichResult {
  return enrich(parseManuscript(raw), inputs);
}

export function ingestDocx(bytes: Uint8Array, inputs: EnrichInputs = {}): EnrichResult {
  return enrich(parseDocx(bytes), inputs);
}

export function ingestBib(raw: string): BibEntry[] {
  return parseBib(raw);
}

export function ingestVera(raw: string): VeraSidecar {
  return JSON.parse(raw) as VeraSidecar;
}
