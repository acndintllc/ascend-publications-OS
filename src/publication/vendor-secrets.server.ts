/* PTL-027 Phase 16C — Vendor credential presence + rotation surface.
   Server-only: reads process.env to verify the secret named by a vendor's
   credential_ref exists. Never returns the secret value. */
import { vendorCredentialName, type VendorRow } from "./vendors";

export interface VendorSecretReport {
  vendor_id: string;
  platform: string;
  label: string;
  credential_ref: string | null;
  expected_credential_ref: string;
  configured: boolean;
  enabled: boolean;
  /** True when credential_ref matches the conventional name. */
  conventional: boolean;
  /** Suggested env var to populate. */
  rotation_target: string;
}

export function reportVendorSecret(v: VendorRow): VendorSecretReport {
  const expected = vendorCredentialName(v.platform, v.account_id);
  const ref = v.credential_ref ?? expected;
  const present = !!process.env[ref];
  return {
    vendor_id: v.id,
    platform: v.platform,
    label: v.label,
    credential_ref: v.credential_ref,
    expected_credential_ref: expected,
    configured: present,
    enabled: v.enabled,
    conventional: ref === expected,
    rotation_target: ref,
  };
}

export function reportVendorSecrets(vendors: VendorRow[]): VendorSecretReport[] {
  return vendors.map(reportVendorSecret);
}
