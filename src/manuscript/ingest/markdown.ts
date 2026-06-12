/* ASCEND Markdown → ACA ingest (PTL-008 §2, Phase 3B)
   GFM superset + ASCEND block directives:

     :::chapter-opener eyebrow="..."
     # Title
     :::

     :::section title="..."
     ...
     :::

     :::dialogue speaker="..."
     line
     :::

     :::pullquote cite="..."
     line
     :::

     :::sidebar title="..."
     body...
     :::

     :::callout
     body...
     :::

     :::citation
     raw block
     :::

     :::report
     body...
     :::

     ---scene---

   Plus standard paragraphs → body; footnotes via [^id] / [^id]: text. */
import { marked, type Token, type Tokens } from "marked";
import {
  acaFrontmatter,
  type ACABlock,
  type ACADocument,
  type ACAInline,
} from "../schema/aca";

const directiveOpen = /^:::([a-z-]+)(?:\s+(.*))?$/;
const directiveClose = /^:::\s*$/;
const sceneBreak = /^---scene---\s*$/;
const footnoteDef = /^\[\^([^\]]+)\]:\s*(.*)$/;

function parseAttrs(raw?: string): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  const re = /([a-zA-Z][\w-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out[m[1]] = m[2];
  return out;
}

function parseFrontmatter(src: string): { fm: unknown; body: string } {
  if (!src.startsWith("---")) return { fm: {}, body: src };
  const end = src.indexOf("\n---", 3);
  if (end < 0) return { fm: {}, body: src };
  const head = src.slice(3, end).trim();
  const body = src.slice(end + 4).replace(/^\s*\n/, "");
  const fm: Record<string, unknown> = {};
  for (const line of head.split("\n")) {
    const ix = line.indexOf(":");
    if (ix < 0) continue;
    const key = line.slice(0, ix).trim();
    let val: string = line.slice(ix + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      fm[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    } else {
      val = val.replace(/^['"]|['"]$/g, "");
      fm[key] = val;
    }
  }
  return { fm, body };
}

function inlineFromTokens(tokens: Token[] | undefined): ACAInline[] {
  if (!tokens) return [];
  const out: ACAInline[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "text": {
        const tt = t as Tokens.Text;
        if (tt.tokens && tt.tokens.length) out.push(...inlineFromTokens(tt.tokens));
        else out.push({ kind: "text", value: tt.text });
        break;
      }
      case "em":
        out.push({ kind: "emphasis", children: inlineFromTokens((t as Tokens.Em).tokens) });
        break;
      case "strong":
        out.push({ kind: "strong", children: inlineFromTokens((t as Tokens.Strong).tokens) });
        break;
      case "codespan":
        out.push({ kind: "code", value: (t as Tokens.Codespan).text });
        break;
      case "link":
        out.push({
          kind: "link",
          href: (t as Tokens.Link).href,
          children: inlineFromTokens((t as Tokens.Link).tokens),
        });
        break;
      case "footnoteRef":
        out.push({ kind: "footnote-ref", id: (t as unknown as { id: string }).id });
        break;
      case "br":
        out.push({ kind: "text", value: "\n" });
        break;
      default: {
        const anyT = t as { text?: string };
        if (anyT.text) out.push({ kind: "text", value: anyT.text });
      }
    }
  }
  return out;
}

function parseInline(src: string): ACAInline[] {
  return inlineFromTokens(marked.lexer(src, { gfm: true })[0]?.type === "paragraph"
    ? (marked.lexer(src, { gfm: true })[0] as Tokens.Paragraph).tokens
    : marked.lexer(src, { gfm: true }) as Token[]);
}

function blocksFromMarkdown(src: string, footnotes: ACADocument["footnotes"]): ACABlock[] {
  const tokens = marked.lexer(src, { gfm: true });
  const out: ACABlock[] = [];
  for (const t of tokens) {
    if (t.type === "paragraph") {
      out.push({ kind: "body", children: inlineFromTokens((t as Tokens.Paragraph).tokens) });
    } else if (t.type === "heading") {
      const h = t as Tokens.Heading;
      if (h.depth === 1) {
        out.push({ kind: "chapter-opener", title: inlineFromTokens(h.tokens) });
      } else {
        out.push({ kind: "section", title: inlineFromTokens(h.tokens), children: [] });
      }
    } else if (t.type === "blockquote") {
      const bq = t as Tokens.Blockquote;
      out.push({ kind: "pullquote", children: inlineFromTokens(
        bq.tokens.flatMap((x) => (x.type === "paragraph" ? (x as Tokens.Paragraph).tokens : []))
      ) });
    } else if (t.type === "code") {
      out.push({ kind: "citation", value: (t as Tokens.Code).text });
    } else if (t.type === "space") {
      /* skip */
    } else if (t.type === "hr") {
      out.push({ kind: "scene-break" });
    } else {
      const raw = (t as { raw?: string }).raw;
      if (raw) {
        const fm = footnoteDef.exec(raw.trim());
        if (fm) {
          footnotes.push({ kind: "footnote", id: fm[1], children: parseInline(fm[2]) });
          continue;
        }
        out.push({ kind: "body", children: [{ kind: "text", value: raw.trim() }] });
      }
    }
  }
  return out;
}

export function parseManuscript(source: string): ACADocument {
  const { fm, body } = parseFrontmatter(source);
  const frontmatter = acaFrontmatter.parse(fm);

  const lines = body.split("\n");
  const blocks: ACABlock[] = [];
  const footnotes: ACADocument["footnotes"] = [];

  let i = 0;
  let bufferStart = 0;
  const flushBuffer = (end: number) => {
    const chunk = lines.slice(bufferStart, end).join("\n").trim();
    if (chunk) blocks.push(...blocksFromMarkdown(chunk, footnotes));
  };

  while (i < lines.length) {
    const line = lines[i];
    if (sceneBreak.test(line)) {
      flushBuffer(i);
      blocks.push({ kind: "scene-break" });
      i += 1;
      bufferStart = i;
      continue;
    }
    const open = directiveOpen.exec(line);
    if (open) {
      flushBuffer(i);
      const name = open[1];
      const attrs = parseAttrs(open[2]);
      i += 1;
      const innerStart = i;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        if (directiveOpen.test(lines[i])) depth += 1;
        else if (directiveClose.test(lines[i])) depth -= 1;
        if (depth > 0) i += 1;
      }
      const inner = lines.slice(innerStart, i).join("\n");
      const innerBlocks = blocksFromMarkdown(inner, footnotes);
      blocks.push(directiveToBlock(name, attrs, innerBlocks, inner));
      i += 1;
      bufferStart = i;
      continue;
    }
    i += 1;
  }
  flushBuffer(lines.length);

  return { frontmatter, blocks, footnotes };
}

function inlineOfBlocks(bs: ACABlock[]): ACAInline[] {
  const out: ACAInline[] = [];
  for (const b of bs) if (b.kind === "body") out.push(...b.children);
  return out;
}

function directiveToBlock(
  name: string,
  attrs: Record<string, string>,
  innerBlocks: ACABlock[],
  innerRaw: string,
): ACABlock {
  switch (name) {
    case "chapter-opener": {
      const title = innerBlocks.find((b) => b.kind === "chapter-opener");
      if (title && title.kind === "chapter-opener") {
        return { kind: "chapter-opener", eyebrow: attrs.eyebrow, title: title.title };
      }
      return {
        kind: "chapter-opener",
        eyebrow: attrs.eyebrow,
        title: inlineOfBlocks(innerBlocks),
      };
    }
    case "section":
      return {
        kind: "section",
        title: attrs.title ? parseInline(attrs.title) : undefined,
        children: innerBlocks,
      };
    case "dialogue":
      return { kind: "dialogue", speaker: attrs.speaker, children: inlineOfBlocks(innerBlocks) };
    case "pullquote":
      return { kind: "pullquote", cite: attrs.cite, children: inlineOfBlocks(innerBlocks) };
    case "sidebar":
      return { kind: "sidebar", title: attrs.title, children: innerBlocks };
    case "callout":
      return { kind: "callout", variant: attrs.variant, children: innerBlocks };
    case "citation":
      return { kind: "citation", value: innerRaw.trim() };
    case "report":
      return { kind: "report", children: innerBlocks };
    default:
      return { kind: "body", children: inlineOfBlocks(innerBlocks) };
  }
}
