/* PTL-025 Phase 14 — Server-only persistence for ISBNs, vendors, submissions. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { IsbnRow } from "./isbn";
import type { VendorRow } from "./vendors";
import type { SubmissionRow, SubmissionState } from "./submissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = (name: string) => supabaseAdmin.from(name as never) as unknown as any;

/* ─── ISBNs ─────────────────────────────────────────────────────── */

export async function listIsbns(slug?: string): Promise<IsbnRow[]> {
  const q = slug ? t("publication_isbns").select("*").eq("slug", slug) : t("publication_isbns").select("*");
  const { data, error } = await q.order("assigned_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IsbnRow[];
}

export async function assignIsbn(input: {
  slug: string; isbn: string; edition?: string; format: string;
  status?: string; notes?: string | null;
}): Promise<IsbnRow> {
  const row = {
    slug: input.slug,
    isbn: input.isbn.replace(/[-\s]/g, ""),
    edition: input.edition ?? "1",
    format: input.format,
    status: input.status ?? "assigned",
    notes: input.notes ?? null,
  };
  const { data, error } = await t("publication_isbns").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as IsbnRow;
}

export async function updateIsbn(id: string, patch: Partial<IsbnRow>): Promise<IsbnRow> {
  const { data, error } = await t("publication_isbns").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as IsbnRow;
}

export async function deleteIsbn(id: string): Promise<void> {
  const { error } = await t("publication_isbns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ─── Vendors ───────────────────────────────────────────────────── */

export async function listVendors(): Promise<VendorRow[]> {
  const { data, error } = await t("publication_vendors").select("*").order("platform");
  if (error) throw new Error(error.message);
  return (data ?? []) as VendorRow[];
}

export async function upsertVendor(input: Partial<VendorRow> & { platform: string; label: string }): Promise<VendorRow> {
  const row = { ...input, updated_at: new Date().toISOString() };
  const { data, error } = await t("publication_vendors")
    .upsert(row, { onConflict: "platform,account_id" })
    .select("*").single();
  if (error) throw new Error(error.message);
  return data as VendorRow;
}

export async function deleteVendor(id: string): Promise<void> {
  const { error } = await t("publication_vendors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ─── Submissions ───────────────────────────────────────────────── */

export async function listSubmissions(slug?: string): Promise<SubmissionRow[]> {
  const q = slug ? t("publication_submissions").select("*").eq("slug", slug) : t("publication_submissions").select("*");
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SubmissionRow[];
}

export async function createSubmission(input: {
  slug: string; platform: string; vendor_id?: string | null;
  queue_id?: string | null; isbn?: string | null; notes?: string | null;
}): Promise<SubmissionRow> {
  const row = {
    slug: input.slug,
    platform: input.platform,
    vendor_id: input.vendor_id ?? null,
    queue_id: input.queue_id ?? null,
    isbn: input.isbn ?? null,
    notes: input.notes ?? null,
    status: "pending" as SubmissionState,
  };
  const { data, error } = await t("publication_submissions").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as SubmissionRow;
}

export async function updateSubmission(
  id: string,
  patch: Partial<SubmissionRow> & { status?: SubmissionState | string },
): Promise<SubmissionRow> {
  const row: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.status === "submitted" && !patch.submitted_at) {
    row.submitted_at = new Date().toISOString();
  }
  const { data, error } = await t("publication_submissions").update(row).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as SubmissionRow;
}
