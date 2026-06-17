/* PTL-021 Phase 9A + PTL-022 Phase 9E/9F — server-only persistence helpers.
   Uses supabaseAdmin (service role, bypasses RLS).
   OWNER/USER ownership model: list/get accept an optional ownerId filter;
   USERs always pass their own ownerId so they only see their own data. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PublicationStatus } from "./status";
import { canTransition } from "./status";
import type { AssetRecord } from "./assets";
import type { WorkflowEvent, WorkflowEventType } from "./events";


export interface DbRecord {
  slug: string;
  title: string;
  subtitle: string | null;
  series: string | null;
  volume: number | null;
  status: PublicationStatus;
  version: string;
  profile: string;
  author: string;
  audience: string | null;
  language: string;
  publication_date: string | null;
  last_updated: string;
  owner_id: string | null;
}

export interface DbMetadata {
  slug: string;
  description: string;
  keywords: string[];
  categories: string[];
  contributors: string[];
  reading_level: string | null;
  isbn: string | null;
  publisher: string;
  rights: string | null;
  owner_id: string | null;
}

export interface DbVeraConfig {
  slug: string;
  enabled_kinds: string[];
  default_voice: string | null;
  owner_id: string | null;
}

/** Scope a list query by owner unless caller is OWNER (then return all). */
function applyOwnerScope<T>(query: T, ownerId: string | null): T {
  if (ownerId === null) return query; // OWNER (or unscoped trusted call)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query as any).eq("owner_id", ownerId);
}

export async function listRecords(ownerId: string | null = null): Promise<DbRecord[]> {
  let q = supabaseAdmin.from("publication_records").select("*");
  q = applyOwnerScope(q, ownerId);
  const { data, error } = await q.order("title");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbRecord[];
}

export async function getRecord(slug: string): Promise<DbRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("publication_records").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as DbRecord) ?? null;
}

/** Throw if caller doesn't own this slug (and isn't OWNER). */
export async function assertOwns(slug: string, userId: string, isOwner: boolean): Promise<DbRecord> {
  const rec = await getRecord(slug);
  if (!rec) throw new Error(`Unknown publication: ${slug}`);
  if (isOwner) return rec;
  if (rec.owner_id !== userId) {
    throw new Error("Forbidden: you do not own this publication");
  }
  return rec;
}

export async function listMetadata(ownerId: string | null = null): Promise<DbMetadata[]> {
  let q = supabaseAdmin.from("publication_metadata").select("*");
  q = applyOwnerScope(q, ownerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbMetadata[];
}

export async function getMetadata(slug: string): Promise<DbMetadata | null> {
  const { data, error } = await supabaseAdmin
    .from("publication_metadata").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as DbMetadata) ?? null;
}

export async function getVeraConfig(slug: string): Promise<DbVeraConfig | null> {
  const { data, error } = await supabaseAdmin
    .from("publication_vera_config")
    .select("slug, enabled_kinds, default_voice, owner_id")
    .eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as DbVeraConfig) ?? null;
}

export async function listVeraConfigs(ownerId: string | null = null): Promise<DbVeraConfig[]> {
  let q = supabaseAdmin.from("publication_vera_config")
    .select("slug, enabled_kinds, default_voice, owner_id");
  q = applyOwnerScope(q, ownerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbVeraConfig[];
}

export async function upsertRecord(
  rec: Partial<DbRecord> & { slug: string },
  ownerId?: string | null,
) {
  const patch: Record<string, unknown> = { ...rec, last_updated: new Date().toISOString() };
  if (ownerId !== undefined) patch.owner_id = ownerId;
  const { error } = await supabaseAdmin.from("publication_records").upsert(patch as never);
  if (error) throw new Error(error.message);
}

export async function upsertMetadata(
  meta: Partial<DbMetadata> & { slug: string },
  ownerId?: string | null,
) {
  const patch: Record<string, unknown> = { ...meta, updated_at: new Date().toISOString() };
  if (ownerId !== undefined) patch.owner_id = ownerId;
  const { error } = await supabaseAdmin.from("publication_metadata").upsert(patch as never);
  if (error) throw new Error(error.message);
}

export async function upsertVeraConfig(
  cfg: Partial<DbVeraConfig> & { slug: string },
  ownerId?: string | null,
) {
  const patch: Record<string, unknown> = { ...cfg, updated_at: new Date().toISOString() };
  if (ownerId !== undefined) patch.owner_id = ownerId;
  const { error } = await supabaseAdmin.from("publication_vera_config").upsert(patch as never);
  if (error) throw new Error(error.message);
}

export async function transitionStatus(slug: string, next: PublicationStatus, notes?: string) {
  const cur = await getRecord(slug);
  if (!cur) throw new Error(`Unknown publication: ${slug}`);
  if (!canTransition(cur.status, next)) {
    throw new Error(`Illegal transition ${cur.status} → ${next}`);
  }
  const { error: e1 } = await supabaseAdmin
    .from("publication_records")
    .update({ status: next, last_updated: new Date().toISOString() } as never)
    .eq("slug", slug);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabaseAdmin
    .from("publication_versions")
    .insert({ slug, version: cur.version, status: next, notes: notes ?? null, owner_id: cur.owner_id } as never);
  if (e2) throw new Error(e2.message);
}

/* ─── 9E: assets ─────────────────────────────────────────────────── */

export async function listAssets(slug: string): Promise<AssetRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("publication_assets")
    .select("*")
    .eq("slug", slug)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AssetRecord[];
}

export async function listAllAssets(ownerId: string | null = null): Promise<AssetRecord[]> {
  let q = supabaseAdmin.from("publication_assets").select("*");
  q = applyOwnerScope(q, ownerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AssetRecord[];
}

export async function uploadAsset(input: {
  slug: string;
  kind: string;
  url: string;
  label?: string | null;
  notes?: string | null;
  ownerId?: string | null;
}): Promise<{ asset: AssetRecord; replaced: AssetRecord | null }> {
  const { data: existing, error: e1 } = await supabaseAdmin
    .from("publication_assets")
    .select("*")
    .eq("slug", input.slug)
    .eq("kind", input.kind)
    .eq("is_active", true)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  const prior = (existing as unknown as AssetRecord | null) ?? null;
  const version = prior ? prior.version + 1 : 1;
  if (prior) {
    const { error: e2 } = await supabaseAdmin
      .from("publication_assets")
      .update({ is_active: false } as never)
      .eq("id", prior.id);
    if (e2) throw new Error(e2.message);
  }
  const insertRow: Record<string, unknown> = {
    slug: input.slug,
    kind: input.kind,
    url: input.url,
    label: input.label ?? null,
    notes: input.notes ?? null,
    version,
    is_active: true,
    replaces_id: prior?.id ?? null,
    uploaded_at: new Date().toISOString(),
  };
  if (input.ownerId !== undefined) insertRow.owner_id = input.ownerId;
  const { data: inserted, error: e3 } = await supabaseAdmin
    .from("publication_assets")
    .insert(insertRow as never)
    .select("*")
    .single();
  if (e3) throw new Error(e3.message);
  return { asset: inserted as unknown as AssetRecord, replaced: prior };
}

export async function deactivateAsset(id: string): Promise<AssetRecord> {
  const { data, error } = await supabaseAdmin
    .from("publication_assets")
    .update({ is_active: false } as never)
    .eq("id", id)
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as AssetRecord;
}

/* ─── 9F: workflow events ────────────────────────────────────────── */

export async function recordEvent(input: {
  slug: string;
  event_type: WorkflowEventType | string;
  payload?: import("./events").EventPayload;
  actor?: string | null;
  ownerId?: string | null;
}): Promise<void> {
  const row: Record<string, unknown> = {
    slug: input.slug,
    event_type: input.event_type,
    payload: (input.payload ?? {}) as never,
    actor: input.actor ?? null,
  };
  if (input.ownerId !== undefined) row.owner_id = input.ownerId;
  const { error } = await supabaseAdmin.from("publication_events").insert(row as never);
  if (error) throw new Error(error.message);
}

export async function listEvents(slug: string, limit = 50): Promise<WorkflowEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("publication_events")
    .select("*")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as WorkflowEvent[];
}
