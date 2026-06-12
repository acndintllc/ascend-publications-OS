/* PTL-024 Phase 10C — distribution queue persistence (server-only).
   Uses supabaseAdmin so RLS write-block on the table doesn't bite us
   pre-9D. Types are cast as the auto-gen types.ts hasn't been
   regenerated for this new table; runtime shape matches the migration. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { QueueRow, QueueState } from "./queue";

const TABLE = "publication_distribution_queue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin.from(TABLE as never) as unknown as any;

export async function listQueue(slug?: string): Promise<QueueRow[]> {
  const q = slug
    ? db().select("*").eq("slug", slug).order("created_at", { ascending: false })
    : db().select("*").order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as QueueRow[];
}

export async function enqueue(input: {
  slug: string;
  target: string;
  state?: QueueState;
  blockers?: string[];
  payload?: Record<string, unknown>;
  notes?: string | null;
}): Promise<QueueRow> {
  const row = {
    slug: input.slug,
    target: input.target,
    state: input.state ?? "queued",
    blockers: input.blockers ?? [],
    payload: input.payload ?? {},
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as QueueRow;
}

export async function updateQueue(
  id: string,
  patch: Partial<Pick<QueueRow, "state" | "blockers" | "payload" | "artifact_url" | "notes" | "submitted_at">>,
): Promise<QueueRow> {
  const row = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await db().update(row).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as QueueRow;
}

export async function deleteQueueEntry(id: string): Promise<void> {
  const { error } = await db().delete().eq("id", id);
  if (error) throw new Error(error.message);
}
