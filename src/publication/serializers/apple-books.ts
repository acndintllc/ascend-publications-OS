/* Apple Books — itmsp-style XML metadata. Apple Books requires ISBN. */
import type { PublicationMetadata } from "../metadata";
import type { SerializedPayload } from "./index";
import { requireFields, xmlEsc } from "./_shared";

export function appleBooksSerializer(meta: PublicationMetadata, slug: string): SerializedPayload {
  const issues = requireFields(meta,
    // ISBN deliberately absent: apple-books does not require one (see
    // preflight/catalogue.ts, rule `isbn.not-required-for-retail`).
    ["title","author","description","categories","language"], "apple-books");
  const contribs = [
    `<contributor role="author"><name>${xmlEsc(meta.author)}</name></contributor>`,
    ...meta.contributors.map((c) => `<contributor role="contributor"><name>${xmlEsc(c)}</name></contributor>`),
  ].join("\n      ");
  const cats = meta.categories.map((c) => `<category>${xmlEsc(c)}</category>`).join("\n      ");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://apple.com/itunes/importer" version="book5.3">
  <provider>ASCEND_MEDIA</provider>
  <book>
    <vendor_id>${xmlEsc(slug)}</vendor_id>
    <isbn>${xmlEsc(meta.isbn ?? "")}</isbn>
    <title>${xmlEsc(meta.title)}</title>
    ${meta.subtitle ? `<subtitle>${xmlEsc(meta.subtitle)}</subtitle>` : ""}
    <description>${xmlEsc(meta.description)}</description>
    <language>${xmlEsc(meta.language)}</language>
    <publisher>${xmlEsc(meta.publisher)}</publisher>
    ${meta.publicationDate ? `<publication_date>${xmlEsc(meta.publicationDate)}</publication_date>` : ""}
    <contributors>
      ${contribs}
    </contributors>
    <categories>
      ${cats}
    </categories>
  </book>
</package>`;
  return {
    target: "apple-books",
    format: "xml",
    mediaType: "application/xml",
    filename: `${slug}.apple-books.xml`,
    body,
    issues,
  };
}
