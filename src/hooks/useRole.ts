import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/roles.functions";
import { isOwnerEmail } from "@/lib/owner";

export type AppRole = "ceo" | "admin" | "editor" | "reader";

/** Simplified access model hook: OWNER vs USER.
    Legacy role flags are kept for back-compat with existing UI checks. */
export function useRole() {
  const fetchRole = useServerFn(getMyRole);
  const q = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
    staleTime: 60_000,
  });
  const email = q.data?.email ?? null;
  const roles = (q.data?.roles ?? []) as AppRole[];
  const isOwner = isOwnerEmail(email) || roles.includes("ceo");
  const isUser = !!email && !isOwner;
  const has = (allowed: AppRole[]) => roles.some((r) => allowed.includes(r));
  return {
    ...q,
    email,
    roles,
    role: (q.data?.role ?? null) as AppRole | null,
    isOwner,
    isUser,
    has,
    // Legacy aliases — map all elevated checks to owner.
    isCeo: isOwner,
    isAdmin: isOwner,
    canEdit: isOwner,
    canRead: !!email,
    atLeast: (_min: AppRole) => isOwner,
  };
}
