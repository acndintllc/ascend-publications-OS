/* ASCEND Canonical AST (ACA) — schema (PTL-008 §3, Phase 3B)
   Pure types + Zod schema. No render logic, no IO. */
import { z } from "zod";

export const acaFrontmatter = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  mode: z.enum(["web-reader", "cinematic", "operational", "pdf", "ebook", "kindle"]),
  authors: z.array(z.string()).min(1),
  eyebrow: z.string().optional(),
  subtitle: z.string().optional(),
});
export type ACAFrontmatter = z.infer<typeof acaFrontmatter>;

/* Inline (phrasing) nodes */
export type ACAInline =
  | { kind: "text"; value: string }
  | { kind: "emphasis"; children: ACAInline[] }
  | { kind: "strong"; children: ACAInline[] }
  | { kind: "code"; value: string }
  | { kind: "link"; href: string; children: ACAInline[] }
  | { kind: "footnote-ref"; id: string };

/* Block-level nodes — one per TIER-2 publishing role */
export type ACABlock =
  | { kind: "chapter-opener"; eyebrow?: string; title: ACAInline[] }
  | { kind: "section"; title?: ACAInline[]; children: ACABlock[] }
  | { kind: "body"; children: ACAInline[] }
  | { kind: "dialogue"; speaker?: string; children: ACAInline[] }
  | { kind: "pullquote"; cite?: string; children: ACAInline[] }
  | { kind: "sidebar"; title?: string; children: ACABlock[] }
  | { kind: "callout"; variant?: string; children: ACABlock[] }
  | { kind: "citation"; value: string }
  | { kind: "report"; children: ACABlock[] }
  | { kind: "scene-break" }
  | { kind: "footnote"; id: string; children: ACAInline[] };

export interface ACADocument {
  frontmatter: ACAFrontmatter;
  blocks: ACABlock[];
  footnotes: Extract<ACABlock, { kind: "footnote" }>[];
}
