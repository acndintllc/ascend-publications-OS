/* ACA → XHTML serializer for EPUB3 (PTL-015 Phase 5A).
   Pure string emission — no React, no DOM. EPUB3 requires
   well-formed XHTML, so all tags self-close where appropriate
   and attribute values are double-quoted + escaped. */
import type { ACABlock, ACADocument, ACAInline } from "../schema/aca";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function inline(nodes: ACAInline[]): string {
  return nodes
    .map((n) => {
      switch (n.kind) {
        case "text":
          return esc(n.value);
        case "emphasis":
          return `<em>${inline(n.children)}</em>`;
        case "strong":
          return `<strong>${inline(n.children)}</strong>`;
        case "code":
          return `<code>${esc(n.value)}</code>`;
        case "link":
          return `<a href="${esc(n.href)}">${inline(n.children)}</a>`;
        case "footnote-ref":
          return `<sup><a epub:type="noteref" href="#fn-${esc(n.id)}" id="fnref-${esc(n.id)}">[${esc(n.id)}]</a></sup>`;
        case "citation-ref": {
          const label = n.resolved?.author?.split(",")[0] ?? n.key;
          const year = n.resolved?.year ? ` ${n.resolved.year}` : "";
          return `<sup><a href="#bib-${esc(n.key)}">[${esc(label)}${esc(year)}]</a></sup>`;
        }
      }
    })
    .join("");
}

function block(b: ACABlock): string {
  switch (b.kind) {
    case "chapter-opener":
      return `<header class="am-chapter-opener"${b.eyebrow ? "" : ""}>${
        b.eyebrow ? `<p class="am-eyebrow">${esc(b.eyebrow)}</p>` : ""
      }<h1 class="am-chapter-title">${inline(b.title)}</h1></header>`;
    case "section":
      return `<section class="am-section">${
        b.title ? `<h2 class="am-section-title">${inline(b.title)}</h2>` : ""
      }${b.children.map(block).join("")}</section>`;
    case "body": {
      const vera = b.vera
        ? `<aside class="am-vera" epub:type="annotation"><p class="am-vera-label">${esc(b.vera.voice)} · ${esc(b.vera.id)}</p><p>${esc(b.vera.body)}</p></aside>`
        : "";
      return `<p class="am-body">${inline(b.children)}</p>${vera}`;
    }
    case "dialogue":
      return `<p class="am-dialogue">${b.speaker ? `<span class="am-speaker">${esc(b.speaker)}: </span>` : ""}${inline(b.children)}</p>`;
    case "pullquote":
      return `<blockquote class="am-pullquote">${inline(b.children)}${b.cite ? `<cite>${esc(b.cite)}</cite>` : ""}</blockquote>`;
    case "sidebar":
      return `<aside class="am-sidebar" epub:type="sidebar">${b.title ? `<h3>${esc(b.title)}</h3>` : ""}${b.children.map(block).join("")}</aside>`;
    case "callout":
      return `<aside class="am-callout">${b.children.map(block).join("")}</aside>`;
    case "citation":
      return `<p class="am-citation">${esc(b.value)}</p>`;
    case "report":
      return `<section class="am-report">${b.children.map(block).join("")}</section>`;
    case "scene-break":
      return `<hr class="am-scene-break" />`;
    case "footnote":
      return "";
  }
}

export function renderChapterXHTML(doc: ACADocument): string {
  const body = doc.blocks.map(block).join("\n");
  const fns = doc.footnotes.length
    ? `<section class="am-footnotes" epub:type="footnotes"><h2>Footnotes</h2>${doc.footnotes
        .map(
          (f) =>
            `<aside id="fn-${esc(f.id)}" epub:type="footnote"><p><strong>[${esc(f.id)}]</strong> ${inline(f.children)} <a href="#fnref-${esc(f.id)}">↩</a></p></aside>`,
        )
        .join("")}</section>`
    : "";
  const bib = doc.enrichment?.bibliography?.length
    ? `<section class="am-bibliography" epub:type="bibliography"><h2>Bibliography</h2>${doc.enrichment.bibliography
        .map(
          (e) =>
            `<p id="bib-${esc(e.key)}" class="am-bib-entry"><strong>[${esc(e.key)}]</strong> ${esc(
              [e.author, e.year && `(${e.year})`, e.title, e.source].filter(Boolean).join(". "),
            )}</p>`,
        )
        .join("")}</section>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(doc.frontmatter.title)}</title>
<link rel="stylesheet" type="text/css" href="../styles/manuscript.css" />
</head>
<body>
<main epub:type="chapter">
${body}
${fns}
${bib}
</main>
</body>
</html>`;
}
