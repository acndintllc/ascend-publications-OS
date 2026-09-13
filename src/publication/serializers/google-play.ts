/* Google Play Books — ONIX-flavored JSON envelope (Google accepts ONIX 3.0
   uploads + a JSON sidecar for partner-center automation). */
import type { PublicationMetadata } from "../metadata";
import type { SerializedPayload } from "./index";
import { requireFields } from "./_shared";

export function googlePlaySerializer(meta: PublicationMetadata, slug: string): SerializedPayload {
  const issues = requireFields(meta,
    // ISBN deliberately absent: google-play-books does not require one (see
    // preflight/catalogue.ts, rule `isbn.not-required-for-retail`).
    ["title","author","description","categories","language"], "google-play-books");
  const body = {
    platform: "google-play-books",
    slug,
    book: {
      identifiers: { isbn: meta.isbn ?? null, internal_slug: slug },
      title: meta.title,
      subtitle: meta.subtitle ?? null,
      description: meta.description,
      authors: [meta.author, ...meta.contributors],
      categories: meta.categories,
      keywords: meta.keywords,
      language: meta.language,
      publisher: meta.publisher,
      publication_date: meta.publicationDate ?? null,
      audience: meta.audience ?? null,
      rights: meta.rights ?? null,
    },
  };
  return {
    target: "google-play-books",
    format: "json",
    mediaType: "application/json",
    filename: `${slug}.google-play.json`,
    body: JSON.stringify(body, null, 2),
    issues,
  };
}
