/* PTL-028 Phase 17C — End-to-end publication dry-run.
   Runs the full pipeline against a real publication slug without performing
   any live storefront submission. Composes existing building blocks:
     auditPublication → generateArtifacts (if needed) → KDP adapter dry-run.
   Returns a single readiness report classifying the publication as
   READY / READY_WITH_WARNINGS / BLOCKED. */
import type { PublicationAudit } from "./audit.server";
import { auditPublication } from "./audit.server";
import { runArtifactGenerationForSlug } from "./runner-orchestrator.server";
import { runKdpAdapter, type KdpAdapterResult } from "./kdp-adapter.server";

export type DryRunVerdict = "READY" | "READY_WITH_WARNINGS" | "BLOCKED";

export interface DryRunReport {
  slug: string;
  verdict: DryRunVerdict;
  readinessScore: number;
  audit: PublicationAudit;
  artifactsGenerated: boolean;
  artifactSummary: {
    epub: boolean; kindle: boolean; pdf: boolean; activeCount: number;
  };
  kdp: KdpAdapterResult;
  blockers: string[];
  warnings: string[];
}

export interface RunDryRunInput {
  slug: string;
  /** When true, regenerate artifacts before validating. Defaults false. */
  forceRegenerate?: boolean;
}

export async function runPublicationDryRun(input: RunDryRunInput): Promise<DryRunReport> {
  const slug = input.slug;

  // 1) Initial audit
  let audit = await auditPublication(slug);

  // 2) Generate artifacts if missing or forced
  const needArtifacts = input.forceRegenerate || audit.facts.activeArtifactCount === 0;
  let artifactsGenerated = false;
  if (needArtifacts && audit.facts.hasRecord) {
    try {
      await runArtifactGenerationForSlug({
        slug, storeTargets: [], sourceQueueId: null, actor: "dry-run",
      });
      artifactsGenerated = true;
      audit = await auditPublication(slug);
    } catch (e) {
      audit.blockers.push(`Artifact generation failed: ${String(e)}`);
    }
  }

  // 3) KDP adapter dry-run (always)
  const kdp = await runKdpAdapter({ slug, live: false });

  // 4) Aggregate blockers / warnings
  const blockers = Array.from(new Set([
    ...audit.blockers,
    ...kdp.issues.filter((i) => i.level === "error").map((i) => `KDP: ${i.field} — ${i.message}`),
  ]));
  const warnings = Array.from(new Set([
    ...audit.warnings,
    ...kdp.issues.filter((i) => i.level === "warning").map((i) => `KDP: ${i.field} — ${i.message}`),
  ]));

  const verdict: DryRunVerdict =
    blockers.length > 0 ? "BLOCKED"
    : warnings.length > 0 ? "READY_WITH_WARNINGS"
    : "READY";

  return {
    slug,
    verdict,
    readinessScore: audit.readiness?.percent ?? 0,
    audit,
    artifactsGenerated,
    artifactSummary: {
      epub: audit.facts.hasEpubArtifact,
      kindle: audit.facts.hasKindleArtifact,
      pdf: audit.facts.hasPdfArtifact,
      activeCount: audit.facts.activeArtifactCount,
    },
    kdp,
    blockers,
    warnings,
  };
}
