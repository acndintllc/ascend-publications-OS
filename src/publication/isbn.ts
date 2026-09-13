/* PTL-025 Phase 14B — ISBN registry vocabulary + validation.
   Pure module (no server deps). */
import type { DistributionTarget } from "./metadata";

export const ISBN_FORMATS = ["ebook", "print", "audiobook", "pdf", "kindle"] as const;
export type IsbnFormat = (typeof ISBN_FORMATS)[number];

export const ISBN_STATUSES = ["reserved", "assigned", "registered", "retired"] as const;
export type IsbnStatus = (typeof ISBN_STATUSES)[number];

export interface IsbnRow {
  id: string;
  slug: string;
  isbn: string;
  edition: string;
  format: IsbnFormat | string;
  status: IsbnStatus | string;
  assigned_at: string;
  notes: string | null;
}

/** Platforms that require an ISBN to publish.
 *
 *  Empty, and verified so on 2026-09-13 (see preflight/catalogue.ts,
 *  rule `isbn.not-required-for-retail`). None of the supported retail
 *  destinations require an ISBN — each assigns its own identifier when
 *  none is supplied: Amazon an ASIN, Kobo its own number, Google a GGKEY.
 *  Apple accepts an ISBN-13 but does not require one for direct
 *  publishing. This list previously named apple-books and
 *  google-play-books, which raised a readiness blocker against authors
 *  who could in fact publish. */
export const ISBN_REQUIRED_TARGETS: DistributionTarget[] = [];

/** Platforms that accept but don't require ISBN. */
export const ISBN_OPTIONAL_TARGETS: DistributionTarget[] = [
  "kdp",
  "apple-books",
  "kobo",
  "google-play-books",
  "draft2digital",
];

/** Validate ISBN-13 with checksum; accept hyphenated input. */
export function isValidIsbn13(raw: string): boolean {
  const s = raw.replace(/[-\s]/g, "");
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(s[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(s[12], 10);
}

export interface IsbnCoverage {
  hasAnyIsbn: boolean;
  byFormat: Record<string, IsbnRow[]>;
  missingForTargets: DistributionTarget[];
  invalidIsbns: string[];
}

export function evaluateIsbnCoverage(
  isbns: IsbnRow[],
  targets: DistributionTarget[],
): IsbnCoverage {
  const byFormat: Record<string, IsbnRow[]> = {};
  for (const r of isbns) {
    (byFormat[r.format] ??= []).push(r);
  }
  const invalidIsbns = isbns
    .filter((r) => !isValidIsbn13(r.isbn))
    .map((r) => r.isbn);
  const missingForTargets = targets.filter(
    (t) => ISBN_REQUIRED_TARGETS.includes(t) && isbns.length === 0,
  );
  return {
    hasAnyIsbn: isbns.length > 0,
    byFormat,
    missingForTargets,
    invalidIsbns,
  };
}
