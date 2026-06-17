/* Role-gating middleware for server functions.
   Simplified access model: OWNER vs USER.
   - requireUser: any authenticated user.
   - requireOwner: authenticated AND (email matches OWNER_EMAIL OR legacy 'ceo' role).
   Legacy aliases (requireReader/Editor/Admin/Ceo) are preserved to avoid a
   sweeping rewrite of every existing server function. */
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmail } from "@/lib/owner";

export type AppRole = "ceo" | "admin" | "editor" | "reader";

/** Any signed-in user. */
export const requireUser = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next }) => next({ context: {} }));

/** Owner only: email matches OWNER_EMAIL, or (legacy) has 'ceo' role. */
export const requireOwner = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const email = (context.claims?.email as string | undefined) ?? null;
    if (isOwnerEmail(email)) return next({ context: { isOwner: true } });
    // Fallback: legacy 'ceo' role still grants owner access during transition.
    const { fetchUserRoles } = await import("@/lib/roles.server");
    const roles = await fetchUserRoles(context.userId);
    if (roles.includes("ceo")) return next({ context: { isOwner: true } });
    throw new Error("Forbidden: owner access required");
  });

/* Legacy aliases — kept so existing server functions continue to compile.
   Reader-tier endpoints are open to any authenticated user; everything
   else now requires owner. */
export const requireReader = requireUser;
export const requireEditor = requireOwner;
export const requireAdmin = requireOwner;
export const requireCeo = requireOwner;
