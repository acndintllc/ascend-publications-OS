/* Kobo Writing Life — JSON envelope. */
import type { PublicationMetadata } from "../metadata";
import type { SerializedPayload } from "./index";
import { requireFields } from "./_shared";

export function koboSerializer(meta: PublicationMetadata, slug: string): SerializedPayload {
  const issues = requireFields(meta,
    ["title","author","description","categories","language"], "kobo");
  const body = {
    platform: "kobo",
    slug,
    metadata: {
      title: meta.title,
      subtitle: meta.subtitle ?? undefined,
      synopsis: meta.description,
      author: meta.author,
      contributors: meta.contributors,
      categories: meta.categories,
      keywords: meta.keywords,
      language: meta.language,
      publisher: meta.publisher,
      isbn: meta.isbn ?? null,
      publication_date: meta.publicationDate ?? null,
      audience: meta.audience ?? null,
    },
  };
  return {
    target: "kobo",
    format: "json",
    mediaType: "application/json",
    filename: `${slug}.kobo.json`,
    body: JSON.stringify(body, null, 2),
    issues,
  };
}
