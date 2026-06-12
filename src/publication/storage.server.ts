/* PTL-024 Phase 10A — Storage-backed asset uploads (server-only).
   Wraps the publication-assets Supabase Storage bucket. Returns
   signed-upload URLs the browser can PUT to directly; public-read
   URLs are derived from the bucket's RLS read policy. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "publication-assets";

export interface SignedUpload {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

function safe(s: string) {
  return s.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
}

function extOf(filename: string): string {
  const m = /\.[a-z0-9]+$/i.exec(filename);
  return m ? m[0].toLowerCase() : "";
}

export async function createSignedUpload(input: {
  slug: string;
  kind: string;
  filename: string;
}): Promise<SignedUpload> {
  const slug = safe(input.slug);
  const kind = safe(input.kind);
  const ext = extOf(input.filename);
  const id = crypto.randomUUID();
  const path = `${slug}/${kind}/${id}${ext}`;

  const { data, error } = await supabaseAdmin
    .storage.from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Failed to sign upload URL");

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return {
    bucket: BUCKET,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: pub.publicUrl,
  };
}

export async function removeStorageObject(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}
