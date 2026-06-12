/* PTL-025 Phase 14C — Submission vocabulary. Pure module. */
import type { DistributionTarget } from "./metadata";

export const SUBMISSION_STATES = [
  "pending", "submitted", "accepted", "rejected", "published", "withdrawn",
] as const;
export type SubmissionState = (typeof SUBMISSION_STATES)[number];

export const SUBMISSION_STATE_LABELS: Record<SubmissionState, string> = {
  pending: "Pending",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  published: "Published",
  withdrawn: "Withdrawn",
};

export interface SubmissionRow {
  id: string;
  slug: string;
  platform: DistributionTarget | string;
  vendor_id: string | null;
  queue_id: string | null;
  isbn: string | null;
  status: SubmissionState | string;
  submitted_at: string | null;
  response_payload: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
