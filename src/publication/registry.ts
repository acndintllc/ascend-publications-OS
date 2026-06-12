/* PTL-020 Phase 8 — in-memory publication registry.
   Bridges the manuscript library (build-time ACA) to the operations
   layer (status + metadata + profile). Seeds defaults so existing
   manuscripts immediately appear in the ops dashboard; runtime
   overrides land in a Map so future server-fn writes can replace it
   without touching consumers. */
import { listManuscripts } from "@/manuscript/library";
import type { PublicationRecord, PublicationStatus } from "./status";
import { canTransition } from "./status";
import type { PublicationMetadata } from "./metadata";
import { publicationMetadataSchema } from "./metadata";
import { getProfile } from "./profiles";

interface RegistryEntry {
  record: PublicationRecord;
  metadata: PublicationMetadata;
}

function inferProfile(slug: string): string {
  if (/research|signal|report|emotion/i.test(slug)) return "research";
  if (/documentary|history/i.test(slug)) return "documentary";
  if (/rulebook|guide|edu/i.test(slug)) return "educational";
  if (/kids|encyclopedia|bilingual/i.test(slug)) return "childrens";
  return "novel";
}

function seed(): Map<string, RegistryEntry> {
  const map = new Map<string, RegistryEntry>();
  for (const entry of listManuscripts()) {
    const fm = entry.doc.frontmatter;
    const profileId = inferProfile(entry.slug);
    const record: PublicationRecord = {
      slug: entry.slug,
      title: fm.title,
      subtitle: fm.subtitle,
      status: "draft",
      version: "0.1.0",
      profile: profileId,
      lastUpdated: new Date().toISOString(),
      author: fm.authors[0] ?? "Unknown",
    };
    const metadata = publicationMetadataSchema.parse({
      title: fm.title,
      subtitle: fm.subtitle,
      description: fm.subtitle ?? fm.title,
      keywords: [],
      categories: [],
      author: fm.authors[0] ?? "Unknown",
      contributors: fm.authors.slice(1),
      language: "en",
    });
    map.set(entry.slug, { record, metadata });
  }
  return map;
}

const registry = seed();

export function listRegistry(): RegistryEntry[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.record.title.localeCompare(b.record.title),
  );
}

export function getRegistryEntry(slug: string): RegistryEntry | undefined {
  return registry.get(slug);
}

export function setStatus(slug: string, next: PublicationStatus): RegistryEntry {
  const entry = registry.get(slug);
  if (!entry) throw new Error(`Unknown manuscript: ${slug}`);
  if (!canTransition(entry.record.status, next)) {
    throw new Error(`Illegal transition ${entry.record.status} → ${next}`);
  }
  entry.record.status = next;
  entry.record.lastUpdated = new Date().toISOString();
  return entry;
}

export function updateMetadata(slug: string, patch: Partial<PublicationMetadata>): RegistryEntry {
  const entry = registry.get(slug);
  if (!entry) throw new Error(`Unknown manuscript: ${slug}`);
  entry.metadata = publicationMetadataSchema.parse({ ...entry.metadata, ...patch });
  entry.record.lastUpdated = new Date().toISOString();
  return entry;
}

/** Convenience for the dashboard — resolves the profile object inline. */
export function describe(slug: string) {
  const entry = registry.get(slug);
  if (!entry) return undefined;
  return { ...entry, profile: getProfile(entry.record.profile) };
}
