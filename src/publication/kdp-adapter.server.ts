/* PTL-028 Phase 17B — KDP submission adapter.
   Wraps the existing `buildSubmissionPackage()` with a KDP-specific
   submission state machine and a dry-run / live-submit gating layer.
   No live publication is performed unless explicitly enabled AND
   credentials + vendor + ISBN are all present.

   State machine:
     pending → validated → ready_for_submission → submitted → accepted|rejected → published
*/
import type { AdapterIssue } from "./metadata";
import { buildSubmissionPackage, type SubmissionPackage } from "./submission-package.server";
import { listVendors } from "./registry-extra.server";
import { reportVendorSecrets } from "./vendor-secrets.server";

export const KDP_STATES = [
  "pending",
  "validated",
  "ready_for_submission",
  "submitted",
  "accepted",
  "rejected",
  "published",
] as const;
export type KdpState = (typeof KDP_STATES)[number];

const ALLOWED: Record<KdpState, KdpState[]> = {
  pending: ["validated"],
  validated: ["ready_for_submission", "rejected"],
  ready_for_submission: ["submitted", "rejected"],
  submitted: ["accepted", "rejected"],
  accepted: ["published", "rejected"],
  rejected: ["pending"],
  published: [],
};

export function canTransitionKdp(from: KdpState, to: KdpState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export interface KdpAdapterResult {
  slug: string;
  state: KdpState;
  mode: "dry-run" | "live";
  package: SubmissionPackage;
  vendor: { id: string; label: string; account_id: string | null; enabled: boolean } | null;
  credentialConfigured: boolean;
  issues: AdapterIssue[];
  /** Normalized response. Live mode is currently a placeholder. */
  response: {
    status: "skipped" | "ok" | "rejected" | "error";
    message: string;
    payloadSummary: {
      title: string | null;
      author: string | null;
      isbn: string | null;
      hasManuscript: boolean;
      hasCover: boolean;
    };
  };
}

export interface RunKdpInput {
  slug: string;
  /** If false, never attempt live submission regardless of readiness. */
  live?: boolean;
}

export async function runKdpAdapter(input: RunKdpInput): Promise<KdpAdapterResult> {
  const live = input.live === true;
  const pkg = await buildSubmissionPackage(input.slug, "kdp");
  const vendors = await listVendors();
  const kdp = vendors.find((v) => v.platform === "kdp" && v.enabled) ?? null;
  const secrets = reportVendorSecrets(vendors);
  const credentialConfigured = kdp
    ? !!secrets.find((s) => s.vendor_id === kdp.id && s.configured)
    : false;

  const issues: AdapterIssue[] = [...pkg.issues];
  if (!kdp) issues.push({ level: "error", field: "vendor", message: "No enabled KDP vendor configured" });
  if (kdp && !credentialConfigured) issues.push({ level: "error", field: "credential", message: "KDP vendor credential secret missing" });

  const hasErrors = issues.some((i) => i.level === "error");

  // Walk the state machine for this single invocation.
  let state: KdpState = "pending";
  // pending → validated always succeeds (validation has run; issues are part of result)
  state = "validated";
  if (!hasErrors && pkg.ready) state = "ready_for_submission";

  const m = pkg.manifest;
  const meta = (m.metadata as Record<string, unknown> | null) ?? {};
  const payloadSummary = {
    title: (meta.title as string) ?? null,
    author: (meta.author as string) ?? null,
    isbn: m.isbn?.isbn ?? null,
    hasManuscript: m.artifacts.some((a) => a.kind === "kindle" || a.kind === "epub"),
    hasCover: !!m.cover,
  };

  // Live submission gate.
  if (!live) {
    return {
      slug: input.slug, state, mode: "dry-run",
      package: pkg, vendor: kdp ? {
        id: kdp.id, label: kdp.label, account_id: kdp.account_id, enabled: kdp.enabled,
      } : null,
      credentialConfigured, issues,
      response: {
        status: state === "ready_for_submission" ? "ok" : "skipped",
        message: state === "ready_for_submission"
          ? "Dry-run: package validated and would be submitted."
          : "Dry-run: package is not ready for submission.",
        payloadSummary,
      },
    };
  }

  // Live mode — explicit guardrails before any external call.
  if (state !== "ready_for_submission") {
    return {
      slug: input.slug, state, mode: "live",
      package: pkg,
      vendor: kdp ? { id: kdp.id, label: kdp.label, account_id: kdp.account_id, enabled: kdp.enabled } : null,
      credentialConfigured, issues,
      response: {
        status: "error",
        message: "Live submission refused: package not ready_for_submission.",
        payloadSummary,
      },
    };
  }

  // Placeholder live-submit. Wiring to a real KDP automation runner is a
  // separate deployment step (Phase 18). We deliberately stop here so the
  // adapter cannot silently publish.
  return {
    slug: input.slug, state, mode: "live",
    package: pkg,
    vendor: kdp ? { id: kdp.id, label: kdp.label, account_id: kdp.account_id, enabled: kdp.enabled } : null,
    credentialConfigured, issues,
    response: {
      status: "skipped",
      message: "Live KDP submission endpoint not wired in this build; package is ready.",
      payloadSummary,
    },
  };
}
