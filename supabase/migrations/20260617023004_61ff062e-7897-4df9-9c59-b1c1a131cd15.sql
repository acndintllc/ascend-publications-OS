
-- Helper: resolve owner user id at migration time
DO $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = 'acndintllc@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Owner user acndintllc@gmail.com not found; owner_id columns will allow NULL backfill.';
  END IF;

  -- publication_records
  ALTER TABLE public.publication_records ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_records SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_metadata
  ALTER TABLE public.publication_metadata ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_metadata SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_sources
  ALTER TABLE public.publication_sources ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_sources SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_assets
  ALTER TABLE public.publication_assets ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_assets SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_artifacts
  ALTER TABLE public.publication_artifacts ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_artifacts SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_submissions
  ALTER TABLE public.publication_submissions ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_submissions SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_distribution_queue
  ALTER TABLE public.publication_distribution_queue ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_distribution_queue SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_isbns
  ALTER TABLE public.publication_isbns ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_isbns SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_events
  ALTER TABLE public.publication_events ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_events SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_vera_config
  ALTER TABLE public.publication_vera_config ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_vera_config SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;

  -- publication_versions
  ALTER TABLE public.publication_versions ADD COLUMN IF NOT EXISTS owner_id uuid;
  IF v_owner IS NOT NULL THEN
    UPDATE public.publication_versions SET owner_id = v_owner WHERE owner_id IS NULL;
  END IF;
END $$;

-- FK refs (auth.users) — SET NULL on delete so user deletion doesn't cascade-drop data
ALTER TABLE public.publication_records
  DROP CONSTRAINT IF EXISTS publication_records_owner_id_fkey,
  ADD CONSTRAINT publication_records_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_metadata
  DROP CONSTRAINT IF EXISTS publication_metadata_owner_id_fkey,
  ADD CONSTRAINT publication_metadata_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_sources
  DROP CONSTRAINT IF EXISTS publication_sources_owner_id_fkey,
  ADD CONSTRAINT publication_sources_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_assets
  DROP CONSTRAINT IF EXISTS publication_assets_owner_id_fkey,
  ADD CONSTRAINT publication_assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_artifacts
  DROP CONSTRAINT IF EXISTS publication_artifacts_owner_id_fkey,
  ADD CONSTRAINT publication_artifacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_submissions
  DROP CONSTRAINT IF EXISTS publication_submissions_owner_id_fkey,
  ADD CONSTRAINT publication_submissions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_distribution_queue
  DROP CONSTRAINT IF EXISTS publication_distribution_queue_owner_id_fkey,
  ADD CONSTRAINT publication_distribution_queue_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_isbns
  DROP CONSTRAINT IF EXISTS publication_isbns_owner_id_fkey,
  ADD CONSTRAINT publication_isbns_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_events
  DROP CONSTRAINT IF EXISTS publication_events_owner_id_fkey,
  ADD CONSTRAINT publication_events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_vera_config
  DROP CONSTRAINT IF EXISTS publication_vera_config_owner_id_fkey,
  ADD CONSTRAINT publication_vera_config_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.publication_versions
  DROP CONSTRAINT IF EXISTS publication_versions_owner_id_fkey,
  ADD CONSTRAINT publication_versions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS publication_records_owner_idx ON public.publication_records(owner_id);
CREATE INDEX IF NOT EXISTS publication_assets_owner_idx ON public.publication_assets(owner_id);
CREATE INDEX IF NOT EXISTS publication_artifacts_owner_idx ON public.publication_artifacts(owner_id);
CREATE INDEX IF NOT EXISTS publication_metadata_owner_idx ON public.publication_metadata(owner_id);
CREATE INDEX IF NOT EXISTS publication_sources_owner_idx ON public.publication_sources(owner_id);
CREATE INDEX IF NOT EXISTS publication_submissions_owner_idx ON public.publication_submissions(owner_id);
CREATE INDEX IF NOT EXISTS publication_distribution_queue_owner_idx ON public.publication_distribution_queue(owner_id);
CREATE INDEX IF NOT EXISTS publication_isbns_owner_idx ON public.publication_isbns(owner_id);
CREATE INDEX IF NOT EXISTS publication_events_owner_idx ON public.publication_events(owner_id);
CREATE INDEX IF NOT EXISTS publication_vera_config_owner_idx ON public.publication_vera_config(owner_id);
CREATE INDEX IF NOT EXISTS publication_versions_owner_idx ON public.publication_versions(owner_id);
