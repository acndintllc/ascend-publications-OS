import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/roles.functions";
import { AppShell } from "@/components/ascend/app-shell";

/** Routes inside /ascend/* that are strictly OWNER-only. USERs trying to
    reach these are redirected to their dashboard. USERs are allowed to use
    /ascend/reader/$slug and /ascend/validate/$slug for their OWN manuscripts —
    the server functions backing those routes enforce per-row ownership. */
const OWNER_ONLY_PREFIXES = [
  "/ascend/publications",
  "/ascend/library",
  "/ascend/live",
  "/ascend/proof",
];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    // Authoritative owner determination happens server-side. The client
    // never knows the owner email; we just ask the server "am I owner?".
    // (All sensitive server fns independently re-verify via requireOwner.)
    let isOwner = false;
    try {
      const role = await getMyRole();
      isOwner = !!role.isOwner;
    } catch {
      isOwner = false;
    }
    const path = location.pathname;
    if (!isOwner && OWNER_ONLY_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p))) {
      throw redirect({ to: "/dashboard" });
    }
    return { user: data.user, isOwner };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
