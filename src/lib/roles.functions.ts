/* Identity / access-type server fns.
   OWNER/USER access model — no roles, no hierarchy. Email is the truth. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmail, getAccessTypeForEmail } from "@/lib/owner.server";

/** Return who the caller is and whether they are the OWNER. */
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims?.email as string | undefined) ?? null;
    return {
      userId: context.userId,
      email,
      isOwner: isOwnerEmail(email),
      accessType: getAccessTypeForEmail(email),
    };
  });

/** Legacy bootstrap shim — kept callable so old client code doesn't 404.
    No-op in the OWNER/USER model; identity is email-based. */
export const bootstrapMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims?.email as string | undefined) ?? null;
    return {
      bootstrapped: false,
      email,
      isOwner: isOwnerEmail(email),
      accessType: getAccessTypeForEmail(email),
    };
  });
