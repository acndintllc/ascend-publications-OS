/* PTL-029 Phase 18A — Live KDP submission with evidence capture.
   Gated by evaluateGovernanceGate(). Persists evidence into
   existing publication_submissions rows (response_payload, submitted_at)
   and the event log — no new lifecycle states. */
import { runKdpAdapter, type KdpAdapterResult } from "./kdp-adapter.server";
import { evaluateGovernanceGate, type GovernanceGate } from "./governance.server";
import {
  createSubmission, updateSubmission, listSubmissions,
} from "./registry-extra.server";
import { recordEvent } from "./persistence.server";

export interface LiveKdpInput {
  slug: string;
  liveEnabled: boolean;
  approver?: string;
  /** Re-use an existing pending submission row instead of creating one. */
  submissionId?: string;
}

export interface LiveKdpResult {
  slug: string;
  governance: GovernanceGate;
  adapter: KdpAdapterResult;
  submissionId: string | null;
  receipt: {
    accepted: boolean;
    receipt_id: string;
    submitted_at: string;
    vendor: string | null;
    isbn: string | null;
    package_ready: boolean;
    response_status: string;
    response_message: string;
  } | null;
  mode: "dry-run" | "live" | "refused";
  message: string;
}

function makeReceiptId(slug: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `kdp_${slug}_${Date.now().toString(36)}_${rand}`;
}

export async function runLiveKdpSubmission(input: LiveKdpInput): Promise<LiveKdpResult> {
  const governance = await evaluateGovernanceGate({
    slug: input.slug, platform: "kdp",
    liveRequested: input.liveEnabled, approver: input.approver,
  });

  // Always run the adapter in dry-run first to obtain the package.
  const dryAdapter = await runKdpAdapter({ slug: input.slug, live: false });

  if (!input.liveEnabled) {
    return {
      slug: input.slug, governance, adapter: dryAdapter, submissionId: null, receipt: null,
      mode: "dry-run", message: "Dry-run only; live flag not set.",
    };
  }
  if (!governance.approved) {
    return {
      slug: input.slug, governance, adapter: dryAdapter, submissionId: null, receipt: null,
      mode: "refused",
      message: `Refused: governance gate failed (${governance.blockers.length} blockers).`,
    };
  }

  // Now perform the gated live invocation (state-machine guard inside adapter).
  const liveAdapter = await runKdpAdapter({ slug: input.slug, live: true });
  const isbn = liveAdapter.package.manifest.isbn?.isbn ?? null;

  // Locate or create a submission row.
  let submissionId = input.submissionId ?? null;
  if (!submissionId) {
    const existing = await listSubmissions(input.slug);
    const pending = existing.find((s) => s.platform === "kdp" && s.status === "pending");
    if (pending) submissionId = pending.id;
    else {
      const row = await createSubmission({
        slug: input.slug, platform: "kdp",
        vendor_id: liveAdapter.vendor?.id ?? null,
        isbn, notes: "live-kdp",
      });
      submissionId = row.id;
    }
  }

  // Capture evidence regardless of accept/reject classification.
  const accepted = liveAdapter.response.status === "ok" || liveAdapter.response.status === "skipped";
  const receipt = {
    accepted,
    receipt_id: makeReceiptId(input.slug),
    submitted_at: new Date().toISOString(),
    vendor: liveAdapter.vendor?.label ?? null,
    isbn,
    package_ready: liveAdapter.package.ready,
    response_status: liveAdapter.response.status,
    response_message: liveAdapter.response.message,
  };

  const nextStatus = accepted ? "submitted" : "rejected";
  if (submissionId) {
    await updateSubmission(submissionId, {
      status: nextStatus,
      isbn,
      response_payload: {
        receipt,
        adapter_state: liveAdapter.state,
        adapter_mode: liveAdapter.mode,
        payload_summary: liveAdapter.response.payloadSummary,
        issues: liveAdapter.issues.map((i) => ({ level: i.level, field: i.field, message: i.message })),
        governance_checks: governance.checks,
      } as never,
    });
  }

  await recordEvent({
    slug: input.slug,
    event_type: "export.requested",
    payload: {
      action: "kdp.live_submission",
      submission_id: submissionId,
      receipt_id: receipt.receipt_id,
      accepted,
      adapter_state: liveAdapter.state,
      vendor: liveAdapter.vendor?.label ?? null,
      isbn,
      blockers: governance.blockers.length,
      approver: input.approver ?? null,
    },
    actor: input.approver ?? null,
  });

  return {
    slug: input.slug,
    governance,
    adapter: liveAdapter,
    submissionId,
    receipt,
    mode: "live",
    message: accepted
      ? `Live submission recorded (${receipt.receipt_id}).`
      : `Live submission rejected: ${liveAdapter.response.message}`,
  };
}
