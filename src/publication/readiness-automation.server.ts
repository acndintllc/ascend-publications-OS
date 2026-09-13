/* PTL-029 Phase 18C — Operational Readiness Automation.
   Triggered after any publication status change. Re-runs auditPublication,
   computes a summary, and persists a readiness.recomputed event. */
import { auditPublication, type PublicationAudit } from "./audit.server";
import { recordEvent } from "./persistence.server";

export interface ReadinessAutomationResult {
  slug: string;
  score: number;
  ready: boolean;
  blockers: string[];
  warnings: string[];
  summary: {
    activeArtifactCount: number;
    activeAssetCount: number;
    isbnCount: number;
    targetsMissingIsbn: string[];
  };
  audit: PublicationAudit;
}

export async function revalidateReadiness(slug: string, trigger = "status.changed"): Promise<ReadinessAutomationResult> {
  const audit = await auditPublication(slug);
  const score = audit.readiness?.percent ?? 0;
  const ready = audit.readiness?.ready ?? false;
  const result: ReadinessAutomationResult = {
    slug, score, ready,
    blockers: audit.blockers, warnings: audit.warnings,
    summary: {
      activeArtifactCount: audit.facts.activeArtifactCount,
      activeAssetCount: audit.facts.activeAssetCount,
      isbnCount: audit.facts.isbnCount,
      targetsMissingIsbn: audit.facts.targetsMissingIsbn,
    },
    audit,
  };
  await recordEvent({
    slug, event_type: "readiness.recomputed",
    payload: {
      trigger, score, ready,
      blockerCount: audit.blockers.length,
      warningCount: audit.warnings.length,
      activeArtifactCount: audit.facts.activeArtifactCount,
      isbnCount: audit.facts.isbnCount,
    },
  });
  return result;
}
