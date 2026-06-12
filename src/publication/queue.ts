/* PTL-024 Phase 10C — Distribution queue vocabulary. Pure module. */
import type { DistributionTarget } from "./metadata";

export const QUEUE_STATES = [
  "queued","processing","blocked","ready","submitted","failed",
] as const;
export type QueueState = (typeof QUEUE_STATES)[number];

export const QUEUE_STATE_LABELS: Record<QueueState, string> = {
  queued: "Queued",
  processing: "Processing",
  blocked: "Blocked",
  ready: "Ready",
  submitted: "Submitted",
  failed: "Failed",
};

export interface QueueRow {
  id: string;
  slug: string;
  target: DistributionTarget | string;
  state: QueueState;
  blockers: string[];
  payload: Record<string, unknown>;
  artifact_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}
