/* EPUB3 OEBPS zip packager (PTL-015 Phase 5A).
   Pure-JS via fflate — Worker-safe (no native deps).
   Produces a valid EPUB3 archive in-memory as Uint8Array. */
import { zipSync, strToU8, type Zippable } from "fflate";
import type { ACADocument } from "../schema/aca";
import { renderChapterXHTML } from "./epub-xhtml";
import { manuscriptCSS } from "./epub-css";

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function uuid(slug: string): string {
  // Deterministic-ish UUID v5-style fallback; sufficient as EPUB UID.
  return `urn:uuid:ascend-${slug}-${Date.now().toString(36)}`;
}

function contentOPF(doc: ACADocument, uid: string): string {
  const fm = doc.frontmatter;
  const authors = fm.authors
    .map((a, i) => `<dc:creator id="creator-${i}">${esc(a)}</dc:creator>`)
    .join("\n    ");
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${esc(uid)}</dc:identifier>
    <dc:title>${esc(fm.title)}</dc:title>
    <dc:language>en</dc:language>
    ${authors}
    ${fm.subtitle ? `<dc:description>${esc(fm.subtitle)}</dc:description>` : ""}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="chapter" href="text/chapter.xhtml" media-type="application/xhtml+xml" />
    <item id="css" href="styles/manuscript.css" media-type="text/css" />
  </manifest>
  <spine>
    <itemref idref="chapter" />
  </spine>
</package>`;
}

function navXHTML(doc: ACADocument): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<meta charset="UTF-8" />
<title>${esc(doc.frontmatter.title)} — Contents</title>
</head>
<body>
<nav epub:type="toc" id="toc">
  <h1>Contents</h1>
  <ol>
    <li><a href="text/chapter.xhtml">${esc(doc.frontmatter.title)}</a></li>
  </ol>
</nav>
</body>
</html>`;
}

export interface EpubArtifact {
  filename: string;
  bytes: Uint8Array;
  mediaType: "application/epub+zip";
}

export function buildEpub(doc: ACADocument): EpubArtifact {
  const uid = uuid(doc.frontmatter.slug);
  const files: Zippable = {
    // mimetype MUST be first and stored (uncompressed) per EPUB spec.
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(CONTAINER_XML),
    "OEBPS/content.opf": strToU8(contentOPF(doc, uid)),
    "OEBPS/nav.xhtml": strToU8(navXHTML(doc)),
    "OEBPS/text/chapter.xhtml": strToU8(renderChapterXHTML(doc)),
    "OEBPS/styles/manuscript.css": strToU8(manuscriptCSS()),
  };
  const bytes = zipSync(files);
  return {
    filename: `${doc.frontmatter.slug}.epub`,
    bytes,
    mediaType: "application/epub+zip",
  };
}
