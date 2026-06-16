
-- Restrict SELECT on internal operational tables to service_role only
DROP POLICY IF EXISTS "distribution_queue auth readable" ON public.publication_distribution_queue;
DROP POLICY IF EXISTS "publication_events auth readable" ON public.publication_events;
DROP POLICY IF EXISTS "auth read isbns" ON public.publication_isbns;
DROP POLICY IF EXISTS "auth read submissions" ON public.publication_submissions;

CREATE POLICY "service_role only" ON public.publication_distribution_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role only" ON public.publication_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role only" ON public.publication_isbns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role only" ON public.publication_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE SELECT ON public.publication_distribution_queue FROM authenticated, anon;
REVOKE SELECT ON public.publication_events FROM authenticated, anon;
REVOKE SELECT ON public.publication_isbns FROM authenticated, anon;
REVOKE SELECT ON public.publication_submissions FROM authenticated, anon;

-- Add explicit service_role-only policy on publication_vendors (RLS enabled, no policy)
CREATE POLICY "service_role only" ON public.publication_vendors FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Storage: lock down publication-manuscripts to service_role only
DROP POLICY IF EXISTS "publication-manuscripts service role only" ON storage.objects;
CREATE POLICY "publication-manuscripts service role only"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'publication-manuscripts')
  WITH CHECK (bucket_id = 'publication-manuscripts');

-- Revoke SECURITY DEFINER function EXECUTE from anon/public; keep authenticated
-- (these functions are called via supabase.rpc from authenticated server-fn context)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
