import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapMyRole } from "@/lib/roles.functions";
import { isOwnerEmail } from "@/lib/owner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    // Fire-and-forget owner bootstrap (idempotent).
    bootstrapMyRole().catch((e) => console.warn("bootstrapMyRole failed", e));
    // /ascend/* is owner-only. Non-owners get pushed to their dashboard.
    const path = location.pathname;
    if (path.startsWith("/ascend") && !isOwnerEmail(data.user.email)) {
      throw redirect({ to: "/dashboard" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
