/* Role-related server functions. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Called on auth page after login: grants CEO/Admin if email is in the
    ASCEND_BOOTSTRAP_ADMIN_EMAILS allowlist and the user has no roles yet. */
export const bootstrapMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { bootstrapIfEligible, highestRole, bootstrapEmails } =
      await import("@/lib/roles.server");
    const email = (context.claims?.email as string | undefined) ?? null;
    const result = await bootstrapIfEligible(context.userId, email);
    return {
      ...result,
      role: highestRole(result.roles),
      email,
      bootstrapConfigured: bootstrapEmails().length > 0,
    };
  });

/** Return current user's roles + resolved highest role. */
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { fetchUserRoles, highestRole } = await import("@/lib/roles.server");
    const roles = await fetchUserRoles(context.userId);
    return {
      userId: context.userId,
      email: (context.claims?.email as string | undefined) ?? null,
      roles,
      role: highestRole(roles),
    };
  });
