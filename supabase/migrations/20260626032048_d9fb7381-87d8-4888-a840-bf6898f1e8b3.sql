
DROP POLICY IF EXISTS "publication_assets readable" ON public.publication_assets;
CREATE POLICY "publication_assets owner read" ON public.publication_assets
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "publication-assets auth read" ON storage.objects;
CREATE POLICY "publication-assets owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'publication-assets'
    AND EXISTS (
      SELECT 1 FROM public.publication_records pr
      WHERE pr.owner_id = auth.uid()
        AND pr.slug = split_part(storage.objects.name, '/', 1)
    )
  );
