/* Single source of truth for owner identity.
   The Publishing OS access model is binary: OWNER vs USER.
   Owner is matched by email (case-insensitive). */
export const OWNER_EMAIL = "acndintllc@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL;
}
