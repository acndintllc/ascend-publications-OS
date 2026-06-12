/* PTL-020 Phase 8B — Metadata Engine
   Distribution-agnostic publication metadata with adapters for major
   storefronts (KDP, Apple Books, Kobo, Draft2Digital, Google Play). */
import { z } from "zod";

export const readingLevel = z.enum([
  "early-reader",
  "middle-grade",
  "young-adult",
  "general-adult",
  "academic",
  "professional",
]);
export type ReadingLevel = z.infer<typeof readingLevel>;

export const audience = z.enum([
  "children",
  "teen",
  "adult",
  "educator",
  "researcher",
  "professional",
]);
export type Audience = z.infer<typeof audience>;

export const publicationMetadataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),   // BISAC / store-agnostic
  author: z.string().min(1),
  contributors: z.array(z.string()).default([]),
  series: z.string().optional(),
  volumeNumber: z.number().int().positive().optional(),
  language: z.string().default("en"),
  readingLevel: readingLevel.optional(),
  audience: audience.optional(),
  publicationDate: z.string().optional(),         // ISO date
  isbn: z.string().optional(),                    // placeholder until assigned
  rights: z.string().optional(),
  publisher: z.string().default("ASCEND Media"),
});
export type PublicationMetadata = z.infer<typeof publicationMetadataSchema>;

/** Storefront target identifiers — used by adapters for downstream emit. */
export const DISTRIBUTION_TARGETS = [
  "kdp",            // Kindle Direct Publishing
  "apple-books",
  "kobo",
  "draft2digital",
  "google-play-books",
] as const;
export type DistributionTarget = (typeof DISTRIBUTION_TARGETS)[number];

export interface AdapterIssue {
  level: "error" | "warning";
  field: string;
  message: string;
}

export interface AdapterResult<T> {
  target: DistributionTarget;
  payload: T;
  issues: AdapterIssue[];
}

/** Minimum field requirements per storefront. Architecture-first; payloads
 *  intentionally generic — storefront-specific XML/JSON happens at emit. */
const TARGET_REQUIREMENTS: Record<DistributionTarget, (keyof PublicationMetadata)[]> = {
  "kdp":                 ["title", "author", "description", "keywords", "categories", "language"],
  "apple-books":         ["title", "author", "description", "categories", "language", "isbn"],
  "kobo":                ["title", "author", "description", "categories", "language"],
  "draft2digital":       ["title", "author", "description", "categories", "language"],
  "google-play-books":   ["title", "author", "description", "categories", "language", "isbn"],
};

export function adaptForTarget(
  meta: PublicationMetadata,
  target: DistributionTarget,
): AdapterResult<PublicationMetadata> {
  const issues: AdapterIssue[] = [];
  for (const field of TARGET_REQUIREMENTS[target]) {
    const v = meta[field];
    const missing = v === undefined || v === null || (Array.isArray(v) && v.length === 0) || v === "";
    if (missing) {
      issues.push({
        level: field === "isbn" ? "warning" : "error",
        field: String(field),
        message: `${target}: missing required field "${String(field)}"`,
      });
    }
  }
  if (target === "kdp" && meta.keywords.length > 7) {
    issues.push({ level: "warning", field: "keywords", message: "KDP allows up to 7 keywords" });
  }
  return { target, payload: meta, issues };
}

export function adaptForAllTargets(meta: PublicationMetadata): AdapterResult<PublicationMetadata>[] {
  return DISTRIBUTION_TARGETS.map((t) => adaptForTarget(meta, t));
}
