/* Client-safe access-model helpers. The privileged owner email is NOT
   exported from this module — it lives in `owner.server.ts` and is never
   bundled into the browser. The client learns whether the current user is
   the owner exclusively via the `getMyRole` server function. */

export type AccessType = "owner" | "user";

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
