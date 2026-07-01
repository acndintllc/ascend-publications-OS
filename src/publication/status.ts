/* PTL-020 Phase 8A — Publication Operations Layer
   Lifecycle status vocabulary + transition rules. Pure types. */

export const PUBLICATION_STATUSES = [
  "draft",
  "editing",
  "review",
  "formatting",
  "approved",
  "ready",
  "package_generated",
  "published",
  "archived",
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** Phase 18.1 refined lifecycle:
 *  draft → editing → review (validation) → formatting → approved
 *        → ready → package_generated → published
 *  `archived` reachable post-draft; rework hops preserved. */
export const STATUS_TRANSITIONS: Record<PublicationStatus, PublicationStatus[]> = {
  draft:              ["editing", "archived"],
  editing:            ["review", "draft", "archived"],
  review:             ["formatting", "approved", "editing", "archived"],
  formatting:         ["approved", "ready", "editing", "archived"],
  approved:           ["ready", "formatting", "archived"],
  ready:              ["package_generated", "approved", "formatting", "archived"],
  package_generated:  ["published", "ready", "archived"],
  published:          ["archived"],
  archived:           ["draft"],
};

/** Human-readable labels for the refined publication lifecycle. */
export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "Draft",
  editing: "Editing",
  review: "Validation",
  formatting: "Formatting",
  approved: "Approved",
  ready: "Ready to Publish",
  package_generated: "Package Generated",
  published: "Published",
  archived: "Archived",
};

/** Ordered stages surfaced in the Command Center timeline. */
export const PUBLICATION_TIMELINE: PublicationStatus[] = [
  "draft",
  "review",
  "approved",
  "ready",
  "package_generated",
  "published",
];

export function canTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface PublicationRecord {
  slug: string;
  title: string;
  subtitle?: string;
  series?: string;
  volume?: number;
  status: PublicationStatus;
  version: string;          // semver-like, e.g. "0.3.1"
  profile: string;          // publication-profile id (see profiles.ts)
  lastUpdated: string;      // ISO date
  author: string;           // primary author for the ops view
}
