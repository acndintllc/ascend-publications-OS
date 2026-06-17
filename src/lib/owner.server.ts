/* Server-only owner identity. The OWNER_EMAIL must never appear in the
   client bundle — that would let any visitor identify the privileged
   account and target it with phishing/credential stuffing. Read from an
   env var when provided so the value isn't even in source for production. */
const FALLBACK_OWNER_EMAIL = "acndintllc@gmail.com";

function ownerEmail(): string {
  const fromEnv = (typeof process !== "undefined" ? process.env?.OWNER_EMAIL : undefined) ?? "";
  return (fromEnv || FALLBACK_OWNER_EMAIL).trim().toLowerCase();
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ownerEmail();
}

export function getAccessTypeForEmail(email: string | null | undefined): "owner" | "user" {
  return isOwnerEmail(email) ? "owner" : "user";
}

/** Owner email list — used by legacy bootstrap. Server-only. */
export function ownerEmailList(): string[] {
  return [ownerEmail()];
}
