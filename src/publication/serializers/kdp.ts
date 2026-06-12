/* Amazon KDP serializer — JSON envelope mirroring the KDP create-book payload.
   Real KDP uses a manual upload UI; this JSON is the staging format consumed
   by an external runner that drives KDP automation. */
import type { PublicationMetadata } from "../metadata";
import type { SerializedPayload } from "./index";
import { requireFields } from "./_shared";

export function kdpSerializer(meta: PublicationMetadata, slug: string): SerializedPayload {
  const issues = requireFields(meta,
    ["title","author","description","keywords","categories","language"], "kdp");
  if (meta.keywords.length > 7) {
    issues.push({ level: "warning", field: "keywords", message: "KDP allows up to 7 keywords" });
  }
  if (meta.description && meta.description.length > 4000) {
    issues.push({ level: "warning", field: "description", message: "KDP description limit is 4000 characters" });
  }
  const body = {
    platform: "amazon-kdp",
    slug,
    book: {
      title: meta.title,
      subtitle: meta.subtitle ?? null,
      series: meta.series ?? null,
      volume: meta.volumeNumber ?? null,
      description: meta.description,
      keywords: meta.keywords.slice(0, 7),
      categories: meta.categories,
      contributors: [{ role: "author", name: meta.author }, ...meta.contributors.map((c) => ({ role: "contributor", name: c }))],
      language: meta.language,
      publisher: meta.publisher,
      isbn: meta.isbn ?? null,
      publication_date: meta.publicationDate ?? null,
      audience: meta.audience ?? null,
      reading_level: meta.readingLevel ?? null,
      rights: meta.rights ?? null,
    },
  };
  return {
    target: "kdp",
    format: "json",
    mediaType: "application/json",
    filename: `${slug}.kdp.json`,
    body: JSON.stringify(body, null, 2),
    issues,
  };
}
