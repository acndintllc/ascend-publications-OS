/* Kindle (KF8) flattened stylesheet (PTL-016 Phase 5B).
   More conservative than the generic EPUB3 sheet:
   - no CSS custom properties (KF8 has zero support)
   - no flexbox / grid (KF8 ignores both silently)
   - no hyphens (KF8 ignores; can cause spacing artifacts)
   - tighter system font stacks; Bookerly fallback first
   - explicit page-break hints (KindleGen honors the legacy props)
*/
export function kindleCSS(): string {
  return `@charset "UTF-8";
@namespace epub "http://www.idpf.org/2007/ops";

html, body {
  margin: 0;
  padding: 0;
  font-family: "Bookerly", "Source Serif 4", Georgia, "Times New Roman", serif;
  font-size: 1em;
  line-height: 1.55;
  color: #1a1a1a;
}

main { display: block; margin: 0 auto; padding: 1em; }

.am-chapter-opener {
  margin-bottom: 2.5em;
  page-break-after: avoid;
}
.am-eyebrow {
  font-size: 0.75em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  margin: 0 0 0.5em 0;
}
.am-chapter-title {
  font-size: 1.9em;
  line-height: 1.2;
  font-weight: bold;
  margin: 0 0 0.5em 0;
  page-break-after: avoid;
}

.am-section { margin-bottom: 1.5em; }
.am-section-title {
  font-size: 1.3em;
  font-weight: bold;
  margin: 1.5em 0 0.5em 0;
  page-break-after: avoid;
}

.am-body {
  margin: 0 0 0.75em 0;
  text-indent: 1.25em;
  text-align: justify;
}
.am-body:first-of-type,
.am-section > .am-body:first-of-type,
.am-chapter-opener + .am-body { text-indent: 0; }

.am-dialogue { margin: 0 0 0.75em 0; text-indent: 1.25em; }
.am-speaker { font-weight: bold; }

.am-pullquote {
  margin: 1.25em 1em;
  padding: 0.5em 0 0.5em 0.75em;
  border-left: 3px solid #999;
  font-style: italic;
  page-break-inside: avoid;
}
.am-pullquote cite {
  display: block;
  margin-top: 0.5em;
  font-size: 0.75em;
  font-style: normal;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #555;
}

.am-sidebar, .am-callout {
  margin: 1.25em 0;
  padding: 0.75em 1em;
  border: 1px solid #ccc;
  font-size: 0.9em;
  page-break-inside: avoid;
}
.am-sidebar h3 { font-size: 1em; margin: 0 0 0.5em 0; font-weight: bold; }

.am-vera {
  margin: 1em 0;
  padding: 0.75em 0.875em;
  border-left: 3px solid #8b5a3c;
  font-size: 0.85em;
  page-break-inside: avoid;
}
.am-vera-label {
  margin: 0 0 0.4em 0;
  font-size: 0.7em;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #8b5a3c;
}

.am-citation {
  margin: 1em 0;
  padding: 0.5em 0;
  font-size: 0.85em;
  border-top: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
}

.am-report {
  margin: 1.25em 0;
  padding: 0.75em;
  border: 1px solid #ccc;
  font-size: 0.9em;
}

.am-scene-break {
  border: none;
  height: 1em;
  margin: 1.5em auto;
  text-align: center;
}
.am-scene-break::after {
  content: "* * *";
  display: block;
  color: #888;
  letter-spacing: 0.4em;
}

.am-footnotes, .am-bibliography {
  margin-top: 2em;
  padding-top: 1em;
  border-top: 1px solid #ccc;
  font-size: 0.8em;
}
.am-footnotes h2, .am-bibliography h2 {
  font-size: 1.1em;
  font-weight: bold;
}

a { color: #444; text-decoration: underline; }

/* Kindle page-break hints */
main > .am-chapter-opener { page-break-before: always; }
`;
}
