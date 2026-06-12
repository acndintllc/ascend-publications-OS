/* PTL-025 Phase 14D — Vendor vocabulary. Pure module. */
import type { DistributionTarget } from "./metadata";

export interface VendorRow {
  id: string;
  platform: DistributionTarget | string;
  account_id: string | null;
  label: string;
  settings: Record<string, unknown>;
  credential_ref: string | null;
  submission_prefs: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const SUPPORTED_VENDOR_PLATFORMS: DistributionTarget[] = [
  "kdp",
  "apple-books",
  "kobo",
  "draft2digital",
  "google-play-books",
];

/** Stable secret name convention for vendor credentials. */
export function vendorCredentialName(platform: string, accountId: string | null): string {
  const acct = (accountId ?? "default").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const p = platform.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `ASCEND_VENDOR_${p}_${acct}`;
}
