/* PTL-020 Phase 8A — Publication Operations Layer
   Lifecycle status vocabulary + transition rules. Pure types. */

export const PUBLICATION_STATUSES = [
  "draft",
  "editing",
  "review",
  "formatting",
  "ready",
  "published",
  "archived",
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** Forward-only lifecycle, with `archived` reachable from any post-draft
 *  state and `editing` reachable from `review`/`ready` as a rework hop. */
export const STATUS_TRANSITIONS: Record<PublicationStatus, PublicationStatus[]> = {
  draft:       ["editing", "archived"],
  editing:     ["review", "draft", "archived"],
  review:      ["formatting", "editing", "archived"],
  formatting:  ["ready", "editing", "archived"],
  ready:       ["published", "formatting", "archived"],
  published:   ["archived"],
  archived:    ["draft"],
};

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
