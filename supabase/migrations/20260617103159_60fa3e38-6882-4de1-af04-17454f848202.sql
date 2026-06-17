-- Creator Submission Package workflow lifecycle.
-- Separate from internal `status` so creators see their own funnel.
DO $$ BEGIN
  CREATE TYPE public.submission_state AS ENUM (
    'draft','submitted','needs_changes','approved',
    'in_production','ready_for_distribution','published'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.publication_records
  ADD COLUMN IF NOT EXISTS submission_status public.submission_state NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE INDEX IF NOT EXISTS publication_records_submission_status_idx
  ON public.publication_records (submission_status);