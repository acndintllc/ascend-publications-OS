import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isOwnerEmail } from "@/lib/owner";
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
    const path = location.pathname;
    const isOwner = isOwnerEmail(data.user.email);
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
