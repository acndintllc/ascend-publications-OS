/* Manuscript validation (PTL-017 Phase 6A).
   Surfaces frontmatter errors, unresolved citation keys, orphan
   VERA anchors, and a per-chapter rhythm report. Pure functions —
   no IO, no React. */
import type {
  ACABlock,
  ACADocument,
  ACAInline,
  BibEntry,
} from "../schema/aca";
import type { VeraSidecar } from "../enrich/vera";

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface ChapterRhythm {
  index: number;
  title: string;
  words: number;
  paragraphs: number;
  sections: number;
  pullquotes: number;
  dialogue: number;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  unresolvedCitations: string[];
  orphanVeraAnchors: number[];
  rhythm: ChapterRhythm[];
}

function inlineText(nodes: ACAInline[]): string {
  return nodes
    .map((n) => {
      switch (n.kind) {
        case "text":
        case "code":
          return n.value;
        case "emphasis":
        case "strong":
        case "link":
          return inlineText(n.children);
        default:
          return "";
      }
    })
    .join("");
}

function collectCitationKeys(blocks: ACABlock[], out: ACAInline[] = []): ACAInline[] {
  const visit = (ns: ACAInline[]) => {
    for (const n of ns) {
      if (n.kind === "citation-ref") out.push(n);
      else if ("children" in n && n.children) visit(n.children);
    }
  };
  for (const b of blocks) {
    switch (b.kind) {
      case "body":
      case "dialogue":
      case "pullquote":
        visit(b.children);
        break;
      case "chapter-opener":
        visit(b.title);
        break;
      case "section":
        if (b.title) visit(b.title);
        collectCitationKeys(b.children, out);
        break;
      case "sidebar":
      case "callout":
      case "report":
        collectCitationKeys(b.children, out);
        break;
    }
  }
  return out;
}

function countBodyBlocks(blocks: ACABlock[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.kind === "body") n += 1;
    else if (
      b.kind === "section" ||
      b.kind === "sidebar" ||
      b.kind === "callout" ||
      b.kind === "report"
    ) {
      n += countBodyBlocks(b.children);
    }
  }
  return n;
}

function chapterRhythm(blocks: ACABlock[]): ChapterRhythm[] {
  const chapters: ChapterRhythm[] = [];
  let current: ChapterRhythm | null = null;

  const tally = (bs: ACABlock[]) => {
    for (const b of bs) {
      if (b.kind === "chapter-opener") {
        current = {
          index: chapters.length,
          title: inlineText(b.title).trim() || `Chapter ${chapters.length + 1}`,
          words: 0,
          paragraphs: 0,
          sections: 0,
          pullquotes: 0,
          dialogue: 0,
        };
        chapters.push(current);
        continue;
      }
      if (!current) {
        current = {
          index: 0,
          title: "(untitled)",
          words: 0,
          paragraphs: 0,
          sections: 0,
          pullquotes: 0,
          dialogue: 0,
        };
        chapters.push(current);
      }
      switch (b.kind) {
        case "body": {
          const t = inlineText(b.children);
          current.words += (t.trim().match(/\S+/g) ?? []).length;
          current.paragraphs += 1;
          break;
        }
        case "dialogue": {
          const t = inlineText(b.children);
          current.words += (t.trim().match(/\S+/g) ?? []).length;
          current.dialogue += 1;
          current.paragraphs += 1;
          break;
        }
        case "pullquote":
          current.pullquotes += 1;
          break;
        case "section":
          current.sections += 1;
          tally(b.children);
          break;
        case "sidebar":
        case "callout":
        case "report":
          tally(b.children);
          break;
      }
    }
  };
  tally(blocks);
  return chapters;
}

export function validateManuscript(
  doc: ACADocument,
  bib: BibEntry[],
  veraSidecar: VeraSidecar | undefined,
): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Frontmatter sanity
  if (!doc.frontmatter.authors.length) {
    issues.push({ severity: "error", code: "FM001", message: "Frontmatter must list at least one author." });
  }
  if (doc.frontmatter.title.length > 120) {
    issues.push({ severity: "warning", code: "FM002", message: "Title exceeds 120 chars — may truncate in readers." });
  }

  // Citations
  const refs = collectCitationKeys(doc.blocks);
  const bibKeys = new Set(bib.map((e) => e.key));
  const unresolved = Array.from(
    new Set(refs.filter((r) => r.kind === "citation-ref" && !bibKeys.has(r.key)).map((r) => (r as { key: string }).key)),
  );
  for (const k of unresolved) {
    issues.push({ severity: "warning", code: "CIT001", message: `Unresolved citation key: [@${k}]` });
  }
  const unused = bib.filter((e) => !refs.some((r) => r.kind === "citation-ref" && r.key === e.key));
  for (const e of unused) {
    issues.push({ severity: "info", code: "CIT002", message: `Bibliography entry unused: ${e.key}` });
  }

  // VERA anchors
  const bodyCount = countBodyBlocks(doc.blocks);
  const orphans = (veraSidecar?.notes ?? [])
    .filter((n) => n.anchor < 0 || n.anchor >= bodyCount)
    .map((n) => n.anchor);
  for (const a of orphans) {
    issues.push({
      severity: "warning",
      code: "VERA001",
      message: `VERA anchor #${a} points past last body block (have ${bodyCount}).`,
    });
  }

  // Structural
  const hasOpener = doc.blocks.some((b) => b.kind === "chapter-opener");
  if (!hasOpener) {
    issues.push({ severity: "warning", code: "STR001", message: "Manuscript has no :::chapter-opener directive." });
  }

  return {
    issues,
    unresolvedCitations: unresolved,
    orphanVeraAnchors: orphans,
    rhythm: chapterRhythm(doc.blocks),
  };
}

export interface LibraryFailure {
  slug: string;
  source: string;
  error: string;
}
