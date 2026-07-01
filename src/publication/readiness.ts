/* PTL-024 Phase 10D — Composite Readiness Engine.
   Aggregates metadata completeness, asset readiness, profile rules,
   export validation, and publication status into a single score. */
import type { PublicationMetadata } from "./metadata";
import { adaptForAllTargets } from "./metadata";
import type { AssetRecord } from "./assets";
import { scoreAssets, PROFILE_ASSET_REQUIREMENTS } from "./assets";
import { getProfile } from "./profiles";
import type { PublicationStatus } from "./status";
import type { ExportPlan } from "./export";

export interface ReadinessSignal {
  id: string;
  label: string;
  weight: number;       // 0..1
  score: number;        // 0..1
  blockers: string[];
  recommendations: string[];
}

export interface ReadinessReport {
  slug: string;
  overall: number;            // 0..1 weighted
  percent: number;            // 0..100 integer
  ready: boolean;             // every blocker empty
  status: PublicationStatus;
  signals: ReadinessSignal[];
  blockers: string[];
  recommendations: string[];
}

export interface ReadinessInput {
  slug: string;
  status: PublicationStatus;
  profileId: string;
  metadata: PublicationMetadata | null;
  assets: AssetRecord[];
  exportPlan?: ExportPlan;
  validationErrorCount?: number;
  validationWarnCount?: number;
}

const METADATA_REQUIRED: (keyof PublicationMetadata)[] = [
  "title","author","description","keywords","categories","language",
];

export function computeReadiness(input: ReadinessInput): ReadinessReport {
  const profile = getProfile(input.profileId);
  const signals: ReadinessSignal[] = [];

  // 1. Metadata completeness
  const metaSignal: ReadinessSignal = {
    id: "metadata",
    label: "Metadata completeness",
    weight: 0.3,
    score: 0,
    blockers: [],
    recommendations: [],
  };
  if (!input.metadata) {
    metaSignal.blockers.push("No metadata record");
  } else {
    let present = 0;
    for (const f of METADATA_REQUIRED) {
      const v = input.metadata[f];
      const missing = v == null || (Array.isArray(v) && v.length === 0) || v === "";
      if (missing) metaSignal.blockers.push(`Missing ${String(f)}`);
      else present++;
    }
    metaSignal.score = present / METADATA_REQUIRED.length;
    if (!input.metadata.isbn) metaSignal.recommendations.push("Assign ISBN (required for Apple Books / Google Play)");
    if (input.metadata.keywords.length === 0) metaSignal.recommendations.push("Add at least 3 keywords");
  }
  signals.push(metaSignal);

  // 2. Asset readiness
  const assetReadiness = scoreAssets(input.profileId, input.assets);
  signals.push({
    id: "assets",
    label: "Asset readiness",
    weight: 0.25,
    score: assetReadiness.score,
    blockers: assetReadiness.missingRequired.map((k) => `Missing required asset: ${k}`),
    recommendations: assetReadiness.missingRecommended.map((k) => `Recommended asset: ${k}`),
  });

  // 3. Profile compliance
  const profileSignal: ReadinessSignal = {
    id: "profile",
    label: "Profile compliance",
    weight: 0.1,
    score: 1,
    blockers: [],
    recommendations: [],
  };
  if (!profile) {
    profileSignal.blockers.push(`Unknown profile "${input.profileId}"`);
    profileSignal.score = 0;
  } else {
    if (!profile.behavior.allowedStatuses.includes(input.status)) {
      profileSignal.blockers.push(`Status "${input.status}" not allowed by profile "${profile.id}"`);
      profileSignal.score = 0;
    }
    if (!PROFILE_ASSET_REQUIREMENTS[input.profileId]) {
      profileSignal.recommendations.push("Profile has no asset requirements defined");
    }
  }
  signals.push(profileSignal);

  // 4. Export validation
  const exportSignal: ReadinessSignal = {
    id: "export",
    label: "Export validation",
    weight: 0.2,
    score: 1,
    blockers: [],
    recommendations: [],
  };
  if (input.exportPlan) {
    const permitted = profile?.behavior.export.targets ?? [];
    const relevant = input.exportPlan.checks.filter((c) => permitted.includes(c.target));
    if (relevant.length > 0) {
      const ok = relevant.filter((c) => c.ready).length;
      exportSignal.score = ok / relevant.length;
      relevant.filter((c) => !c.ready).forEach((c) => {
        c.blockers.forEach((b) => exportSignal.blockers.push(`${c.target}: ${b}`));
      });
      relevant.forEach((c) => c.warnings.forEach((w) => exportSignal.recommendations.push(`${c.target}: ${w}`)));
    }
  } else {
    exportSignal.score = 0;
    exportSignal.blockers.push("Export plan not computed");
  }
  if ((input.validationErrorCount ?? 0) > 0) {
    exportSignal.blockers.push(`${input.validationErrorCount} manuscript validation error(s)`);
    exportSignal.score = 0;
  }
  if ((input.validationWarnCount ?? 0) > 0) {
    exportSignal.recommendations.push(`${input.validationWarnCount} manuscript validation warning(s)`);
  }
  signals.push(exportSignal);

  // 5. Lifecycle / status
  const statusSignal: ReadinessSignal = {
    id: "status",
    label: "Lifecycle status",
    weight: 0.15,
    score: 0,
    blockers: [],
    recommendations: [],
  };
  const statusScores: Record<PublicationStatus, number> = {
    draft: 0.1, editing: 0.3, review: 0.5, formatting: 0.7,
    approved: 0.85, ready: 0.9, package_generated: 0.97,
    published: 1, archived: 0.4,
  };
  statusSignal.score = statusScores[input.status];
  if (input.status === "draft" || input.status === "editing") {
    statusSignal.recommendations.push("Advance to review when content is stable");
  }
  if (input.status === "archived") {
    statusSignal.blockers.push("Archived publications cannot be distributed");
  }
  signals.push(statusSignal);

  // 6. Distribution-target metadata (across all targets)
  if (input.metadata) {
    const adapters = adaptForAllTargets(input.metadata);
    const errs = adapters.flatMap((a) => a.issues.filter((i) => i.level === "error"));
    if (errs.length > 0) {
      metaSignal.blockers.push(...errs.slice(0, 5).map((e) => `${e.field}: ${e.message}`));
    }
  }

  const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
  const overall = signals.reduce((s, x) => s + x.weight * x.score, 0) / totalWeight;
  const blockers = signals.flatMap((s) => s.blockers);
  const recommendations = signals.flatMap((s) => s.recommendations);
  return {
    slug: input.slug,
    overall,
    percent: Math.round(overall * 100),
    ready: blockers.length === 0,
    status: input.status,
    signals,
    blockers,
    recommendations,
  };
}
