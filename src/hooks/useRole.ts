import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/roles.functions";

export type AppRole = "ceo" | "admin" | "editor" | "reader";

const RANK: Record<AppRole, number> = { ceo: 1, admin: 2, editor: 3, reader: 4 };

export function useRole() {
  const fetchRole = useServerFn(getMyRole);
  const q = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
    staleTime: 60_000,
  });
  const role = (q.data?.role ?? null) as AppRole | null;
  const roles = (q.data?.roles ?? []) as AppRole[];
  const has = (allowed: AppRole[]) =>
    roles.some((r) => allowed.includes(r));
  const atLeast = (min: AppRole) =>
    role !== null && RANK[role] <= RANK[min];
  return {
    ...q,
    role,
    roles,
    email: q.data?.email ?? null,
    has,
    atLeast,
    isCeo: has(["ceo"]),
    isAdmin: has(["ceo", "admin"]),
    canEdit: has(["ceo", "admin", "editor"]),
    canRead: has(["ceo", "admin", "editor", "reader"]),
  };
}
