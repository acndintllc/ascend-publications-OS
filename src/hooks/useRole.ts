import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/roles.functions";
import { isOwnerEmail, type AccessType } from "@/lib/owner";

/** Binary access model: OWNER vs USER.
    Returns the access type plus convenience flags. No legacy role flags. */
export function useRole() {
  const fetchRole = useServerFn(getMyRole);
  const q = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
    staleTime: 60_000,
  });
  const email = q.data?.email ?? null;
  const isOwner = isOwnerEmail(email);
  const isUser = !!email && !isOwner;
  const accessType: AccessType | null = email ? (isOwner ? "owner" : "user") : null;
  return {
    ...q,
    email,
    isOwner,
    isUser,
    accessType,
  };
}
