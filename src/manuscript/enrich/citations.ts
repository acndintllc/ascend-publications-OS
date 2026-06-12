/* Citation enrichment (PTL-008 §4, Phase 3D).
   Minimal BibTeX-ish parser — handles @type{key, field = {value}, ...}.
   Inline ref syntax: [@key] inside paragraphs. */
import type { ACABlock, ACAInline, BibEntry } from "../schema/aca";

const ENTRY_RE = /@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\}/g;
const FIELD_RE = /(\w+)\s*=\s*[{"]([\s\S]*?)["}]\s*,?/g;

export function parseBib(src: string): BibEntry[] {
  const out: BibEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = ENTRY_RE.exec(src))) {
    const key = m[2];
    const body = m[3];
    const entry: BibEntry = { key, raw: m[0] };
    let f: RegExpExecArray | null;
    while ((f = FIELD_RE.exec(body))) {
      const name = f[1].toLowerCase();
      const value = f[2].trim();
      if (name === "author") entry.author = value;
      else if (name === "year") entry.year = value;
      else if (name === "title") entry.title = value;
      else if (name === "journal" || name === "publisher" || name === "source") entry.source = value;
    }
    out.push(entry);
  }
  return out;
}

export function formatBibEntry(e: BibEntry): string {
  const bits: string[] = [];
  if (e.author) bits.push(e.author);
  if (e.year) bits.push(`(${e.year})`);
  if (e.title) bits.push(e.title);
  if (e.source) bits.push(e.source);
  return bits.join(". ") || e.key;
}

const CITE_RE = /\[@([a-zA-Z0-9_:-]+)\]/g;

function resolveInline(nodes: ACAInline[], index: Map<string, BibEntry>): ACAInline[] {
  const out: ACAInline[] = [];
  for (const n of nodes) {
    if (n.kind === "text") {
      let last = 0;
      let m: RegExpExecArray | null;
      CITE_RE.lastIndex = 0;
      while ((m = CITE_RE.exec(n.value))) {
        if (m.index > last) out.push({ kind: "text", value: n.value.slice(last, m.index) });
        out.push({ kind: "citation-ref", key: m[1], resolved: index.get(m[1]) });
        last = m.index + m[0].length;
      }
      if (last < n.value.length) {
        const tail = n.value.slice(last);
        if (last === 0) out.push(n);
        else out.push({ kind: "text", value: tail });
      } else if (last === 0) {
        out.push(n);
      }
    } else if ("children" in n && n.children) {
      out.push({ ...n, children: resolveInline(n.children, index) } as ACAInline);
    } else {
      out.push(n);
    }
  }
  return out;
}

function walkBlocks(blocks: ACABlock[], index: Map<string, BibEntry>): ACABlock[] {
  return blocks.map((b) => {
    switch (b.kind) {
      case "body":
      case "dialogue":
      case "pullquote":
        return { ...b, children: resolveInline(b.children, index) };
      case "chapter-opener":
        return { ...b, title: resolveInline(b.title, index) };
      case "section":
        return {
          ...b,
          title: b.title ? resolveInline(b.title, index) : undefined,
          children: walkBlocks(b.children, index),
        };
      case "sidebar":
      case "callout":
      case "report":
        return { ...b, children: walkBlocks(b.children, index) };
      default:
        return b;
    }
  });
}

export function resolveCitations(
  blocks: ACABlock[],
  bib: BibEntry[],
): { blocks: ACABlock[]; used: BibEntry[] } {
  const index = new Map(bib.map((e) => [e.key, e]));
  const resolved = walkBlocks(blocks, index);
  const usedKeys = new Set<string>();
  const collect = (bs: ACABlock[]) => {
    for (const b of bs) {
      if ("children" in b) {
        if (Array.isArray(b.children) && b.children.length && "kind" in (b.children[0] as object)) {
          const firstKind = (b.children[0] as { kind: string }).kind;
          if (firstKind === "chapter-opener" || firstKind === "section" || firstKind === "body") {
            collect(b.children as ACABlock[]);
            continue;
          }
          for (const c of b.children as ACAInline[]) if (c.kind === "citation-ref") usedKeys.add(c.key);
        }
      }
      if (b.kind === "chapter-opener") for (const c of b.title) if (c.kind === "citation-ref") usedKeys.add(c.key);
    }
  };
  collect(resolved);
  return { blocks: resolved, used: bib.filter((e) => usedKeys.has(e.key)) };
}
