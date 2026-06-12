/* PTL-020 Phase 8E — Export Preparation Layer
   Architecture + validation. Wraps the existing renderers (EPUB/Kindle
   via src/manuscript/package/epub-zip.ts; PDF via src/styles/modes/pdf.css
   + reader route; HTML reader via /ascend/reader/:slug) behind a single
   coordinator that:
     1. checks the manuscript is in an exportable status
     2. verifies the chosen profile permits the target
     3. surfaces validation issues from the enrichment pipeline
     4. returns a "ready / blocked" verdict per target
   It does NOT re-run conversion — that stays in /manuscript/package. */
import type { EnrichResult } from "@/manuscript/pipeline";
import type { PublicationRecord } from "./status";
import { getProfile } from "./profiles";

export type ExportTarget = "epub" | "kindle" | "pdf" | "html-reader";
export const EXPORT_TARGETS: ExportTarget[] = ["epub", "kindle", "pdf", "html-reader"];

export interface ExportCheck {
  target: ExportTarget;
  ready: boolean;
  blockers: string[];
  warnings: string[];
}

export interface ExportPlan {
  slug: string;
  profileId: string;
  checks: ExportCheck[];
  /** True when every blocker is empty across all targets the profile permits. */
  allReady: boolean;
}

const EXPORTABLE_STATUSES = new Set(["formatting", "ready", "published"]);

export function planExports(record: PublicationRecord, enriched: EnrichResult): ExportPlan {
  const profile = getProfile(record.profile);
  const checks: ExportCheck[] = EXPORT_TARGETS.map((target) => {
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!profile) {
      blockers.push(`Unknown profile "${record.profile}"`);
    } else if (!profile.behavior.export.targets.includes(target)) {
      blockers.push(`Profile "${profile.id}" does not allow target "${target}"`);
    }

    if (!EXPORTABLE_STATUSES.has(record.status)) {
      blockers.push(`Status "${record.status}" is not exportable (need formatting/ready/published)`);
    }

    const errorIssues = enriched.report.issues.filter((i) => i.severity === "error");
    if (errorIssues.length > 0) {
      blockers.push(`${errorIssues.length} validation error(s) — see /ascend/validate/${record.slug}`);
    }
    const warnIssues = enriched.report.issues.filter((i) => i.severity === "warning");
    if (warnIssues.length > 0) {
      warnings.push(`${warnIssues.length} validation warning(s)`);
    }

    if (target === "kindle" && profile?.behavior.export.epubProfile !== "kindle") {
      warnings.push("Profile defaults to epub3; kindle export will use KF8-safe overrides");
    }

    return { target, ready: blockers.length === 0, blockers, warnings };
  });

  const permitted = profile?.behavior.export.targets ?? [];
  const allReady =
    permitted.length > 0 &&
    checks.filter((c) => permitted.includes(c.target)).every((c) => c.ready);

  return { slug: record.slug, profileId: record.profile, checks, allReady };
}
