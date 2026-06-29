/* PTL-021 Phase 9A/9B — server functions for the Publication Operations layer.
   OWNER/USER access model:
   - requireUser  → any authenticated user. Per-handler ownership check via
                    assertOwns() before mutating or reading per-slug data.
   - requireOwner → owner-only admin surfaces (vendors / ISBNs / KDP /
                    governance / distribution queue / system reports). */
import { createServerFn } from "@tanstack/react-start";
import { requireUser, requireOwner } from "@/integrations/supabase/role-middleware";
import { scopeSlugForUser } from "@/lib/owner";
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
  vera_role: z.enum(["none", "interpretation", "narrator", "character"]).optional(),
});

/** OWNER-only: seed bundled library manuscripts into the publications table. */
export const seedFromLibrary = createServerFn({ method: "POST" })
  .middleware([requireOwner]).handler(async ({ context }) => {
  const { listManuscripts } = await import("@/manuscript/library");
  const persistence = await import("@/publication/persistence.server");
  const { getProfile } = await import("@/publication/profiles");
  const ownerId = context.userId;

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
    }, ownerId);
    await persistence.upsertMetadata({
      slug: entry.slug,
      description: fm.subtitle ?? fm.title,
      keywords: [],
      categories: [],
      contributors: fm.authors.slice(1),
      publisher: "ASCEND Media",
    }, ownerId);
    await persistence.upsertVeraConfig({
      slug: entry.slug,
      enabled_kinds: profile?.behavior.vera.blocksAllowed ?? [],
      default_voice: profile?.behavior.vera.defaultVoice ?? "VERA",
    }, ownerId);
    await persistence.recordEvent({
      slug: entry.slug,
      event_type: "publication.created",
      payload: { profile: profileId, source: "library-seed" },
      actor: "system",
      ownerId,
    });
    inserted++;
  }
  return { inserted };
});


export const listPublications = createServerFn({ method: "GET" })
  .middleware([requireUser]).handler(async ({ context }) => {
  const p = await import("@/publication/persistence.server");
  const scope = context.isOwner ? null : context.userId;
  const [records, metas, veras] = await Promise.all([
    p.listRecords(scope), p.listMetadata(scope), p.listVeraConfigs(scope),
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
  .middleware([requireUser])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const [record, metadata, vera] = await Promise.all([
      p.getRecord(data.slug), p.getMetadata(data.slug), p.getVeraConfig(data.slug),
    ]);
    if (!record) throw new Error(`Unknown publication: ${data.slug}`);
    return { record, metadata, vera };
  });

export const updatePublicationRecord = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => recordPatch.parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const before = await p.assertOwns(data.slug, context.userId, context.isOwner);
    await p.upsertRecord(data);
    const profileChanged =
      data.profile !== undefined && before && before.profile !== data.profile;
    await p.recordEvent({
      slug: data.slug,
      event_type: profileChanged ? "profile.changed" : "metadata.updated",
      payload: profileChanged
        ? { from: before?.profile, to: data.profile }
        : { fields: Object.keys(data).filter((k) => k !== "slug") },
      ownerId: before.owner_id,
    });
    return { ok: true };
  });

export const updatePublicationMetadata = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => metadataPatch.parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const rec = await p.assertOwns(data.slug, context.userId, context.isOwner);
    await p.upsertMetadata(data);
    await p.recordEvent({
      slug: data.slug,
      event_type: "metadata.updated",
      payload: { fields: Object.keys(data).filter((k) => k !== "slug") },
      ownerId: rec.owner_id,
    });
    return { ok: true };
  });

export const updatePublicationVera = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => veraConfigPatch.parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const rec = await p.assertOwns(data.slug, context.userId, context.isOwner);
    await p.upsertVeraConfig(data);
    await p.recordEvent({
      slug: data.slug,
      event_type: "vera.updated",
      payload: { enabled_kinds: data.enabled_kinds, default_voice: data.default_voice },
      ownerId: rec.owner_id,
    });
    return { ok: true };
  });

export const transitionPublicationStatus = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), next: statusEnum, notes: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const before = await p.assertOwns(data.slug, context.userId, context.isOwner);
    await p.transitionStatus(data.slug, data.next as PublicationStatus, data.notes);
    await p.recordEvent({
      slug: data.slug,
      event_type: "status.changed",
      payload: { from: before?.status, to: data.next, notes: data.notes ?? null },
      ownerId: before.owner_id,
    });
    try {
      const { revalidateReadiness } = await import("@/publication/readiness-automation.server");
      await revalidateReadiness(data.slug, "status.changed");
    } catch (e) {
      await p.recordEvent({
        slug: data.slug, event_type: "readiness.recomputed",
        payload: { trigger: "status.changed", auto_failed: true, error: String(e) },
        ownerId: before.owner_id,
      });
    }
    return { ok: true };
  });

/* ─── 9E: asset server fns ───────────────────────────────────────── */

const assetUploadSchema = z.object({
  slug: z.string(),
  kind: z.string(),
  url: z.string().url(),
  label: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const listPublicationAssets = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    return p.listAssets(data.slug);
  });

export const listAllPublicationAssets = createServerFn({ method: "GET" })
  .middleware([requireUser]).handler(async ({ context }) => {
  const p = await import("@/publication/persistence.server");
  return p.listAllAssets(context.isOwner ? null : context.userId);
});

export const uploadPublicationAsset = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => assetUploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const rec = await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { asset, replaced } = await p.uploadAsset({ ...data, ownerId: rec.owner_id });
    await p.recordEvent({
      slug: data.slug,
      event_type: replaced ? "asset.replaced" : "asset.uploaded",
      payload: {
        kind: data.kind,
        version: asset.version,
        url: data.url,
        replaced_id: replaced?.id ?? null,
      },
      ownerId: rec.owner_id,
    });
    await p.recordEvent({
      slug: data.slug,
      event_type: "readiness.recomputed",
      payload: { trigger: replaced ? "asset.replaced" : "asset.uploaded" },
      ownerId: rec.owner_id,
    });
    return { asset, replaced };
  });

const assetFileUploadSchema = z.object({
  slug: z.string(),
  kind: z.string().min(1).max(60),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
  contentBase64: z.string().min(1),
  label: z.string().max(160).nullable().optional(),
});

export const uploadPublicationAssetFile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => assetFileUploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const rec = await p.assertOwns(data.slug, context.userId, context.isOwner);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = (s: string) => s.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
    const extMatch = /\.[a-z0-9]+$/i.exec(data.filename);
    const ext = extMatch ? extMatch[0].toLowerCase() : "";
    const id = crypto.randomUUID();
    const path = `${safe(data.slug)}/${safe(data.kind)}/${id}${ext}`;
    const bin = atob(data.contentBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const up = await supabaseAdmin.storage.from("publication-assets")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (up.error) throw new Error(`upload failed: ${up.error.message}`);

    const storedUrl = `publication-assets/${path}`;
    const { asset, replaced } = await p.uploadAsset({
      slug: data.slug, kind: data.kind, url: storedUrl,
      label: data.label ?? data.filename, ownerId: rec.owner_id,
    });
    await p.recordEvent({
      slug: data.slug,
      event_type: replaced ? "asset.replaced" : "asset.uploaded",
      payload: { kind: data.kind, version: asset.version, url: storedUrl, replaced_id: replaced?.id ?? null },
      ownerId: rec.owner_id,
    });
    await p.recordEvent({
      slug: data.slug,
      event_type: "readiness.recomputed",
      payload: { trigger: replaced ? "asset.replaced" : "asset.uploaded" },
      ownerId: rec.owner_id,
    });
    return { asset, replaced };
  });

export const deactivatePublicationAsset = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const rec = await p.assertOwns(data.slug, context.userId, context.isOwner);
    const asset = await p.deactivateAsset(data.id, data.slug);
    await p.recordEvent({
      slug: data.slug,
      event_type: "asset.deactivated",
      payload: { id: data.id, kind: asset.kind, version: asset.version },
      ownerId: rec.owner_id,
    });
    return { asset };
  });

/* ─── 9F: event log server fn ────────────────────────────────────── */

export const listPublicationEvents = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator((d: { slug: string; limit?: number }) =>
    z.object({ slug: z.string(), limit: z.number().int().positive().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    return p.listEvents(data.slug, data.limit ?? 50);
  });


/* ─── Phase 10A: storage-backed asset uploads ───────────────────── */

export const createAssetUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), kind: z.string(), filename: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const s = await import("@/publication/storage.server");
    return s.createSignedUpload(data);
  });

/* ─── Phase 10C: distribution queue — OWNER-only admin surface ──── */

const queueState = z.enum([
  "queued","processing","blocked","ready","submitted","failed",
]);

export const listDistributionQueue = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .inputValidator((d: { slug?: string }) =>
    z.object({ slug: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const q = await import("@/publication/queue.server");
    return q.listQueue(data.slug);
  });

export const enqueueDistribution = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      target: z.string(),
      blockers: z.array(z.string()).optional(),
      notes: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const q = await import("@/publication/queue.server");
    const p = await import("@/publication/persistence.server");
    const row = await q.enqueue({
      slug: data.slug,
      target: data.target,
      state: (data.blockers?.length ?? 0) > 0 ? "blocked" : "queued",
      blockers: data.blockers ?? [],
      notes: data.notes ?? null,
    });
    await p.recordEvent({
      slug: data.slug,
      event_type: "export.requested",
      payload: { target: data.target, queue_id: row.id, state: row.state },
    });
    return row;
  });

export const updateDistributionEntry = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      slug: z.string(),
      state: queueState.optional(),
      blockers: z.array(z.string()).optional(),
      artifact_url: z.string().url().nullable().optional(),
      notes: z.string().nullable().optional(),
      submitted: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const q = await import("@/publication/queue.server");
    const p = await import("@/publication/persistence.server");
    const patch: Record<string, unknown> = {};
    if (data.state) patch.state = data.state;
    if (data.blockers) patch.blockers = data.blockers;
    if (data.artifact_url !== undefined) patch.artifact_url = data.artifact_url;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.submitted) {
      patch.state = "submitted";
      patch.submitted_at = new Date().toISOString();
    }
    const row = await q.updateQueue(data.id, patch as never);
    await p.recordEvent({
      slug: data.slug,
      event_type: "export.requested",
      payload: { queue_id: row.id, state: row.state, transition: true },
    });

    if (row.state === "ready" && !row.artifact_url) {
      try {
        const { runArtifactGenerationForSlug } = await import("@/publication/runner-orchestrator.server");
        const result = await runArtifactGenerationForSlug({
          slug: data.slug,
          storeTargets: [row.target as never],
          sourceQueueId: row.id,
          actor: "auto-prepare",
        });
        if (result.packageUrl) {
          const updated = await q.updateQueue(row.id, { artifact_url: result.packageUrl } as never);
          await p.recordEvent({
            slug: data.slug,
            event_type: "export.requested",
            payload: {
              queue_id: row.id,
              auto_prepared: true,
              artifact_count: result.artifacts.length,
              package_url: result.packageUrl,
            },
          });
          return updated;
        }
      } catch (e) {
        await p.recordEvent({
          slug: data.slug,
          event_type: "export.requested",
          payload: { queue_id: row.id, auto_prepare_failed: true, error: String(e) },
        });
      }
    }
    return row;
  });

export const removeDistributionEntry = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const q = await import("@/publication/queue.server");
    await q.deleteQueueEntry(data.id);
    return { ok: true };
  });

/* ─── Phase 13A/B — Artifact generation + registry ─────────────────── */

export const generatePublicationArtifacts = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      storeTargets: z.array(z.string()).optional(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { runArtifactGenerationForSlug } = await import("@/publication/runner-orchestrator.server");
    return runArtifactGenerationForSlug({
      slug: data.slug,
      storeTargets: (data.storeTargets ?? []) as never,
      sourceQueueId: data.sourceQueueId ?? null,
      actor: data.actor ?? "manual",
    });
  });

export const listPublicationArtifacts = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const r = await import("@/publication/runner.server");
    const rows = await r.listArtifacts(data.slug);
    const signed: Record<string, string> = {};
    for (const a of rows.filter((x) => x.is_active)) {
      const url = await r.signArtifact(a.storage_path);
      if (url) signed[a.id] = url;
    }
    return { rows, signed };
  });

export const signArtifactUrl = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/runner.server");
    return { url: await r.signArtifact(data.path) };
  });

/* ─── PTL-026 Phase 15A — Reference external PDF runner ───────────── */

const runnerModeEnum = z.enum(["ok", "invalid_signature", "missing_artifact", "failed_generation"]);

export const runReferencePdfRunner = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      mode: runnerModeEnum.optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const origin = new URL(req.url).origin;
    const { runReferencePdf } = await import("@/publication/reference-runner.server");
    return runReferencePdf({
      slug: data.slug,
      origin,
      sourceQueueId: data.sourceQueueId ?? null,
      mode: data.mode ?? "ok",
      actor: data.actor,
    });
  });

/* ─── PTL-025 Phase 14B — ISBN registry — OWNER-only ──────────────── */

export const listIsbns = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .inputValidator((d: { slug?: string }) => z.object({ slug: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    return r.listIsbns(data.slug);
  });

export const assignIsbn = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      isbn: z.string().min(10),
      edition: z.string().optional(),
      format: z.string(),
      status: z.string().optional(),
      notes: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    const { isValidIsbn13 } = await import("@/publication/isbn");
    if (!isValidIsbn13(data.isbn)) throw new Error("Invalid ISBN-13 checksum");
    const row = await r.assignIsbn(data);
    const p = await import("@/publication/persistence.server");
    await p.recordEvent({
      slug: data.slug,
      event_type: "metadata.updated",
      payload: { isbn: row.isbn, format: row.format, action: "isbn.assigned" },
    });
    return row;
  });

export const updateIsbn = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.string().optional(),
      notes: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    const { id, ...patch } = data;
    return r.updateIsbn(id, patch as never);
  });

export const deleteIsbn = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    await r.deleteIsbn(data.id);
    return { ok: true };
  });

/* ─── PTL-025 Phase 14D — Vendor server fns — OWNER-only ─────────── */

export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireOwner]).handler(async () => {
  const r = await import("@/publication/registry-extra.server");
  return r.listVendors();
});

export const upsertVendor = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      platform: z.string(),
      account_id: z.string().nullable().optional(),
      label: z.string().min(1),
      settings: z.record(z.string(), z.any()).optional(),
      credential_ref: z.string().nullable().optional(),
      submission_prefs: z.record(z.string(), z.any()).optional(),
      enabled: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    return r.upsertVendor(data as never);
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    await r.deleteVendor(data.id);
    return { ok: true };
  });

/* ─── PTL-025 Phase 14C — Submission server fns — OWNER-only ─────── */

export const listSubmissions = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .inputValidator((d: { slug?: string }) => z.object({ slug: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    return r.listSubmissions(data.slug);
  });

export const createSubmission = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      platform: z.string(),
      vendor_id: z.string().uuid().nullable().optional(),
      queue_id: z.string().uuid().nullable().optional(),
      isbn: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    const row = await r.createSubmission(data);
    const p = await import("@/publication/persistence.server");
    await p.recordEvent({
      slug: data.slug,
      event_type: "export.requested",
      payload: { submission_id: row.id, platform: data.platform, state: "pending" },
    });
    return row;
  });

export const updateSubmission = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      slug: z.string(),
      status: z.enum(["pending","submitted","accepted","rejected","published","withdrawn"]).optional(),
      notes: z.string().nullable().optional(),
      response_payload: z.record(z.string(), z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    const { id, slug, ...patch } = data;
    const row = await r.updateSubmission(id, patch as never);
    const p = await import("@/publication/persistence.server");
    await p.recordEvent({
      slug,
      event_type: "export.requested",
      payload: { submission_id: row.id, state: row.status, transition: true },
    });
    return row;
  });

/* ─── PTL-025 Phase 14F — Publication audit ───────────────────────── */

export const auditPublicationFn = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { auditPublication } = await import("@/publication/audit.server");
    return auditPublication(data.slug);
  });

/* ─── PTL-027 Phase 16A — Reference external KFX runner ───────────── */

export const runReferenceKfxRunner = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      mode: runnerModeEnum.optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const origin = new URL(req.url).origin;
    const { runReferenceKfx } = await import("@/publication/reference-runner-kfx.server");
    return runReferenceKfx({
      slug: data.slug,
      origin,
      sourceQueueId: data.sourceQueueId ?? null,
      mode: data.mode ?? "ok",
      actor: data.actor,
    });
  });

/* ─── PTL-027 Phase 16B — Submission package builder — OWNER ──────── */

export const buildPublicationSubmissionPackage = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), platform: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { buildSubmissionPackage } = await import("@/publication/submission-package.server");
    return buildSubmissionPackage(data.slug, data.platform as never);
  });

/* ─── PTL-027 Phase 16C — Vendor secret report — OWNER ────────────── */

export const reportVendorSecretsFn = createServerFn({ method: "GET" })
  .middleware([requireOwner]).handler(async () => {
  const r = await import("@/publication/registry-extra.server");
  const { reportVendorSecrets } = await import("@/publication/vendor-secrets.server");
  const vendors = await r.listVendors();
  return reportVendorSecrets(vendors);
});

/* ─── PTL-027 Phase 16D — ISBN lifecycle transition — OWNER ───────── */

export const transitionIsbn = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      slug: z.string(),
      next: z.enum(["reserved","assigned","registered","retired"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    const { canTransitionIsbn } = await import("@/publication/isbn-workflow");
    const all = await r.listIsbns(data.slug);
    const current = all.find((x) => x.id === data.id);
    if (!current) throw new Error("ISBN not found");
    if (!canTransitionIsbn(current.status, data.next)) {
      throw new Error(`Illegal ISBN transition: ${current.status} → ${data.next}`);
    }
    const row = await r.updateIsbn(data.id, { status: data.next } as never);
    const p = await import("@/publication/persistence.server");
    await p.recordEvent({
      slug: data.slug,
      event_type: "metadata.updated",
      payload: { isbn: row.isbn, action: "isbn.transition", from: current.status, to: data.next },
    });
    return row;
  });

/* ─── PTL-028 Phase 17A — External KindleGen runner ───────────────── */

export const runExternalKindlegenRunner = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const origin = new URL(req.url).origin;
    const { runExternalKindlegen } = await import("@/publication/runner-external-kindlegen.server");
    return runExternalKindlegen({
      slug: data.slug,
      origin,
      sourceQueueId: data.sourceQueueId ?? null,
      actor: data.actor,
    });
  });

export const listRunnerProvidersFn = createServerFn({ method: "GET" })
  .middleware([requireOwner]).handler(async () => {
  const { listProviders } = await import("@/publication/runner-provider");
  return listProviders().map((p) => ({
    id: p.id, kind: p.kind, label: p.label,
    available: p.available(), fallback: p.fallback,
  }));
});

/* ─── PTL-028 Phase 17B — KDP submission adapter — OWNER ──────────── */

export const runKdpAdapterFn = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), live: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { runKdpAdapter } = await import("@/publication/kdp-adapter.server");
    return runKdpAdapter({ slug: data.slug, live: data.live ?? false });
  });

/* ─── PTL-028 Phase 17C — Publication dry-run ─────────────────────── */

export const runPublicationDryRunFn = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), forceRegenerate: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { runPublicationDryRun } = await import("@/publication/dry-run.server");
    return runPublicationDryRun({ slug: data.slug, forceRegenerate: data.forceRegenerate });
  });

/* ─── PTL-029 Phase 18B — Kindle provider failover ────────────────── */

export const runKindleFailoverFn = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      forceFallback: z.boolean().optional(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin;
    const { runKindleWithFailover } = await import("@/publication/kindle-orchestrator.server");
    return runKindleWithFailover({
      slug: data.slug, origin,
      sourceQueueId: data.sourceQueueId ?? null,
      actor: data.actor, forceFallback: data.forceFallback,
    });
  });

export const kindleProviderHealthFn = createServerFn({ method: "GET" })
  .middleware([requireOwner]).handler(async () => {
  const { kindleProviderHealth } = await import("@/publication/kindle-orchestrator.server");
  return kindleProviderHealth();
});

/* ─── PTL-029 Phase 18F — Governance gate — OWNER ─────────────────── */

export const evaluateGovernanceGateFn = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(), platform: z.string(),
      liveRequested: z.boolean().optional(),
      approver: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { evaluateGovernanceGate } = await import("@/publication/governance.server");
    return evaluateGovernanceGate(data);
  });

/* ─── PTL-029 Phase 18A — Live KDP submission — OWNER ─────────────── */

export const runLiveKdpSubmissionFn = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      liveEnabled: z.boolean(),
      approver: z.string().optional(),
      submissionId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { runLiveKdpSubmission } = await import("@/publication/kdp-live.server");
    return runLiveKdpSubmission(data);
  });

/* ─── PTL-029 Phase 18C — Readiness automation ────────────────────── */

export const revalidateReadinessFn = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), trigger: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { revalidateReadiness } = await import("@/publication/readiness-automation.server");
    return revalidateReadiness(data.slug, data.trigger ?? "manual");
  });




/* ─── Ingest bridge — register an uploaded manuscript as a publication ─── */

const manuscriptUploadSchema = z.object({
  filename: z.string().min(1),
  format: z.enum(["md", "docx"]),
  contentBase64: z.string().min(1),
});

const registerUploadSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  author: z.string().min(1).optional(),
  contributors: z.array(z.string()).optional(),
  profile: z.string().optional(),
  manuscript: manuscriptUploadSchema.optional(),
  bibText: z.string().optional(),
  veraJson: z.string().optional(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `manuscript-${Date.now()}`;
}

function inferProfileFromSlug(slug: string): string {
  if (/research|signal|report|emotion/i.test(slug)) return "research";
  if (/documentary|history/i.test(slug)) return "documentary";
  if (/rulebook|guide|edu/i.test(slug)) return "educational";
  if (/kids|encyclopedia|bilingual/i.test(slug)) return "childrens";
  return "novel";
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Create (or return existing) publication record from an ad-hoc upload.
    USER uploads get a per-user slug prefix so their namespace never collides
    with other users or with bundled library manuscripts. OWNER uploads keep
    their raw slug. owner_id is stamped on every related row. */
export const registerUploadedPublication = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => registerUploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const persistence = await import("@/publication/persistence.server");
    const { getProfile } = await import("@/publication/profiles");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rawSlug = data.slug ? slugify(data.slug) : slugify(data.title);
    const slug = scopeSlugForUser(rawSlug, context.userId, context.isOwner);
    const ownerId = context.userId;

    let sourcePersisted = false;
    if (data.manuscript) {
      const bucket = supabaseAdmin.storage.from("publication-manuscripts");
      const ext = data.manuscript.format === "docx" ? "docx" : "md";
      const storagePath = `${slug}/manuscript.${ext}`;
      const bytes = decodeBase64(data.manuscript.contentBase64);
      const contentType =
        ext === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "text/markdown";
      const up = await bucket.upload(storagePath, bytes, { contentType, upsert: true });
      if (up.error) throw new Error(`manuscript upload failed: ${up.error.message}`);

      let bibPath: string | null = null;
      if (data.bibText) {
        bibPath = `${slug}/citations.bib`;
        const ub = await bucket.upload(bibPath, new TextEncoder().encode(data.bibText), {
          contentType: "text/plain", upsert: true,
        });
        if (ub.error) throw new Error(`bib upload failed: ${ub.error.message}`);
      }
      let veraPath: string | null = null;
      if (data.veraJson) {
        veraPath = `${slug}/vera.json`;
        const uv = await bucket.upload(veraPath, new TextEncoder().encode(data.veraJson), {
          contentType: "application/json", upsert: true,
        });
        if (uv.error) throw new Error(`vera upload failed: ${uv.error.message}`);
      }
      const { error: srcErr } = await supabaseAdmin
        .from("publication_sources")
        .upsert({
          slug,
          format: data.manuscript.format,
          storage_path: storagePath,
          bib_path: bibPath,
          vera_path: veraPath,
          uploaded_at: new Date().toISOString(),
          owner_id: ownerId,
        } as never);
      if (srcErr) throw new Error(`source row insert failed: ${srcErr.message}`);
      sourcePersisted = true;
    }

    const existing = await persistence.getRecord(slug);
    if (existing) {
      // Prevent take-over: if a different user owns this slug, reject.
      if (!context.isOwner && existing.owner_id && existing.owner_id !== ownerId) {
        throw new Error("Forbidden: slug already in use");
      }
      return { slug, created: false, sourcePersisted };
    }
    const profileId = data.profile ?? inferProfileFromSlug(slug);
    const profile = getProfile(profileId);
    const author = data.author ?? "Unknown";
    await persistence.upsertRecord({
      slug,
      title: data.title,
      subtitle: data.subtitle ?? null,
      status: "draft",
      version: "0.1.0",
      profile: profileId,
      author,
      audience: null,
      language: "en",
      publication_date: null,
    }, ownerId);
    await persistence.upsertMetadata({
      slug,
      description: data.subtitle ?? data.title,
      keywords: [],
      categories: [],
      contributors: data.contributors ?? [],
      publisher: "ASCEND Media",
    }, ownerId);
    await persistence.upsertVeraConfig({
      slug,
      enabled_kinds: profile?.behavior.vera.blocksAllowed ?? [],
      default_voice: profile?.behavior.vera.defaultVoice ?? "VERA",
    }, ownerId);
    await persistence.recordEvent({
      slug,
      event_type: "publication.created",
      payload: { profile: profileId, source: "live-upload", sourcePersisted },
      actor: "system",
      ownerId,
    });
    return { slug, created: true, sourcePersisted };
  });

/** Server-side enriched-doc resolver. Bundled library is open to any auth;
    DB-backed slugs require ownership. */
export const loadManuscriptDoc = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // Ownership gate when slug is in DB; bundled-only slugs are non-PII content.
    const p = await import("@/publication/persistence.server");
    const rec = await p.getRecord(data.slug);
    if (rec && !context.isOwner && rec.owner_id !== context.userId) {
      throw new Error("Forbidden: you do not own this manuscript");
    }
    const { resolveManuscriptForSlug } = await import("@/manuscript/resolver.server");
    const r = await resolveManuscriptForSlug(data.slug);
    if (!r) return null;
    const { enrich } = await import("@/manuscript/pipeline");
    const { doc } = enrich(r.doc, { bib: r.bib, vera: r.veraSidecar });
    return { slug: r.slug, doc, source: r.source };
  });

/** Resolve manuscript + validation report. Same ownership rule as loadManuscriptDoc. */
export const loadManuscriptValidation = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const rec = await p.getRecord(data.slug);
    if (rec && !context.isOwner && rec.owner_id !== context.userId) {
      throw new Error("Forbidden: you do not own this manuscript");
    }
    const { resolveManuscriptForSlug } = await import("@/manuscript/resolver.server");
    const r = await resolveManuscriptForSlug(data.slug);
    if (!r) return null;
    const { enrich } = await import("@/manuscript/pipeline");
    const { validateManuscript } = await import("@/manuscript/validate");
    const { doc } = enrich(r.doc, { bib: r.bib, vera: r.veraSidecar });
    const report = validateManuscript(doc, r.bib, r.veraSidecar);
    return { slug: r.slug, doc, report, source: r.source };
  });

/* ─── Phase 22B — Creator Submission Package workflow ──────────────────
   Extends the existing upload flow with: direct asset upload from the
   browser (base64), full metadata in one call, submit-for-review, and
   the OWNER review queue. Reuses publication-records, publication-assets,
   publication-sources — no parallel system. */

const SUBMISSION_STATES = [
  "draft","submitted","needs_changes","approved",
  "in_production","ready_for_distribution","published",
] as const;
const submissionStateEnum = z.enum(SUBMISSION_STATES);

const fullMetadataSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional().nullable(),
  author: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  keywords: z.array(z.string().max(60)).max(20).optional(),
  categories: z.array(z.string().max(120)).max(10).optional(),
  contributors: z.array(z.string().max(120)).max(20).optional(),
  publisher: z.string().max(120).optional(),
  rights: z.string().max(400).optional().nullable(),
  reading_level: z.string().max(60).optional().nullable(),
  isbn: z.string().max(20).optional().nullable(),
  series: z.string().max(120).optional().nullable(),
  volume: z.number().int().positive().optional().nullable(),
  audience: z.string().max(60).optional().nullable(),
  language: z.string().max(10).default("en"),
  profile: z.string().optional(),
});

const assetFileSchema = z.object({
  kind: z.string().min(1).max(60),
  filename: z.string().min(1).max(200),
  contentBase64: z.string().min(1),
  contentType: z.string().min(1).max(120),
  label: z.string().max(160).optional().nullable(),
});

const submitPackageSchema = z.object({
  slug: z.string().optional(),
  metadata: fullMetadataSchema,
  manuscript: z.object({
    filename: z.string().min(1),
    format: z.enum(["md","docx","pdf"]),
    contentBase64: z.string().min(1),
  }).optional(),
  cover: assetFileSchema.optional(),
  optionalAssets: z.array(assetFileSchema).max(20).optional(),
  bibText: z.string().max(500_000).optional(),
  veraJson: z.string().max(500_000).optional(),
  submit: z.boolean().optional(), // true = move to submission queue
});

function safeName(s: string) {
  return s.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
}
function extOf(filename: string): string {
  const m = /\.[a-z0-9]+$/i.exec(filename);
  return m ? m[0].toLowerCase() : "";
}
function decodeB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Create/update a publication, persist manuscript + metadata + cover +
    optional assets in one call, optionally submit for ASCEND review. */
export const submitCreatorPackage = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => submitPackageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const persistence = await import("@/publication/persistence.server");
    const { getProfile } = await import("@/publication/profiles");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = data.metadata;
    const rawSlug = data.slug ? slugify(data.slug) : slugify(meta.title);
    const slug = scopeSlugForUser(rawSlug, context.userId, context.isOwner);
    const ownerId = context.userId;

    const existing = await persistence.getRecord(slug);
    if (existing && !context.isOwner && existing.owner_id && existing.owner_id !== ownerId) {
      throw new Error("Forbidden: slug already in use");
    }
    const profileId = meta.profile ?? inferProfileFromSlug(slug);
    const profile = getProfile(profileId);

    // 1. Manuscript -> publication-manuscripts bucket + publication_sources
    let sourcePersisted = false;
    if (data.manuscript) {
      const mb = supabaseAdmin.storage.from("publication-manuscripts");
      const ext = data.manuscript.format === "docx" ? "docx"
        : data.manuscript.format === "pdf" ? "pdf" : "md";
      const storagePath = `${slug}/manuscript.${ext}`;
      const ct = ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : ext === "pdf" ? "application/pdf" : "text/markdown";
      const up = await mb.upload(storagePath, decodeB64(data.manuscript.contentBase64),
        { contentType: ct, upsert: true });
      if (up.error) throw new Error(`manuscript upload failed: ${up.error.message}`);

      let bibPath: string | null = null;
      if (data.bibText) {
        bibPath = `${slug}/citations.bib`;
        const ub = await mb.upload(bibPath, new TextEncoder().encode(data.bibText),
          { contentType: "text/plain", upsert: true });
        if (ub.error) throw new Error(`bib upload failed: ${ub.error.message}`);
      }
      let veraPath: string | null = null;
      if (data.veraJson) {
        veraPath = `${slug}/vera.json`;
        const uv = await mb.upload(veraPath, new TextEncoder().encode(data.veraJson),
          { contentType: "application/json", upsert: true });
        if (uv.error) throw new Error(`vera upload failed: ${uv.error.message}`);
      }
      const { error: srcErr } = await supabaseAdmin
        .from("publication_sources").upsert({
          slug, format: data.manuscript.format,
          storage_path: storagePath, bib_path: bibPath, vera_path: veraPath,
          uploaded_at: new Date().toISOString(), owner_id: ownerId,
        } as never);
      if (srcErr) throw new Error(`source row insert failed: ${srcErr.message}`);
      sourcePersisted = true;
    } else if (!existing) {
      throw new Error("Manuscript file is required for a new submission");
    }

    // 2. Upsert record + metadata + vera config
    await persistence.upsertRecord({
      slug,
      title: meta.title,
      subtitle: meta.subtitle ?? null,
      series: meta.series ?? null,
      volume: meta.volume ?? null,
      status: existing?.status ?? "draft",
      version: existing?.version ?? "0.1.0",
      profile: profileId,
      author: meta.author,
      audience: meta.audience ?? null,
      language: meta.language || "en",
      publication_date: existing?.publication_date ?? null,
    }, ownerId);
    await persistence.upsertMetadata({
      slug,
      description: meta.description,
      keywords: meta.keywords ?? [],
      categories: meta.categories ?? [],
      contributors: meta.contributors ?? [],
      reading_level: meta.reading_level ?? null,
      isbn: meta.isbn ?? null,
      publisher: meta.publisher ?? "ASCEND Media",
      rights: meta.rights ?? null,
    }, ownerId);
    await persistence.upsertVeraConfig({
      slug,
      enabled_kinds: profile?.behavior.vera.blocksAllowed ?? [],
      default_voice: profile?.behavior.vera.defaultVoice ?? "VERA",
    }, ownerId);

    if (!existing) {
      await persistence.recordEvent({
        slug, event_type: "publication.created",
        payload: { profile: profileId, source: "creator-package", sourcePersisted },
        actor: "creator", ownerId,
      });
    }

    // 3. Cover + optional assets -> publication-assets bucket + publication_assets rows
    const ab = supabaseAdmin.storage.from("publication-assets");
    async function uploadAssetFile(a: z.infer<typeof assetFileSchema>) {
      const ext = extOf(a.filename);
      const id = crypto.randomUUID();
      const path = `${slug}/${safeName(a.kind)}/${id}${ext}`;
      const up = await ab.upload(path, decodeB64(a.contentBase64),
        { contentType: a.contentType, upsert: false });
      if (up.error) throw new Error(`${a.kind} upload failed: ${up.error.message}`);
      const storedUrl = `publication-assets/${path}`;
      const { asset, replaced } = await persistence.uploadAsset({
        slug, kind: a.kind, url: storedUrl,
        label: a.label ?? a.filename, ownerId,
      });
      await persistence.recordEvent({
        slug, event_type: replaced ? "asset.replaced" : "asset.uploaded",
        payload: { kind: a.kind, version: asset.version, url: storedUrl, source: "creator-package" },
        actor: "creator", ownerId,
      });
      return asset;
    }
    const uploadedAssets: string[] = [];
    if (data.cover) {
      const kind = data.cover.kind || "front-cover";
      const ca = await uploadAssetFile({ ...data.cover, kind });
      uploadedAssets.push(ca.id);
    }
    for (const a of data.optionalAssets ?? []) {
      const ua = await uploadAssetFile(a);
      uploadedAssets.push(ua.id);
    }

    // 4. Optionally flip submission_status to 'submitted'
    let submission_status: typeof SUBMISSION_STATES[number] =
      ((existing as unknown as { submission_status?: typeof SUBMISSION_STATES[number] } | null)?.submission_status) ?? "draft";
    let submitted = false;
    if (data.submit) {
      const { error: stErr } = await supabaseAdmin
        .from("publication_records")
        .update({
          submission_status: "submitted",
          submitted_at: new Date().toISOString(),
          review_notes: null,
        } as never)
        .eq("slug", slug);
      if (stErr) throw new Error(`submission flip failed: ${stErr.message}`);
      submission_status = "submitted";
      submitted = true;
      await persistence.recordEvent({
        slug, event_type: "status.changed",
        payload: { submission_status: "submitted", source: "creator-package" },
        actor: "creator", ownerId,
      });
    }

    // 5. Compute filter_report (asset readiness + metadata completeness) and
    //    persist a publication_record_versions snapshot. New record = v1;
    //    update = current_version + 1. last_activity_at always bumped.
    const { scoreAssets } = await import("@/publication/assets");
    const [freshRecord, freshMeta, freshAssets] = await Promise.all([
      persistence.getRecord(slug),
      persistence.getMetadata(slug),
      persistence.listAssets(slug),
    ]);
    const readiness = scoreAssets(profileId, freshAssets);
    const missingMeta: string[] = [];
    if (!freshMeta?.description?.trim()) missingMeta.push("description");
    if (!freshMeta?.keywords?.length) missingMeta.push("keywords");
    if (!freshMeta?.categories?.length) missingMeta.push("categories");
    if (!freshMeta?.rights) missingMeta.push("rights");
    const hasCover = freshAssets.some((a) => a.is_active && /cover/i.test(a.kind));
    const filterReport = {
      ready: readiness.ready && missingMeta.length === 0 && hasCover,
      score: readiness.score,
      scoreWithRecommended: readiness.scoreWithRecommended,
      missingRequired: readiness.missingRequired,
      missingRecommended: readiness.missingRecommended,
      missingMeta,
      hasCover,
      computed_at: new Date().toISOString(),
    };

    const prevVersion =
      ((existing as unknown as { current_version?: number } | null)?.current_version) ?? 0;
    const nextVersion = existing ? prevVersion + 1 : 1;
    const nowIso = new Date().toISOString();

    const { error: verErr } = await supabaseAdmin
      .from("publication_record_versions")
      .insert({
        slug,
        owner_id: ownerId,
        version: nextVersion,
        snapshot: {
          record: freshRecord,
          metadata: freshMeta,
          assets: freshAssets.filter((a) => a.is_active).map((a) => ({
            kind: a.kind, version: a.version, url: a.url, label: a.label,
          })),
          submission_status,
          sourcePersisted,
          uploadedAssets,
        } as never,
        filter_report: filterReport as never,
      } as never);
    if (verErr) throw new Error(`version snapshot failed: ${verErr.message}`);

    const { error: bumpErr } = await supabaseAdmin
      .from("publication_records")
      .update({
        current_version: nextVersion,
        last_activity_at: nowIso,
        filter_report: filterReport as never,
      } as never)
      .eq("slug", slug);
    if (bumpErr) throw new Error(`record bump failed: ${bumpErr.message}`);

    return {
      slug, created: !existing,
      sourcePersisted, uploadedAssets, submission_status, submitted,
      version: nextVersion, filterReport,
    };
  });


/** Creator: flip an existing draft to submitted for ASCEND review. */
export const submitForReview = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await import("@/publication/persistence.server");
    const rec = await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("publication_records")
      .update({
        submission_status: "submitted",
        submitted_at: new Date().toISOString(),
        review_notes: null,
      } as never)
      .eq("slug", data.slug);
    if (error) throw new Error(error.message);
    await p.recordEvent({
      slug: data.slug, event_type: "status.changed",
      payload: { submission_status: "submitted" },
      actor: "creator", ownerId: rec.owner_id,
    });
    return { ok: true };
  });

/** OWNER review action: approve / request changes / advance lifecycle. */
export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireOwner])
  .inputValidator((d: unknown) => z.object({
    slug: z.string(),
    action: submissionStateEnum,
    notes: z.string().max(2000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rec = await p.getRecord(data.slug);
    if (!rec) throw new Error(`Unknown publication: ${data.slug}`);
    const patch: Record<string, unknown> = {
      submission_status: data.action,
      review_notes: data.notes ?? null,
    };
    const { error } = await supabaseAdmin
      .from("publication_records").update(patch as never).eq("slug", data.slug);
    if (error) throw new Error(error.message);
    await p.recordEvent({
      slug: data.slug, event_type: "status.changed",
      payload: { submission_status: data.action, review_notes: data.notes ?? null },
      actor: "admin", ownerId: rec.owner_id,
    });
    return { ok: true };
  });

/** OWNER review queue: all submitted/in-flight packages with readiness. */
export const listSubmissionQueue = createServerFn({ method: "GET" })
  .middleware([requireOwner])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const p = await import("@/publication/persistence.server");
    const { scoreAssets } = await import("@/publication/assets");
    const { data: recs, error } = await supabaseAdmin
      .from("publication_records")
      .select("*")
      .in("submission_status", [
        "submitted","needs_changes","approved",
        "in_production","ready_for_distribution",
      ])
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (recs ?? []) as unknown as Array<{
      slug: string; title: string; author: string; profile: string;
      owner_id: string | null; submission_status: string;
      submitted_at: string | null; review_notes: string | null;
      last_updated: string;
    }>;

    const enriched = await Promise.all(rows.map(async (r) => {
      const [meta, assets] = await Promise.all([
        p.getMetadata(r.slug), p.listAssets(r.slug),
      ]);
      const readiness = scoreAssets(r.profile, assets);
      // Pull creator email via Admin API
      let creatorEmail: string | null = null;
      if (r.owner_id) {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.owner_id);
          creatorEmail = u?.user?.email ?? null;
        } catch { /* ignore */ }
      }
      const missingMeta: string[] = [];
      if (!meta?.description?.trim()) missingMeta.push("description");
      if (!meta?.keywords?.length) missingMeta.push("keywords");
      if (!meta?.categories?.length) missingMeta.push("categories");
      if (!meta?.rights) missingMeta.push("rights");
      return {
        record: r,
        creatorEmail,
        readiness,
        missingMeta,
        hasCover: assets.some((a) => a.is_active && /cover/i.test(a.kind)),
      };
    }));
    return enriched;
  });

/** Creator: list own packages with version + activity for the dashboard. */
export const listMyPackages = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("publication_records")
      .select("slug,title,author,status,profile,submission_status,current_version,last_activity_at,filter_report,last_updated,owner_id")
      .order("last_activity_at", { ascending: false, nullsFirst: false });
    if (!context.isOwner) q = q.eq("owner_id", context.userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      slug: string; title: string; author: string; status: string; profile: string;
      submission_status: string | null;
      current_version: number | null;
      last_activity_at: string | null;
      filter_report: unknown;
      last_updated: string;
      owner_id: string | null;
    }>;
  });

/** Owner or owning creator: list every persisted version snapshot for a slug. */
export const listPackageVersions = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const p = await import("@/publication/persistence.server");
    await p.assertOwns(data.slug, context.userId, context.isOwner);
    const { data: rows, error } = await supabaseAdmin
      .from("publication_record_versions")
      .select("id,version,snapshot,filter_report,created_at")
      .eq("slug", data.slug)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string; version: number;
      snapshot: unknown;
      filter_report: unknown;
      created_at: string;
    }>;
  });

