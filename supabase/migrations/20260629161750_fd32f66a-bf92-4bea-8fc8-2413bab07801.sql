
CREATE TABLE public.publication_manuscripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  current_version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'validation_running'
    CHECK (status IN ('validation_running','report_ready','revision_submitted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX publication_manuscripts_owner_idx ON public.publication_manuscripts(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_manuscripts TO authenticated;
GRANT ALL ON public.publication_manuscripts TO service_role;
ALTER TABLE public.publication_manuscripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own manuscripts" ON public.publication_manuscripts
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.publication_manuscript_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id uuid NOT NULL REFERENCES public.publication_manuscripts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version int NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  format text NOT NULL,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'validation_running',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX publication_manuscript_versions_mid_idx
  ON public.publication_manuscript_versions(manuscript_id, version DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_manuscript_versions TO authenticated;
GRANT ALL ON public.publication_manuscript_versions TO service_role;
ALTER TABLE public.publication_manuscript_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own manuscript versions" ON public.publication_manuscript_versions
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.publication_records
  ADD COLUMN IF NOT EXISTS current_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS filter_report jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.publication_record_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL REFERENCES public.publication_records(slug) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version int NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  filter_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX publication_record_versions_slug_idx
  ON public.publication_record_versions(slug, version DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_record_versions TO authenticated;
GRANT ALL ON public.publication_record_versions TO service_role;
ALTER TABLE public.publication_record_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own record versions" ON public.publication_record_versions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
