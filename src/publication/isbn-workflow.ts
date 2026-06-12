/* PTL-027 Phase 16D — ISBN lifecycle transitions. Pure module. */
import type { IsbnStatus } from "./isbn";

export const ISBN_TRANSITIONS: Record<IsbnStatus, IsbnStatus[]> = {
  reserved: ["assigned", "retired"],
  assigned: ["registered", "retired"],
  registered: ["retired"],
  retired: [],
};

export const ISBN_STATUS_LABELS: Record<IsbnStatus, string> = {
  reserved:   "Reserved",
  assigned:   "Assigned to title",
  registered: "Registered with agency",
  retired:    "Retired",
};

export function canTransitionIsbn(from: string, to: string): boolean {
  const allowed = ISBN_TRANSITIONS[from as IsbnStatus];
  return !!allowed && allowed.includes(to as IsbnStatus);
}

export function nextIsbnStates(from: string): IsbnStatus[] {
  return ISBN_TRANSITIONS[from as IsbnStatus] ?? [];
}
