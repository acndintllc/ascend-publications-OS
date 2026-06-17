/* Role helpers — server-only. Never import in client code. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownerEmailList, isOwnerEmail } from "@/lib/owner.server";

export type AppRole = "ceo" | "admin" | "editor" | "reader";

const RANK: Record<AppRole, number> = { ceo: 1, admin: 2, editor: 3, reader: 4 };

export function highestRole(roles: AppRole[]): AppRole | null {
  if (!roles.length) return null;
  return roles.slice().sort((a, b) => RANK[a] - RANK[b])[0];
}

/** Fetch all roles for a user via service role (bypasses RLS). */
export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.role as AppRole);
}

/** Throws if user does not hold any of the allowed roles. */
export async function assertRole(
  userId: string,
  allowed: AppRole[],
): Promise<AppRole[]> {
  const roles = await fetchUserRoles(userId);
  if (!roles.some((r) => allowed.includes(r))) {
    throw new Error(
      `Forbidden: requires one of [${allowed.join(", ")}]; you have [${roles.join(", ") || "none"}]`,
    );
  }
  return roles;
}

/** Resolve bootstrap admin emails from env (comma-separated, case-insensitive). */
export function bootstrapEmails(): string[] {
  // Owner identity is hard-coded; env allowlist is no longer used.
  return ownerEmailList();
}

/** Owner bootstrap: if email matches OWNER_EMAIL and no roles exist,
    grant 'ceo' (legacy marker for owner). Idempotent. */
export async function bootstrapIfEligible(
  userId: string,
  email: string | null | undefined,
): Promise<{ bootstrapped: boolean; roles: AppRole[] }> {
  // isOwnerEmail imported above (server-only).
  const existing = await fetchUserRoles(userId);
  if (!isOwnerEmail(email) || existing.includes("ceo")) {
    return { bootstrapped: false, roles: existing };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert([{ user_id: userId, role: "ceo" }], { onConflict: "user_id,role" });
  if (error) throw error;
  return { bootstrapped: true, roles: Array.from(new Set([...existing, "ceo" as AppRole])) };
}
