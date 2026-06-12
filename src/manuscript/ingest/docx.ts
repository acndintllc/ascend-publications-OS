/* ASCEND DOCX → ACA ingest (PTL-008 §2, Phase 6B).

   Worker-safe: fflate for unzip + regex extraction of word/document.xml.
   No DOM, no native deps, no Node-only libs.

   ASCEND DOCX authoring convention — paragraph styles drive mapping:

     AM-ChapterTitle    → chapter-opener (with optional preceding AM-Eyebrow)
     AM-Eyebrow         → folded into the next chapter-opener
     AM-SectionTitle    → section (title only — siblings group under it)
     AM-PullQuote       → pullquote (cite via "— Author" suffix)
     AM-Dialogue        → dialogue ("Speaker: line" → speaker + body)
     AM-Sidebar         → sidebar (consecutive AM-Sidebar paras group)
     AM-Callout         → callout (consecutive group)
     AM-Citation        → citation
     AM-Report          → report (consecutive group)
     AM-SceneBreak      → scene-break
     (any other / Normal)→ body

   Frontmatter: read from docProps/custom.xml (ASCEND:* properties)
   or from a leading "---frontmatter---" paragraph block. */
import { unzipSync, strFromU8 } from "fflate";
import { acaFrontmatter, type ACABlock, type ACADocument, type ACAFrontmatter } from "../schema/aca";

const STYLE_MAP = {
  "AM-ChapterTitle": "chapter-opener",
  "AM-Eyebrow": "eyebrow",
  "AM-SectionTitle": "section-title",
  "AM-PullQuote": "pullquote",
  "AM-Dialogue": "dialogue",
  "AM-Sidebar": "sidebar",
  "AM-Callout": "callout",
  "AM-Citation": "citation",
  "AM-Report": "report",
  "AM-SceneBreak": "scene-break",
} as const;
type StyleRole = (typeof STYLE_MAP)[keyof typeof STYLE_MAP] | "body";

interface RawPara {
  role: StyleRole;
  text: string;
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

function extractParagraphs(documentXml: string): RawPara[] {
  const out: RawPara[] = [];
  // Match each <w:p ...>...</w:p>
  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(documentXml))) {
    const body = m[1];
    // Style: <w:pStyle w:val="AM-..."/>
    const styleMatch = /<w:pStyle\s+w:val="([^"]+)"/.exec(body);
    const styleName = styleMatch?.[1];
    const role: StyleRole =
      styleName && styleName in STYLE_MAP
        ? STYLE_MAP[styleName as keyof typeof STYLE_MAP]
        : "body";

    // Text: concatenate every <w:t>…</w:t> in document order
    const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let text = "";
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(body))) text += decode(t[1]);

    if (role === "scene-break" || text.trim().length > 0) {
      out.push({ role, text: text.trim() });
    }
  }
  return out;
}

function readFrontmatter(
  customXml: string | undefined,
  paras: RawPara[],
): { fm: ACAFrontmatter; rest: RawPara[] } {
  const fields: Record<string, string> = {};

  // 1. docProps/custom.xml — <property name="ASCEND:title"><vt:lpwstr>...</vt:lpwstr></property>
  if (customXml) {
    const re = /<property\b[^>]*\bname="ASCEND:([^"]+)"[^>]*>\s*<vt:[^>]+>([\s\S]*?)<\/vt:[^>]+>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(customXml))) {
      fields[m[1].toLowerCase()] = decode(m[2]).trim();
    }
  }

  // 2. Inline ---frontmatter--- block as the first paragraph(s)
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

function paragraphsToBlocks(paras: RawPara[]): ACABlock[] {
  const blocks: ACABlock[] = [];
  let pendingEyebrow: string | undefined;
  let i = 0;

  const consumeGroup = (
    role: "sidebar" | "callout" | "report",
  ): ACABlock => {
    const children: ACABlock[] = [];
    while (i < paras.length && paras[i].role === role) {
      children.push({ kind: "body", children: [{ kind: "text", value: paras[i].text }] });
      i += 1;
    }
    return { kind: role, children };
  };

  while (i < paras.length) {
    const p = paras[i];
    switch (p.role) {
      case "eyebrow":
        pendingEyebrow = p.text;
        i += 1;
        break;
      case "chapter-opener":
        blocks.push({
          kind: "chapter-opener",
          eyebrow: pendingEyebrow,
          title: [{ kind: "text", value: p.text }],
        });
        pendingEyebrow = undefined;
        i += 1;
        break;
      case "section-title":
        blocks.push({
          kind: "section",
          title: [{ kind: "text", value: p.text }],
          children: [],
        });
        i += 1;
        break;
      case "pullquote": {
        const cm = /^(.*?)\s+—\s+(.+)$/.exec(p.text);
        blocks.push({
          kind: "pullquote",
          cite: cm?.[2],
          children: [{ kind: "text", value: cm ? cm[1] : p.text }],
        });
        i += 1;
        break;
      }
      case "dialogue": {
        const dm = /^([^:]{1,40}):\s*(.+)$/.exec(p.text);
        blocks.push({
          kind: "dialogue",
          speaker: dm?.[1],
          children: [{ kind: "text", value: dm ? dm[2] : p.text }],
        });
        i += 1;
        break;
      }
      case "citation":
        blocks.push({ kind: "citation", value: p.text });
        i += 1;
        break;
      case "scene-break":
        blocks.push({ kind: "scene-break" });
        i += 1;
        break;
      case "sidebar":
      case "callout":
      case "report":
        blocks.push(consumeGroup(p.role));
        break;
      case "body":
      default:
        blocks.push({ kind: "body", children: [{ kind: "text", value: p.text }] });
        i += 1;
        break;
    }
  }
  return blocks;
}

export function parseDocx(bytes: Uint8Array): ACADocument {
  const unzipped = unzipSync(bytes);
  const docXml = unzipped["word/document.xml"];
  if (!docXml) throw new Error("DOCX missing word/document.xml");

  const documentXml = strFromU8(docXml);
  const customXml = unzipped["docProps/custom.xml"]
    ? strFromU8(unzipped["docProps/custom.xml"])
    : undefined;

  const paras = extractParagraphs(documentXml);
  const { fm, rest } = readFrontmatter(customXml, paras);
  const blocks = paragraphsToBlocks(rest);

  return {
    frontmatter: fm,
    blocks,
    footnotes: [],
  };
}
