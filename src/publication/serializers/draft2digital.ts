/* Draft2Digital — JSON envelope mirroring D2D's book upload structure. */
import type { PublicationMetadata } from "../metadata";
import type { SerializedPayload } from "./index";
import { requireFields } from "./_shared";

export function d2dSerializer(meta: PublicationMetadata, slug: string): SerializedPayload {
  const issues = requireFields(meta,
    ["title","author","description","categories","language"], "draft2digital");
  const body = {
    platform: "draft2digital",
    slug,
    book: {
      title: meta.title,
      subtitle: meta.subtitle ?? null,
      description: meta.description,
      primary_author: meta.author,
      additional_contributors: meta.contributors,
      categories: meta.categories,
      keywords: meta.keywords,
      language: meta.language,
      publisher: meta.publisher,
      isbn: meta.isbn ?? null,
      series: meta.series ?? null,
      volume: meta.volumeNumber ?? null,
      publication_date: meta.publicationDate ?? null,
    },
    distribution: ["amazon","apple","kobo","barnes-noble","google-play","tolino","scribd"],
  };
  return {
    target: "draft2digital",
    format: "json",
    mediaType: "application/json",
    filename: `${slug}.draft2digital.json`,
    body: JSON.stringify(body, null, 2),
    issues,
  };
}
