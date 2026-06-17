/* OWNER / USER access middleware.
   - requireUser  : any authenticated user. Exposes { userId, email, isOwner }.
   - requireOwner : owner only (email match). Throws 403 otherwise.

   Legacy aliases (requireReader / requireEditor / requireAdmin / requireCeo)
   remain importable so we don't have to rewrite every call site in a single
   pass. Semantics:
     requireReader = requireUser   (any auth)
     requireEditor = requireUser   (any auth — user can edit their OWN data;
                                    handlers enforce per-row ownership)
     requireAdmin  = requireOwner  (owner-only admin surfaces)
     requireCeo    = requireOwner  (owner-only)
*/
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmail } from "@/lib/owner.server";

export type AccessType = "owner" | "user";

/** Any signed-in user. Adds { email, isOwner, accessType } to context. */
export const requireUser = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const email = (context.claims?.email as string | undefined) ?? null;
    const isOwner = isOwnerEmail(email);
    return next({
      context: {
        email,
        isOwner,
        accessType: (isOwner ? "owner" : "user") as AccessType,
      },
    });
  });

/** Owner-only. Email must match OWNER_EMAIL. */
export const requireOwner = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const email = (context.claims?.email as string | undefined) ?? null;
    if (!isOwnerEmail(email)) {
      throw new Error("Forbidden: owner access required");
    }
    return next({
      context: {
        email,
        isOwner: true as const,
        accessType: "owner" as AccessType,
      },
    });
  });

/* Legacy aliases — kept compiling-stable; semantics described above. */
export const requireReader = requireUser;
export const requireEditor = requireUser;
export const requireAdmin = requireOwner;
export const requireCeo = requireOwner;

export type AppRole = "ceo" | "admin" | "editor" | "reader";
