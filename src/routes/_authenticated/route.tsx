import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapMyRole } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    // Fire-and-forget bootstrap so first login on any protected route
    // promotes allowlisted users without blocking navigation.
    bootstrapMyRole().catch((e) => console.warn("bootstrapMyRole failed", e));
    return { user: data.user };
  },
  component: () => <Outlet />,
});
