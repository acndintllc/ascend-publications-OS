import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/roles.functions";
import type { AccessType } from "@/lib/owner";

/** Binary access model: OWNER vs USER. The owner determination is made
    server-side (see getMyRole); the client never knows the owner email. */
export function useRole() {
  const fetchRole = useServerFn(getMyRole);
  const q = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
    staleTime: 60_000,
  });
  const email = q.data?.email ?? null;
  const isOwner = q.data?.isOwner ?? false;
  const isUser = !!email && !isOwner;
  const accessType: AccessType | null = q.data?.accessType ?? null;
  return {
    ...q,
    email,
    isOwner,
    isUser,
    accessType,
  };
}
