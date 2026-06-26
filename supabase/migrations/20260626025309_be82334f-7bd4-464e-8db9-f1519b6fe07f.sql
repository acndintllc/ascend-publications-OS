
-- publication_records
DROP POLICY IF EXISTS "publication_records readable" ON public.publication_records;
CREATE POLICY "publication_records owner readable"
  ON public.publication_records FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- publication_metadata
DROP POLICY IF EXISTS "publication_metadata readable" ON public.publication_metadata;
CREATE POLICY "publication_metadata owner readable"
  ON public.publication_metadata FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- publication_versions
DROP POLICY IF EXISTS "publication_versions readable" ON public.publication_versions;
CREATE POLICY "publication_versions owner readable"
  ON public.publication_versions FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- publication_artifacts
DROP POLICY IF EXISTS "publication_artifacts auth readable" ON public.publication_artifacts;
CREATE POLICY "publication_artifacts owner readable"
  ON public.publication_artifacts FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- publication_vera_config
DROP POLICY IF EXISTS "publication_vera_config auth readable" ON public.publication_vera_config;
CREATE POLICY "publication_vera_config owner readable"
  ON public.publication_vera_config FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());
