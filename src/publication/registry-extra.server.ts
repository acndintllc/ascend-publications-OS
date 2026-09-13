/* PTL-025 Phase 14 — Server-only persistence for ISBNs.
   Vendor and submission persistence removed: the OS ends at the export
   file and performs no third-party handoff. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { IsbnRow } from "./isbn";

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
