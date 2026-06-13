/* PTL-029 Phase 18F — Live publication governance gate.
   Live submission may only proceed when every check below passes.
   Aggregates existing audit + KDP package + vendor credentials + ISBN. */
import { auditPublication } from "./audit.server";
import { buildSubmissionPackage } from "./submission-package.server";
import { listVendors } from "./registry-extra.server";
import { reportVendorSecrets } from "./vendor-secrets.server";
import { recordEvent } from "./persistence.server";

export interface GovernanceGate {
  slug: string;
  platform: string;
  approved: boolean;
  checks: {
    readinessReady: boolean;
    statusReady: boolean;
    vendorEnabled: boolean;
    credentialPresent: boolean;
    isbnAssigned: boolean;
    packageReady: boolean;
    auditClean: boolean;
  };
  blockers: string[];
}

export interface GovernanceInput {
  slug: string;
  platform: string;
  liveRequested?: boolean;
  approver?: string;
}

export async function evaluateGovernanceGate(input: GovernanceInput): Promise<GovernanceGate> {
  const [audit, pkg, vendors] = await Promise.all([
    auditPublication(input.slug),
    buildSubmissionPackage(input.slug, input.platform as never),
    listVendors(),
  ]);
  const vendor = vendors.find((v) => v.platform === input.platform && v.enabled) ?? null;
  const secrets = reportVendorSecrets(vendors);
  const sec = vendor ? secrets.find((s) => s.vendor_id === vendor.id) ?? null : null;

  const checks = {
    readinessReady: audit.readiness?.ready === true,
    statusReady: audit.facts.hasRecord && audit.blockers.every((b) => !b.startsWith("Publication status")),
    vendorEnabled: !!vendor,
    credentialPresent: !!sec?.configured,
    isbnAssigned: !!pkg.manifest.isbn,
    packageReady: pkg.ready,
    auditClean: audit.blockers.length === 0,
  };
  const blockers: string[] = [];
  if (!checks.readinessReady) blockers.push("Readiness not at 100% / ready=true");
  if (!checks.statusReady) blockers.push("Publication status not ready/published");
  if (!checks.vendorEnabled) blockers.push(`No enabled vendor for ${input.platform}`);
  if (!checks.credentialPresent) blockers.push(`Vendor credential secret missing (${sec?.rotation_target ?? "n/a"})`);
  if (!checks.isbnAssigned) blockers.push("No assigned/registered ISBN");
  if (!checks.packageReady) blockers.push("Submission package not ready");
  if (!checks.auditClean) blockers.push(`Audit has ${audit.blockers.length} blocker(s)`);

  const approved = Object.values(checks).every(Boolean);

  await recordEvent({
    slug: input.slug,
    event_type: "export.requested",
    payload: {
      action: "governance.evaluated",
      platform: input.platform,
      approved,
      live_requested: !!input.liveRequested,
      blocker_count: blockers.length,
      approver: input.approver ?? null,
    },
    actor: input.approver ?? null,
  });

  return { slug: input.slug, platform: input.platform, approved, checks, blockers };
}
