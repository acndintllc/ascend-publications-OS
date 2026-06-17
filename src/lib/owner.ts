/* Single source of truth for the OWNER/USER access model.
   Owner is matched by email (case-insensitive). Everyone else is USER. */
export const OWNER_EMAIL = "acndintllc@gmail.com";

export type AccessType = "owner" | "user";

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL;
}

/** Derive the access type from an email. */
export function getAccessTypeForEmail(email: string | null | undefined): AccessType {
  return isOwnerEmail(email) ? "owner" : "user";
}

/** Short, stable user-slug prefix so each USER has their own slug namespace.
    OWNER uploads keep their raw slug (no prefix). */
export function userSlugPrefix(userId: string): string {
  return `u${userId.replace(/-/g, "").slice(0, 8)}-`;
}

/** Apply per-user slug namespacing. OWNER: unchanged. USER: prefixed. */
export function scopeSlugForUser(
  rawSlug: string,
  userId: string,
  isOwner: boolean,
): string {
  if (isOwner) return rawSlug;
  const prefix = userSlugPrefix(userId);
  return rawSlug.startsWith(prefix) ? rawSlug : `${prefix}${rawSlug}`;
}
