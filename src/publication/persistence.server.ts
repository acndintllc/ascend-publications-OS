/* PTL-021 Phase 9A + PTL-022 Phase 9E/9F — server-only persistence helpers.
   Uses supabaseAdmin (service role, bypasses RLS). Phase 9D adds role gating. */
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
}

export interface DbVeraConfig {
  slug: string;
  enabled_kinds: string[];
  default_voice: string | null;
}

export async function listRecords(): Promise<DbRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("publication_records")
    .select("*")
    .order("title");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbRecord[];
}

export async function getRecord(slug: string): Promise<DbRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("publication_records").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as DbRecord) ?? null;
}

export async function listMetadata(): Promise<DbMetadata[]> {
  const { data, error } = await supabaseAdmin.from("publication_metadata").select("*");
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
    .select("slug, enabled_kinds, default_voice")
    .eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as DbVeraConfig) ?? null;
}

export async function listVeraConfigs(): Promise<DbVeraConfig[]> {
  const { data, error } = await supabaseAdmin
    .from("publication_vera_config")
    .select("slug, enabled_kinds, default_voice");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DbVeraConfig[];
}

export async function upsertRecord(rec: Partial<DbRecord> & { slug: string }) {
  const patch = { ...rec, last_updated: new Date().toISOString() };
  const { error } = await supabaseAdmin.from("publication_records").upsert(patch as never);
  if (error) throw new Error(error.message);
}

export async function upsertMetadata(meta: Partial<DbMetadata> & { slug: string }) {
  const patch = { ...meta, updated_at: new Date().toISOString() };
  const { error } = await supabaseAdmin.from("publication_metadata").upsert(patch as never);
  if (error) throw new Error(error.message);
}

export async function upsertVeraConfig(cfg: Partial<DbVeraConfig> & { slug: string }) {
  const patch = { ...cfg, updated_at: new Date().toISOString() };
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
    .insert({ slug, version: cur.version, status: next, notes: notes ?? null } as never);
  if (e2) throw new Error(e2.message);
}
