/* PTL-021 Phase 9A/9B — server functions for the Publication Operations layer.
   No auth middleware: permissions are deferred to Phase 9D per spec.
   All admin imports happen inside handlers to keep client bundles clean. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PublicationStatus } from "@/publication/status";

const statusEnum = z.enum([
  "draft","editing","review","formatting","ready","published","archived",
]);

const recordPatch = z.object({
  slug: z.string(),
  title: z.string().min(1).optional(),
  subtitle: z.string().nullable().optional(),
  series: z.string().nullable().optional(),
  volume: z.number().int().positive().nullable().optional(),
  version: z.string().optional(),
  profile: z.string().optional(),
  author: z.string().min(1).optional(),
  audience: z.string().nullable().optional(),
  language: z.string().optional(),
  publication_date: z.string().nullable().optional(),
});

const metadataPatch = z.object({
  slug: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  contributors: z.array(z.string()).optional(),
  reading_level: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
  publisher: z.string().optional(),
  rights: z.string().nullable().optional(),
});

const veraConfigPatch = z.object({
  slug: z.string(),
  enabled_kinds: z.array(z.string()).optional(),
  default_voice: z.string().nullable().optional(),
});

/** Idempotent seed from the build-time manuscript library. */
export const seedFromLibrary = createServerFn({ method: "POST" }).handler(async () => {
  const { listManuscripts } = await import("@/manuscript/library");
  const persistence = await import("@/publication/persistence.server");
  const { getProfile } = await import("@/publication/profiles");

  function inferProfile(slug: string): string {
    if (/research|signal|report|emotion/i.test(slug)) return "research";
    if (/documentary|history/i.test(slug)) return "documentary";
    if (/rulebook|guide|edu/i.test(slug)) return "educational";
    if (/kids|encyclopedia|bilingual/i.test(slug)) return "childrens";
    return "novel";
  }

  let inserted = 0;
  for (const entry of listManuscripts()) {
    const existing = await persistence.getRecord(entry.slug);
    if (existing) continue;
    const fm = entry.doc.frontmatter;
    const profileId = inferProfile(entry.slug);
    const profile = getProfile(profileId);
    await persistence.upsertRecord({
      slug: entry.slug,
      title: fm.title,
      subtitle: fm.subtitle ?? null,
      status: "draft",
      version: "0.1.0",
      profile: profileId,
      author: fm.authors[0] ?? "Unknown",
      audience: null,
      language: "en",
      publication_date: null,
    });
    await persistence.upsertMetadata({
      slug: entry.slug,
      description: fm.subtitle ?? fm.title,
      keywords: [],
      categories: [],
      contributors: fm.authors.slice(1),
      publisher: "ASCEND Media",
    });
    await persistence.upsertVeraConfig({
      slug: entry.slug,
      enabled_kinds: profile?.behavior.vera.blocksAllowed ?? [],
      default_voice: profile?.behavior.vera.defaultVoice ?? "VERA",
      config: {},
    });
    inserted++;
  }
  return { inserted };
});

export const listPublications = createServerFn({ method: "GET" }).handler(async () => {
  const p = await import("@/publication/persistence.server");
  const [records, metas, veras] = await Promise.all([
    p.listRecords(), p.listMetadata(), p.listVeraConfigs(),
  ]);
  const mIx = new Map(metas.map((m) => [m.slug, m]));
  const vIx = new Map(veras.map((v) => [v.slug, v]));
  return records.map((r) => ({
    record: r,
    metadata: mIx.get(r.slug) ?? null,
    vera: vIx.get(r.slug) ?? null,
  }));
});

export const getPublication = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    const [record, metadata, vera] = await Promise.all([
      p.getRecord(data.slug), p.getMetadata(data.slug), p.getVeraConfig(data.slug),
    ]);
    if (!record) throw new Error(`Unknown publication: ${data.slug}`);
    return { record, metadata, vera };
  });

export const updatePublicationRecord = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => recordPatch.parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    await p.upsertRecord(data);
    return { ok: true };
  });

export const updatePublicationMetadata = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => metadataPatch.parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    await p.upsertMetadata(data);
    return { ok: true };
  });

export const updatePublicationVera = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => veraConfigPatch.parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    await p.upsertVeraConfig(data);
    return { ok: true };
  });

export const transitionPublicationStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), next: statusEnum, notes: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    await p.transitionStatus(data.slug, data.next as PublicationStatus, data.notes);
    return { ok: true };
  });
