/* PTL-026 Phase 13A/13C — Server-only orchestrator that resolves a slug
   into the full set of inputs required by the artifact runner and
   invokes it. Lives in its own .server.ts file so we can pull the
   build-time manuscript library + admin storage without leaking the
   library glob graph into the auto-prepare client bundle. */
import { resolveManuscriptForSlug } from "@/manuscript/resolver.server";
import { enrich } from "@/manuscript/pipeline";
import { getProfile } from "@/publication/profiles";
import { planExports } from "@/publication/export";
import { computeReadiness } from "@/publication/readiness";
import {
  publicationMetadataSchema,
  type DistributionTarget,
  type PublicationMetadata,
} from "@/publication/metadata";
import { generateArtifacts, type GenerateResult } from "@/publication/runner.server";
import {
  getRecord,
  getMetadata,
  listAssets,
  recordEvent,
} from "@/publication/persistence.server";

export interface OrchestratorInput {
  slug: string;
  storeTargets?: DistributionTarget[];
  sourceQueueId?: string | null;
  actor?: string;
}

export async function runArtifactGenerationForSlug(
  input: OrchestratorInput,
): Promise<GenerateResult> {
  const { slug } = input;
  const [record, metaRow, assets] = await Promise.all([
    getRecord(slug), getMetadata(slug), listAssets(slug),
  ]);
  if (!record) throw new Error(`Unknown publication: ${slug}`);
  const profile = getProfile(record.profile);
  if (!profile) throw new Error(`Unknown profile: ${record.profile}`);

  const lib = await resolveManuscriptForSlug(slug);
  if (!lib) throw new Error(`No manuscript source for slug: ${slug}`);
  const enriched = enrich(lib.doc, { bib: lib.bib, vera: lib.veraSidecar });

  const parsed = publicationMetadataSchema.safeParse({
    title: record.title,
    subtitle: record.subtitle ?? undefined,
    description: metaRow?.description || record.title,
    keywords: metaRow?.keywords ?? [],
    categories: metaRow?.categories ?? [],
    author: record.author,
    contributors: metaRow?.contributors ?? [],
    language: record.language,
    audience: record.audience ?? undefined,
    publicationDate: record.publication_date ?? undefined,
    isbn: metaRow?.isbn ?? undefined,
    publisher: metaRow?.publisher ?? "ASCEND Media",
    rights: metaRow?.rights ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(`Metadata invalid for ${slug}: ${parsed.error.message}`);
  }
  const metadata: PublicationMetadata = parsed.data;

  const recordForPlan = {
    slug: record.slug, title: record.title, subtitle: record.subtitle ?? undefined,
    series: record.series ?? undefined, volume: record.volume ?? undefined,
    status: record.status, version: record.version, profile: record.profile,
    lastUpdated: record.last_updated, author: record.author,
  };
  const exportPlan = planExports(recordForPlan, enriched);
  const errCount = enriched.report.issues.filter((i) => i.severity === "error").length;
  const warnCount = enriched.report.issues.filter((i) => i.severity === "warning").length;

  const readiness = computeReadiness({
    slug, status: record.status, profileId: record.profile, metadata,
    assets, exportPlan, validationErrorCount: errCount, validationWarnCount: warnCount,
  });

  const result = await generateArtifacts({
    slug, doc: enriched.doc, metadata, profile, assets, readiness,
    storeTargets: input.storeTargets ?? [],
    sourceQueueId: input.sourceQueueId ?? null,
    actor: input.actor,
  });

  await recordEvent({
    slug,
    event_type: "export.requested",
    payload: {
      artifact_run: true,
      artifact_count: result.artifacts.length,
      readiness_percent: readiness.percent,
      package_url: result.packageUrl,
      source_queue_id: input.sourceQueueId ?? null,
    },
    actor: input.actor ?? null,
  });
  await recordEvent({
    slug,
    event_type: "readiness.recomputed",
    payload: { trigger: "artifact-generation", percent: readiness.percent },
    actor: input.actor ?? null,
  });

  return result;
}
