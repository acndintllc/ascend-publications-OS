
-- Restrict internal tables to authenticated readers
DROP POLICY IF EXISTS "publication_artifacts readable" ON public.publication_artifacts;
CREATE POLICY "publication_artifacts auth readable"
  ON public.publication_artifacts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "distribution_queue readable" ON public.publication_distribution_queue;
CREATE POLICY "distribution_queue auth readable"
  ON public.publication_distribution_queue FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "publication_events readable" ON public.publication_events;
CREATE POLICY "publication_events auth readable"
  ON public.publication_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "publication_vera_config readable" ON public.publication_vera_config;
CREATE POLICY "publication_vera_config auth readable"
  ON public.publication_vera_config FOR SELECT TO authenticated USING (true);

-- Remove anon grants so anon truly cannot read
REVOKE SELECT ON public.publication_artifacts FROM anon;
REVOKE SELECT ON public.publication_distribution_queue FROM anon;
REVOKE SELECT ON public.publication_events FROM anon;
REVOKE SELECT ON public.publication_vera_config FROM anon;

-- Vendors: drop the broad authenticated SELECT; only service_role (which
-- bypasses RLS) should access this credential-bearing table.
DROP POLICY IF EXISTS "auth read vendors" ON public.publication_vendors;
REVOKE SELECT ON public.publication_vendors FROM authenticated;
REVOKE SELECT ON public.publication_vendors FROM anon;

-- Storage: restrict the publication-assets bucket SELECT to authenticated.
-- Signed URLs (issued via service_role from server code) continue to work.
DROP POLICY IF EXISTS "publication-assets public read" ON storage.objects;
CREATE POLICY "publication-assets auth read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'publication-assets');
