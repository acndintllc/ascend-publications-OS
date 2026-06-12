/* PTL-022 Phase 9F — Workflow event vocabulary. Pure module. */

export const EVENT_TYPES = [
  "publication.created",
  "metadata.updated",
  "status.changed",
  "asset.uploaded",
  "asset.replaced",
  "asset.deactivated",
  "profile.changed",
  "vera.updated",
  "export.requested",
  "readiness.recomputed",
] as const;

export type WorkflowEventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABELS: Record<WorkflowEventType, string> = {
  "publication.created": "Publication created",
  "metadata.updated": "Metadata updated",
  "status.changed": "Status changed",
  "asset.uploaded": "Asset uploaded",
  "asset.replaced": "Asset replaced",
  "asset.deactivated": "Asset deactivated",
  "profile.changed": "Profile changed",
  "vera.updated": "VERA configuration updated",
  "export.requested": "Export requested",
  "readiness.recomputed": "Readiness recomputed",
};

export type EventPayloadValue =
  | string | number | boolean | null | undefined
  | EventPayloadValue[]
  | { [key: string]: EventPayloadValue };

export type EventPayload = { [key: string]: EventPayloadValue };

export interface WorkflowEvent {
  id: string;
  slug: string;
  event_type: WorkflowEventType | string;
  payload: EventPayload;
  actor: string | null;
  created_at: string;
}


