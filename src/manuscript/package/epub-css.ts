/* Flattened EPUB3 stylesheet (PTL-015 Phase 5A).
   EPUB readers vary in CSS-variable support (Kindle KF8 has
   none; iBooks/ADE are partial). This module emits a single
   stylesheet with TIER-2 values inlined — no var() chains. */
export function manuscriptCSS(): string {
  return `@charset "UTF-8";
@namespace epub "http://www.idpf.org/2007/ops";

html, body {
  margin: 0;
  padding: 0;
  font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
  font-size: 1em;
  line-height: 1.65;
  color: #1a1a1a;
  background: #ffffff;
}

main {
  max-width: 36em;
  margin: 0 auto;
  padding: 1.5em 1em;
}

/* Chapter opener */
.am-chapter-opener {
  margin-bottom: 3em;
  text-align: left;
  page-break-after: avoid;
  break-after: avoid;
}
.am-eyebrow {
  font-family: "Inter Tight", -apple-system, sans-serif;
  font-size: 0.75em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  margin: 0 0 0.75em 0;
}
.am-chapter-title {
  font-family: "Fraunces", Georgia, serif;
  font-size: 2.4em;
  line-height: 1.15;
  font-weight: 600;
  margin: 0 0 0.5em 0;
  letter-spacing: -0.02em;
  page-break-after: avoid;
  break-after: avoid;
}

.am-section {
  margin-bottom: 2em;
}
.am-section-title {
  font-family: "Fraunces", Georgia, serif;
  font-size: 1.5em;
  font-weight: 600;
  margin: 2em 0 0.75em 0;
  page-break-after: avoid;
  break-after: avoid;
}

/* Body */
.am-body {
  margin: 0 0 1em 0;
  text-indent: 1.25em;
  text-align: justify;
  hyphens: auto;
}
.am-body:first-of-type,
.am-section > .am-body:first-of-type,
.am-chapter-opener + .am-body {
  text-indent: 0;
}

/* Dialogue */
.am-dialogue {
  margin: 0 0 1em 0;
  text-indent: 1.25em;
}
.am-speaker {
  font-weight: 600;
  font-variant: small-caps;
}

/* Pullquote */
.am-pullquote {
  margin: 1.5em 0;
  padding: 0.5em 0 0.5em 1em;
  border-left: 3px solid #b8895a;
  font-family: "Fraunces", Georgia, serif;
  font-size: 1.2em;
  font-style: italic;
  line-height: 1.4;
  color: #333;
  page-break-inside: avoid;
  break-inside: avoid;
}
.am-pullquote cite {
  display: block;
  margin-top: 0.5em;
  font-family: "Inter Tight", sans-serif;
  font-size: 0.7em;
  font-style: normal;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #666;
}

/* Sidebar / callout */
.am-sidebar, .am-callout {
  margin: 1.5em 0;
  padding: 1em 1.25em;
  background: #f5f1ea;
  border-radius: 4px;
  font-family: "Inter Tight", sans-serif;
  font-size: 0.9em;
  page-break-inside: avoid;
  break-inside: avoid;
}
.am-sidebar h3 {
  font-family: "Fraunces", Georgia, serif;
  font-size: 1em;
  margin: 0 0 0.75em 0;
}

/* VERA Interpretation block (Phase 2 — editorial) */
.am-vera {
  margin: 1.5em 0;
  padding: 1em 0;
  border-top: 1px solid #c9c4ba;
  border-bottom: 1px solid #c9c4ba;
  font-family: "Inter Tight", sans-serif;
  font-size: 0.9em;
  color: #2a2a2a;
  page-break-inside: avoid;
  break-inside: avoid;
}
.am-vera-label {
  margin: 0 0 0.5em 0;
  font-size: 0.7em;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6a6a6a;
}
.am-vera-mark {
  font-weight: 600;
  color: #1a1a1a;
}
.am-vera-title {
  margin: 0 0 0.5em 0;
  font-family: "Fraunces", Georgia, serif;
  font-size: 1.05em;
  font-weight: 600;
  color: #111;
  line-height: 1.25;
}
.am-vera-body p {
  margin: 0;
  line-height: 1.55;
}
.am-vera-source {
  margin: 0.75em 0 0 0;
  font-size: 0.72em;
  letter-spacing: 0.08em;
  color: #6a6a6a;
}

/* Citation block */
.am-citation {
  margin: 1em 0;
  padding: 0.75em 1em;
  font-family: "Inter Tight", sans-serif;
  font-size: 0.85em;
  color: #555;
  border-top: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
}

/* Report */
.am-report {
  margin: 1.5em 0;
  padding: 1em;
  background: #f5f5f5;
  font-family: "Inter Tight", sans-serif;
  font-size: 0.9em;
}

/* Scene break */
.am-scene-break {
  border: none;
  height: 1em;
  margin: 2em auto;
  text-align: center;
}
.am-scene-break::after {
  content: "* * *";
  display: block;
  color: #888;
  letter-spacing: 0.5em;
}

/* Footnotes / bibliography */
.am-footnotes, .am-bibliography {
  margin-top: 3em;
  padding-top: 1.5em;
  border-top: 1px solid #ccc;
  font-size: 0.8em;
}
.am-footnotes h2, .am-bibliography h2 {
  font-family: "Fraunces", Georgia, serif;
  font-size: 1.2em;
  font-weight: 600;
}
.am-footnotes aside, .am-bib-entry {
  margin: 0.5em 0;
  line-height: 1.5;
}

/* Links */
a { color: #8b4513; text-decoration: none; }
a:hover { text-decoration: underline; }

/* Page breaks */
main > .am-chapter-opener { page-break-before: always; break-before: page; }
`;
}
