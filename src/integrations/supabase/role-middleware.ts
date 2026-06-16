/* Role-gating middleware for server functions. Composes on top of
   requireSupabaseAuth: the bearer is validated first, then the user's
   roles are loaded and checked against the allowed set. */
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "ceo" | "admin" | "editor" | "reader";

function makeRoleMiddleware(allowed: AppRole[]) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const { fetchUserRoles } = await import("@/lib/roles.server");
      const roles = await fetchUserRoles(context.userId);
      if (!roles.some((r) => allowed.includes(r))) {
        throw new Error(
          `Forbidden: requires one of [${allowed.join(", ")}]; you have [${roles.join(", ") || "none"}]`,
        );
      }
      return next({ context: { roles } });
    });
}

/** Any signed-in user with at least the reader role. */
export const requireReader = makeRoleMiddleware(["ceo", "admin", "editor", "reader"]);
/** Editor + Admin + CEO — content mutations. */
export const requireEditor = makeRoleMiddleware(["ceo", "admin", "editor"]);
/** Admin + CEO — governance, vendors, ISBNs, KDP, queue, submissions. */
export const requireAdmin = makeRoleMiddleware(["ceo", "admin"]);
/** CEO-only. */
export const requireCeo = makeRoleMiddleware(["ceo"]);
