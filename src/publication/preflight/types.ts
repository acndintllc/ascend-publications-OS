/* PTL-030 Phase 19A — Acceptance preflight vocabulary. Pure module.

   The OS ends at the export file, so the only question it answers is
   "will this destination accept these files?" Every answer is a typed
   ReadinessFinding rather than a bare string, so the verdict can carry
   the rule that produced it, the evidence that triggered it, how to fix
   it, and where the requirement came from. */
import type { DistributionTarget } from "../metadata";

export type FindingSeverity =
  /** The destination rejects, suppresses, or refuses to display. */
  | "blocker"
  /** Accepted, but degraded or at risk. */
  | "warning"
  /** Best-practice guidance; never gates a verdict. */
  | "advisory";

/** How well the threshold behind a rule is evidenced. A readiness verdict
 *  is only as trustworthy as its weakest cited rule, so this travels with
 *  every finding rather than living in a comment. */
export type VerificationLevel =
  /** Read from the destination's own published documentation. */
  | "official"
  /** Widely reported by practitioners; not stated in official docs. */
  | "community"
  /** Encoded but not yet confirmed — never gates a verdict. */
  | "unverified";

export interface RuleSource {
  url: string;
  /** ISO date the threshold was last confirmed against the source. */
  verifiedOn: string;
  level: VerificationLevel;
  /** Present when the source and the encoded value disagree or are unclear. */
  caveat?: string;
}

export type EvidenceValue = string | number | boolean | null | EvidenceValue[];
export type Evidence = { [key: string]: EvidenceValue };

/** One acceptance requirement, as data. Adding a rule never means editing
 *  the engine; the engine reads this catalogue. */
export interface AcceptanceRule {
  ruleId: string;
  label: string;
  destinations: DistributionTarget[];
  severity: FindingSeverity;
  /** What must be true, in operator-readable terms. */
  requirement: string;
  /** What the author does about it. */
  remediation: string;
  source: RuleSource;
  /** Thresholds the evaluator compares against. */
  params?: Evidence;
  /** True when the rule cannot be decided from the files alone and needs
   *  a human to confirm (e.g. "the title on the cover artwork matches"). */
  requiresHumanConfirmation?: boolean;
}

/** One result. Replaces the bare `string` blockers/recommendations. */
export interface ReadinessFinding {
  ruleId: string;
  severity: FindingSeverity;
  /** Absent when the finding applies to every destination. */
  destination?: DistributionTarget;
  /** The metadata field or asset the author must change. */
  field?: string;
  message: string;
  remediation?: string;
  /** What was observed, so the author can see why it fired. */
  evidence?: Evidence;
  source?: RuleSource;
  requiresHumanConfirmation?: boolean;
}

/** A destination's verdict. `ready` ignores advisories and unverified rules. */
export interface DestinationVerdict {
  destination: DistributionTarget;
  ready: boolean;
  findings: ReadinessFinding[];
  blockerCount: number;
  warningCount: number;
  /** Rules that fired but need a human to confirm before the verdict stands. */
  unconfirmedCount: number;
}
