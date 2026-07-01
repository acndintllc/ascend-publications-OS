/* ASCEND DOCX → ACA ingest — industry-standard semantic parsing.

   Worker-safe: fflate for unzip + regex extraction of word/document.xml.
   No DOM, no native deps, no Node-only libs, no ASCEND-specific styles.

   Mapping (Kindle/ePub3 standard):
     Heading 1        → chapter-opener
     Heading 2        → section
     Heading 3        → section (nested title)
     Quote/IntenseQuote → pullquote
     List paragraph (w:numPr, numFmt bullet) → body prefixed with • / grouped
     List paragraph (w:numPr, decimal)       → body prefixed with n.
     Page break (w:br w:type="page")         → scene-break
     Anything else    → body

   Inline: <w:b> → strong, <w:i> → emphasis.

   Frontmatter: docProps/custom.xml (ASCEND:*) or a leading
   "---frontmatter---" paragraph block. Sensible defaults otherwise. */
import { unzipSync, strFromU8 } from "fflate";
import {
  acaFrontmatter,
  type ACABlock,
  type ACADocument,
  type ACAFrontmatter,
  type ACAInline,
} from "../schema/aca";

type ParaRole =
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "list-bullet"
  | "list-number"
  | "body";

interface RawPara {
  role: ParaRole;
  children: ACAInline[];
  text: string; // flattened for frontmatter detection / empty checks
  hasPageBreak: boolean;
  numberValue?: number; // for ordered lists
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");

function normalizeStyleId(id: string | undefined): string {
  if (!id) return "";
  return id.toLowerCase().replace(/[\s_-]/g, "");
}

function classifyStyle(styleId: string | undefined, outlineLevel: number | undefined): ParaRole | null {
  const s = normalizeStyleId(styleId);
  // Standard Word / Google Docs / Pages heading styles
  if (s === "heading1" || s === "title") return "h1";
  if (s === "heading2" || s === "subtitle") return "h2";
  if (s === "heading3") return "h3";
  if (s === "quote" || s === "intensequote" || s === "blockquote") return "quote";
  // Outline level fallback (Scrivener + custom heading styles that inherit)
  if (outlineLevel === 0) return "h1";
  if (outlineLevel === 1) return "h2";
  if (outlineLevel === 2) return "h3";
  return null;
}

interface NumMeta {
  format: "bullet" | "decimal" | "other";
}

function parseNumbering(numberingXml: string | undefined): Map<string, NumMeta> {
  const out = new Map<string, NumMeta>();
  if (!numberingXml) return out;
  // Map numId → abstractNumId
  const numToAbstract = new Map<string, string>();
  const numRe = /<w:num\b[^>]*w:numId="([^"]+)"[^>]*>([\s\S]*?)<\/w:num>/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(numberingXml))) {
    const aid = /<w:abstractNumId\s+w:val="([^"]+)"/.exec(m[2]);
    if (aid) numToAbstract.set(m[1], aid[1]);
  }
  // Map abstractNumId → first-level numFmt
  const absFmt = new Map<string, string>();
  const absRe = /<w:abstractNum\b[^>]*w:abstractNumId="([^"]+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
  while ((m = absRe.exec(numberingXml))) {
    const lvl0 = /<w:lvl\b[^>]*w:ilvl="0"[^>]*>([\s\S]*?)<\/w:lvl>/.exec(m[2]);
    const fmtMatch = lvl0 ? /<w:numFmt\s+w:val="([^"]+)"/.exec(lvl0[1]) : null;
    absFmt.set(m[1], fmtMatch?.[1] ?? "decimal");
  }
  for (const [numId, absId] of numToAbstract) {
    const fmt = absFmt.get(absId) ?? "decimal";
    const format: NumMeta["format"] =
      fmt === "bullet" ? "bullet" : fmt === "decimal" ? "decimal" : "other";
    out.set(numId, { format });
  }
  return out;
}

function parseRuns(pBody: string): { children: ACAInline[]; text: string; hasPageBreak: boolean } {
  const children: ACAInline[] = [];
  let text = "";
  let hasPageBreak = false;
  const rRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let m: RegExpExecArray | null;
  while ((m = rRe.exec(pBody))) {
    const rBody = m[1];
    if (/<w:br\b[^>]*w:type="page"/i.test(rBody)) hasPageBreak = true;
    const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(rBody);
    const isBold = rPr ? /<w:b(\s|\/)/.test(rPr[1]) && !/<w:b\s+w:val="0"/.test(rPr[1]) : false;
    const isItalic = rPr ? /<w:i(\s|\/)/.test(rPr[1]) && !/<w:i\s+w:val="0"/.test(rPr[1]) : false;
    const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let piece = "";
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(rBody))) piece += decode(t[1]);
    if (/<w:tab\b/.test(rBody)) piece += "\t";
    if (!piece) continue;
    text += piece;
    let node: ACAInline = { kind: "text", value: piece };
    if (isBold && isItalic) {
      node = { kind: "strong", children: [{ kind: "emphasis", children: [node] }] };
    } else if (isBold) {
      node = { kind: "strong", children: [node] };
    } else if (isItalic) {
      node = { kind: "emphasis", children: [node] };
    }
    children.push(node);
  }
  return { children, text, hasPageBreak };
}

function extractParagraphs(documentXml: string, numbering: Map<string, NumMeta>): RawPara[] {
  const out: RawPara[] = [];
  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(documentXml))) {
    const body = m[1];
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(body);
    const styleMatch = pPr ? /<w:pStyle\s+w:val="([^"]+)"/.exec(pPr[1]) : null;
    const outlineMatch = pPr ? /<w:outlineLvl\s+w:val="(\d+)"/.exec(pPr[1]) : null;
    const outlineLevel = outlineMatch ? Number(outlineMatch[1]) : undefined;
    const numIdMatch = pPr ? /<w:numPr>[\s\S]*?<w:numId\s+w:val="([^"]+)"/.exec(pPr[1]) : null;

    let role: ParaRole | null = classifyStyle(styleMatch?.[1], outlineLevel);
    let numberValue: number | undefined;
    if (!role && numIdMatch) {
      const meta = numbering.get(numIdMatch[1]);
      if (meta?.format === "bullet") role = "list-bullet";
      else role = "list-number";
    }
    if (!role) role = "body";

    const { children, text, hasPageBreak } = parseRuns(body);
    if (text.trim().length === 0 && !hasPageBreak) continue;
    out.push({ role, children, text: text.trim(), hasPageBreak, numberValue });
  }
  return out;
}

function readFrontmatter(
  customXml: string | undefined,
  paras: RawPara[],
): { fm: ACAFrontmatter; rest: RawPara[] } {
  const fields: Record<string, string> = {};
  if (customXml) {
    const re = /<property\b[^>]*\bname="ASCEND:([^"]+)"[^>]*>\s*<vt:[^>]+>([\s\S]*?)<\/vt:[^>]+>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(customXml))) fields[m[1].toLowerCase()] = decode(m[2]).trim();
  }
  let rest = paras;
  if (paras.length && /^---frontmatter---$/i.test(paras[0].text)) {
    let i = 1;
    for (; i < paras.length; i++) {
      if (/^---$/.test(paras[i].text)) {
        i += 1;
        break;
      }
      const kv = /^([a-zA-Z]+)\s*:\s*(.+)$/.exec(paras[i].text);
      if (kv) fields[kv[1].toLowerCase()] = kv[2].trim();
    }
    rest = paras.slice(i);
  }
  const fm = acaFrontmatter.parse({
    title: fields.title ?? "Untitled DOCX",
    slug: fields.slug ?? "untitled-docx",
    mode: (fields.mode as ACAFrontmatter["mode"]) ?? "web-reader",
    authors: fields.authors ? fields.authors.split(/\s*,\s*/) : ["Unknown"],
    eyebrow: fields.eyebrow || undefined,
    subtitle: fields.subtitle || undefined,
  });
  return { fm, rest };
}

function inlineText(nodes: ACAInline[]): string {
  return nodes
    .map((n) => {
      if (n.kind === "text") return n.value;
      if (n.kind === "code") return n.value;
      if ("children" in n && Array.isArray(n.children)) return inlineText(n.children as ACAInline[]);
      return "";
    })
    .join("");
}

function paragraphsToBlocks(paras: RawPara[]): ACABlock[] {
  const blocks: ACABlock[] = [];
  let i = 0;
  let listCounter = 0;

  while (i < paras.length) {
    const p = paras[i];

    // Emit a scene-break for a page break that lives on an otherwise-empty paragraph.
    if (p.hasPageBreak && p.text.length === 0) {
      blocks.push({ kind: "scene-break" });
      i += 1;
      continue;
    }

    switch (p.role) {
      case "h1":
        blocks.push({ kind: "chapter-opener", title: p.children });
        break;
      case "h2":
      case "h3":
        blocks.push({ kind: "section", title: p.children, children: [] });
        break;
      case "quote":
        blocks.push({ kind: "pullquote", children: p.children });
        break;
      case "list-bullet": {
        const prefix: ACAInline = { kind: "text", value: "• " };
        blocks.push({ kind: "body", children: [prefix, ...p.children] });
        listCounter = 0;
        break;
      }
      case "list-number": {
        listCounter += 1;
        const prefix: ACAInline = { kind: "text", value: `${listCounter}. ` };
        blocks.push({ kind: "body", children: [prefix, ...p.children] });
        break;
      }
      case "body":
      default:
        blocks.push({ kind: "body", children: p.children });
        listCounter = 0;
        break;
    }

    if (p.role !== "list-bullet" && p.role !== "list-number") listCounter = 0;

    // Trailing page break inside a content paragraph → scene-break after it.
    if (p.hasPageBreak && p.text.length > 0) {
      blocks.push({ kind: "scene-break" });
    }
    i += 1;
  }

  // Prevent unused-var warning under strict TS.
  void inlineText;
  return blocks;
}

export function parseDocx(bytes: Uint8Array): ACADocument {
  const unzipped = unzipSync(bytes);
  const docXml = unzipped["word/document.xml"];
  if (!docXml) throw new Error("DOCX missing word/document.xml");

  const documentXml = strFromU8(docXml);
  const numberingXml = unzipped["word/numbering.xml"]
    ? strFromU8(unzipped["word/numbering.xml"])
    : undefined;
  const customXml = unzipped["docProps/custom.xml"]
    ? strFromU8(unzipped["docProps/custom.xml"])
    : undefined;

  const numbering = parseNumbering(numberingXml);
  const paras = extractParagraphs(documentXml, numbering);
  const { fm, rest } = readFrontmatter(customXml, paras);
  const blocks = paragraphsToBlocks(rest);

  return {
    frontmatter: fm,
    blocks,
    footnotes: [],
  };
}
