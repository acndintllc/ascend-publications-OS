-- 9E: extend publication_assets for versioning
ALTER TABLE public.publication_assets
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS replaces_id uuid REFERENCES public.publication_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS publication_assets_slug_kind_active_idx
  ON public.publication_assets(slug, kind, is_active);

-- Existing INSERT/UPDATE/DELETE on publication_assets is service-role only (matches other tables).
GRANT INSERT, UPDATE, DELETE ON public.publication_assets TO service_role;

-- 9F: workflow event log
CREATE TABLE IF NOT EXISTS public.publication_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL REFERENCES public.publication_records(slug) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publication_events_slug_created_idx
  ON public.publication_events(slug, created_at DESC);

GRANT SELECT ON public.publication_events TO anon, authenticated;
GRANT ALL ON public.publication_events TO service_role;

ALTER TABLE public.publication_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "publication_events readable"
  ON public.publication_events FOR SELECT
  USING (true);