/* PTL-025 Phase 14F — First-publication readiness audit. Server-only.
   Scope ends at the export file: no vendor, submission, or queue facts. */
import { resolveManuscriptForSlug } from "@/manuscript/resolver.server";
import { enrich } from "@/manuscript/pipeline";
import { getProfile } from "./profiles";
import { planExports } from "./export";
import { computeReadiness, type ReadinessReport } from "./readiness";
import { publicationMetadataSchema, type PublicationMetadata } from "./metadata";
import { evaluateIsbnCoverage, ISBN_REQUIRED_TARGETS } from "./isbn";
import {
  getRecord, getMetadata, listAssets,
} from "./persistence.server";
import { listIsbns } from "./registry-extra.server";
import { listArtifacts } from "./runner.server";

export interface PublicationAudit {
  slug: string;
  readiness: ReadinessReport | null;
  blockers: string[];
  warnings: string[];
  facts: {
    hasRecord: boolean;
    hasMetadata: boolean;
    assetCount: number;
    activeAssetCount: number;
    artifactCount: number;
    activeArtifactCount: number;
    hasEpubArtifact: boolean;
    hasKindleArtifact: boolean;
    hasPdfArtifact: boolean;
    isbnCount: number;
    targetsMissingIsbn: string[];
  };
}


export async function auditPublication(slug: string): Promise<PublicationAudit> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const [record, metaRow, assets, isbns, artifacts] = await Promise.all([
    getRecord(slug),
    getMetadata(slug),
    listAssets(slug),
    listIsbns(slug),
    listArtifacts(slug),
  ]);

  if (!record) {
    blockers.push("No publication record");
    return {
      slug, readiness: null, blockers, warnings,
      facts: {
        hasRecord: false, hasMetadata: false, assetCount: 0, activeAssetCount: 0,
        artifactCount: 0, activeArtifactCount: 0,
        hasEpubArtifact: false, hasKindleArtifact: false, hasPdfArtifact: false,
        isbnCount: 0, targetsMissingIsbn: [],
      },
    };
  }


  const profile = getProfile(record.profile);
  if (!profile) blockers.push(`Unknown profile: ${record.profile}`);

  const lib = await resolveManuscriptForSlug(slug);
  let readiness: ReadinessReport | null = null;
  let parsed: PublicationMetadata | null = null;
  if (lib && profile) {
    const enriched = enrich(lib.doc, { bib: lib.bib, vera: lib.veraSidecar });
    const recordForPlan = {
      slug: record.slug, title: record.title, subtitle: record.subtitle ?? undefined,
      series: record.series ?? undefined, volume: record.volume ?? undefined,
      status: record.status, version: record.version, profile: record.profile,
      lastUpdated: record.last_updated, author: record.author,
    };
    const exportPlan = planExports(recordForPlan, enriched);
    const errs = enriched.report.issues.filter((i) => i.severity === "error").length;
    const warns = enriched.report.issues.filter((i) => i.severity === "warning").length;

    const p = publicationMetadataSchema.safeParse({
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
    if (p.success) {
      parsed = p.data;
      readiness = computeReadiness({
        slug, status: record.status, profileId: record.profile,
        metadata: parsed, assets, exportPlan,
        validationErrorCount: errs, validationWarnCount: warns,
      });
    } else {
      blockers.push(`Metadata invalid: ${p.error.issues[0]?.message ?? "schema failure"}`);
    }
  } else if (!lib) {
    warnings.push("No bundled manuscript — readiness limited to persisted state");
  }

  // ISBN coverage against profile distribution targets
  const targets = profile?.behavior.export.targets ?? [];
  // Map export targets to distribution targets (heuristic): treat all profile targets as candidates
  const distTargets = ISBN_REQUIRED_TARGETS.filter((t) => {
    if (t === "apple-books" || t === "google-play-books") return targets.length > 0;
    return true;
  });
  const isbnCov = evaluateIsbnCoverage(isbns, distTargets);
  const targetsMissingIsbn = isbnCov.missingForTargets;
  if (targetsMissingIsbn.length > 0) {
    blockers.push(`ISBN required for: ${targetsMissingIsbn.join(", ")}`);
  }
  if (isbnCov.invalidIsbns.length > 0) {
    blockers.push(`Invalid ISBN-13 checksum: ${isbnCov.invalidIsbns.join(", ")}`);
  }

  // Artifact presence
  const activeArtifacts = artifacts.filter((a) => a.is_active);
  if (activeArtifacts.length === 0) {
    blockers.push("No generated artifacts (run artifact pipeline)");
  } else {
    const haveEpub = activeArtifacts.some((a) => a.kind === "epub");
    const haveKindle = activeArtifacts.some((a) => a.kind === "kindle");
    if (targets.includes("epub") && !haveEpub) blockers.push("Missing active EPUB artifact");
    if (targets.includes("kindle") && !haveKindle) blockers.push("Missing active Kindle artifact");
  }

  // Lifecycle gate
  if (record.status !== "ready" && record.status !== "published") {
    blockers.push(`Publication status "${record.status}" not at ready/published`);
  }

  const haveEpub = activeArtifacts.some((a) => a.kind === "epub");
  const haveKindle = activeArtifacts.some((a) => a.kind === "kindle");
  const havePdf = activeArtifacts.some((a) => a.kind === "pdf");

  return {
    slug,
    readiness,
    blockers: Array.from(new Set([...(readiness?.blockers ?? []), ...blockers])),
    warnings: Array.from(new Set([...(readiness?.recommendations ?? []), ...warnings])),
    facts: {
      hasRecord: true,
      hasMetadata: !!metaRow,
      assetCount: assets.length,
      activeAssetCount: assets.filter((a) => a.is_active).length,
      artifactCount: artifacts.length,
      activeArtifactCount: activeArtifacts.length,
      hasEpubArtifact: haveEpub,
      hasKindleArtifact: haveKindle,
      hasPdfArtifact: havePdf,
      isbnCount: isbns.length,
      targetsMissingIsbn,
    },
  };
}

