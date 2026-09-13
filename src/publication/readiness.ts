/* PTL-024 Phase 10D — Composite Readiness Engine.
   PTL-030 Phase 19B — readiness is now per-destination.

   Aggregates metadata completeness, asset readiness, profile rules,
   export validation and publication status into a score, AND runs the
   acceptance catalogue to answer the question the score cannot:
   which storefronts will accept this book. A title can be ready for
   Kobo and blocked on Apple; one global boolean cannot say so. */
import type { PublicationMetadata } from "./metadata";
import { adaptForAllTargets } from "./metadata";
import type { AssetRecord } from "./assets";
import { scoreAssets, PROFILE_ASSET_REQUIREMENTS } from "./assets";
import { getProfile } from "./profiles";
import type { PublicationStatus } from "./status";
import type { ExportPlan } from "./export";
import type { DistributionTarget } from "./metadata";
import type { IsbnRow } from "./isbn";
import type { SerializedPayload } from "./serializers";
import { runPreflight } from "./preflight/evaluate";
import type { DestinationVerdict, ReadinessFinding } from "./preflight/types";

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
  /** Composite gate: no signal blockers AND every evaluated destination ready. */
  ready: boolean;
  status: PublicationStatus;
  signals: ReadinessSignal[];
  /** Flat projections of `findings`, kept for existing consumers. The typed
   *  findings are the source of truth; these are a view over them. */
  blockers: string[];
  recommendations: string[];
  /** Typed acceptance findings — the report as a record, not prose. */
  findings: ReadinessFinding[];
  /** One verdict per destination. The answer the product exists to give. */
  byDestination: DestinationVerdict[];
  /** Catalogue rules in scope that need artifact bytes (Phase 19C) and were
   *  therefore NOT checked. Never let a verdict imply otherwise. */
  notEvaluated: string[];
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
  /** Storefronts to evaluate. Defaults to every supported destination. */
  destinations?: DistributionTarget[];
  /** ISBNs on file. Optional everywhere, but checksums are still validated. */
  isbns?: IsbnRow[];
  /** Serializer output, so its per-destination issues reach the verdict
   *  instead of being computed and discarded. */
  serialized?: SerializedPayload[];
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

  // 7. Acceptance preflight, per destination.
  const destinations = input.destinations ?? DEFAULT_DESTINATIONS;
  const preflight = runPreflight({
    metadata: input.metadata,
    isbns: input.isbns ?? [],
    destinations,
    serialized: input.serialized,
  });
  const byDestination = destinations.map((destination) =>
    verdictFor(destination, preflight.findings),
  );

  const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
  const overall = signals.reduce((s, x) => s + x.weight * x.score, 0) / totalWeight;
  const signalBlockers = signals.flatMap((s) => s.blockers);
  const recommendations = signals.flatMap((s) => s.recommendations);
  const blockers = [
    ...signalBlockers,
    ...preflight.findings
      .filter((f) => f.severity === "blocker" && !f.requiresHumanConfirmation)
      .map((f) => `${f.destination}: ${f.message}`),
  ];
  return {
    slug: input.slug,
    overall,
    percent: Math.round(overall * 100),
    ready: signalBlockers.length === 0 && byDestination.every((d) => d.ready),
    status: input.status,
    signals,
    blockers,
    recommendations,
    findings: preflight.findings,
    byDestination,
    notEvaluated: preflight.notEvaluated,
  };
}

const DEFAULT_DESTINATIONS: DistributionTarget[] = [
  "kdp", "apple-books", "kobo", "google-play-books",
];

/** A destination is ready when nothing blocking fired against it. Advisories
 *  never gate. Findings awaiting human confirmation are counted separately so
 *  "ready" is never claimed on an unchecked assumption. */
function verdictFor(
  destination: DistributionTarget,
  all: ReadinessFinding[],
): DestinationVerdict {
  const findings = all.filter((f) => f.destination === destination);
  const blockerCount = findings.filter(
    (f) => f.severity === "blocker" && !f.requiresHumanConfirmation,
  ).length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const unconfirmedCount = findings.filter((f) => f.requiresHumanConfirmation).length;
  return {
    destination,
    ready: blockerCount === 0 && unconfirmedCount === 0,
    findings,
    blockerCount,
    warningCount,
    unconfirmedCount,
  };
}
