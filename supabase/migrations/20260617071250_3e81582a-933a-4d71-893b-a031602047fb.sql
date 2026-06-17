
-- Restrict writes on the publication-assets storage bucket to service_role only.
-- Reads are unchanged (existing SELECT policy still applies).

DROP POLICY IF EXISTS "publication-assets service-role insert" ON storage.objects;
DROP POLICY IF EXISTS "publication-assets service-role update" ON storage.objects;
DROP POLICY IF EXISTS "publication-assets service-role delete" ON storage.objects;

CREATE POLICY "publication-assets service-role insert"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'publication-assets');

CREATE POLICY "publication-assets service-role update"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'publication-assets')
WITH CHECK (bucket_id = 'publication-assets');

CREATE POLICY "publication-assets service-role delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'publication-assets');
