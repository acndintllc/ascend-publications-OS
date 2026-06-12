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
    });
    await persistence.recordEvent({
      slug: entry.slug,
      event_type: "publication.created",
      payload: { profile: profileId, source: "library-seed" },
      actor: "system",
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
    const before = await p.getRecord(data.slug);
    await p.upsertRecord(data);
    const profileChanged =
      data.profile !== undefined && before && before.profile !== data.profile;
    await p.recordEvent({
      slug: data.slug,
      event_type: profileChanged ? "profile.changed" : "metadata.updated",
      payload: profileChanged
        ? { from: before?.profile, to: data.profile }
        : { fields: Object.keys(data).filter((k) => k !== "slug") },
    });
    return { ok: true };
  });

export const updatePublicationMetadata = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => metadataPatch.parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    await p.upsertMetadata(data);
    await p.recordEvent({
      slug: data.slug,
      event_type: "metadata.updated",
      payload: { fields: Object.keys(data).filter((k) => k !== "slug") },
    });
    return { ok: true };
  });

export const updatePublicationVera = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => veraConfigPatch.parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    await p.upsertVeraConfig(data);
    await p.recordEvent({
      slug: data.slug,
      event_type: "vera.updated",
      payload: { enabled_kinds: data.enabled_kinds, default_voice: data.default_voice },
    });
    return { ok: true };
  });

export const transitionPublicationStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), next: statusEnum, notes: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    const before = await p.getRecord(data.slug);
    await p.transitionStatus(data.slug, data.next as PublicationStatus, data.notes);
    await p.recordEvent({
      slug: data.slug,
      event_type: "status.changed",
      payload: { from: before?.status, to: data.next, notes: data.notes ?? null },
    });
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
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    return p.listAssets(data.slug);
  });

export const listAllPublicationAssets = createServerFn({ method: "GET" }).handler(async () => {
  const p = await import("@/publication/persistence.server");
  return p.listAllAssets();
});

export const uploadPublicationAsset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => assetUploadSchema.parse(d))
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    const { asset, replaced } = await p.uploadAsset(data);
    await p.recordEvent({
      slug: data.slug,
      event_type: replaced ? "asset.replaced" : "asset.uploaded",
      payload: {
        kind: data.kind,
        version: asset.version,
        url: data.url,
        replaced_id: replaced?.id ?? null,
      },
    });
    await p.recordEvent({
      slug: data.slug,
      event_type: "readiness.recomputed",
      payload: { trigger: replaced ? "asset.replaced" : "asset.uploaded" },
    });
    return { asset, replaced };
  });

export const deactivatePublicationAsset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    const asset = await p.deactivateAsset(data.id);
    await p.recordEvent({
      slug: data.slug,
      event_type: "asset.deactivated",
      payload: { id: data.id, kind: asset.kind, version: asset.version },
    });
    return { asset };
  });

/* ─── 9F: event log server fn ────────────────────────────────────── */

export const listPublicationEvents = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; limit?: number }) =>
    z.object({ slug: z.string(), limit: z.number().int().positive().max(200).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const p = await import("@/publication/persistence.server");
    return p.listEvents(data.slug, data.limit ?? 50);
  });


/* ─── Phase 10A: storage-backed asset uploads ───────────────────── */

export const createAssetUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), kind: z.string(), filename: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await import("@/publication/storage.server");
    return s.createSignedUpload(data);
  });

/* ─── Phase 10C: distribution queue ─────────────────────────────── */

const queueState = z.enum([
  "queued","processing","blocked","ready","submitted","failed",
]);

export const listDistributionQueue = createServerFn({ method: "GET" })
  .inputValidator((d: { slug?: string }) =>
    z.object({ slug: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const q = await import("@/publication/queue.server");
    return q.listQueue(data.slug);
  });

export const enqueueDistribution = createServerFn({ method: "POST" })
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

    // Phase 13C — Automated preparation on transition to "ready".
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
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      storeTargets: z.array(z.string()).optional(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { runArtifactGenerationForSlug } = await import("@/publication/runner-orchestrator.server");
    return runArtifactGenerationForSlug({
      slug: data.slug,
      storeTargets: (data.storeTargets ?? []) as never,
      sourceQueueId: data.sourceQueueId ?? null,
      actor: data.actor ?? "manual",
    });
  });

export const listPublicationArtifacts = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/runner.server");
    const rows = await r.listArtifacts(data.slug);
    // Pre-sign active artifacts (others omitted to keep payload bounded).
    const signed: Record<string, string> = {};
    for (const a of rows.filter((x) => x.is_active)) {
      const url = await r.signArtifact(a.storage_path);
      if (url) signed[a.id] = url;
    }
    return { rows, signed };
  });

export const signArtifactUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/runner.server");
    return { url: await r.signArtifact(data.path) };
  });

/* ─── PTL-026 Phase 15A — Reference external PDF runner ───────────── */

const runnerModeEnum = z.enum(["ok", "invalid_signature", "missing_artifact", "failed_generation"]);

export const runReferencePdfRunner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      mode: runnerModeEnum.optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
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

/* ─── PTL-025 Phase 14B — ISBN registry server fns ────────────────── */

export const listIsbns = createServerFn({ method: "GET" })
  .inputValidator((d: { slug?: string }) => z.object({ slug: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    return r.listIsbns(data.slug);
  });

export const assignIsbn = createServerFn({ method: "POST" })
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
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    await r.deleteIsbn(data.id);
    return { ok: true };
  });

/* ─── PTL-025 Phase 14D — Vendor server fns ───────────────────────── */

export const listVendors = createServerFn({ method: "GET" }).handler(async () => {
  const r = await import("@/publication/registry-extra.server");
  return r.listVendors();
});

export const upsertVendor = createServerFn({ method: "POST" })
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
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    await r.deleteVendor(data.id);
    return { ok: true };
  });

/* ─── PTL-025 Phase 14C — Submission server fns ───────────────────── */

export const listSubmissions = createServerFn({ method: "GET" })
  .inputValidator((d: { slug?: string }) => z.object({ slug: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const r = await import("@/publication/registry-extra.server");
    return r.listSubmissions(data.slug);
  });

export const createSubmission = createServerFn({ method: "POST" })
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
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { auditPublication } = await import("@/publication/audit.server");
    return auditPublication(data.slug);
  });

/* ─── PTL-027 Phase 16A — Reference external KFX runner ───────────── */

export const runReferenceKfxRunner = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      mode: runnerModeEnum.optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
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

/* ─── PTL-027 Phase 16B — Submission package builder ──────────────── */

export const buildPublicationSubmissionPackage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), platform: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { buildSubmissionPackage } = await import("@/publication/submission-package.server");
    return buildSubmissionPackage(data.slug, data.platform as never);
  });

/* ─── PTL-027 Phase 16C — Vendor secret report ────────────────────── */

export const reportVendorSecretsFn = createServerFn({ method: "GET" }).handler(async () => {
  const r = await import("@/publication/registry-extra.server");
  const { reportVendorSecrets } = await import("@/publication/vendor-secrets.server");
  const vendors = await r.listVendors();
  return reportVendorSecrets(vendors);
});

/* ─── PTL-027 Phase 16D — ISBN lifecycle transition ───────────────── */

export const transitionIsbn = createServerFn({ method: "POST" })
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
  .inputValidator((d: unknown) =>
    z.object({
      slug: z.string(),
      sourceQueueId: z.string().uuid().nullable().optional(),
      actor: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
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

export const listRunnerProvidersFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listProviders } = await import("@/publication/runner-provider");
  return listProviders().map((p) => ({
    id: p.id, kind: p.kind, label: p.label,
    available: p.available(), fallback: p.fallback,
  }));
});

/* ─── PTL-028 Phase 17B — KDP submission adapter ──────────────────── */

export const runKdpAdapterFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), live: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { runKdpAdapter } = await import("@/publication/kdp-adapter.server");
    return runKdpAdapter({ slug: data.slug, live: data.live ?? false });
  });

/* ─── PTL-028 Phase 17C — Publication dry-run ─────────────────────── */

export const runPublicationDryRunFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), forceRegenerate: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { runPublicationDryRun } = await import("@/publication/dry-run.server");
    return runPublicationDryRun({ slug: data.slug, forceRegenerate: data.forceRegenerate });
  });


