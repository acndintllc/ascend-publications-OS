CREATE POLICY "publication-assets public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'publication-assets');