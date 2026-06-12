CREATE TYPE distribution_queue_state AS ENUM ('queued','processing','blocked','ready','submitted','failed');

CREATE TABLE public.publication_distribution_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  target text NOT NULL,
  state distribution_queue_state NOT NULL DEFAULT 'queued',
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

GRANT SELECT ON public.publication_distribution_queue TO anon, authenticated;
GRANT ALL ON public.publication_distribution_queue TO service_role;

ALTER TABLE public.publication_distribution_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distribution_queue readable"
  ON public.publication_distribution_queue
  FOR SELECT TO public USING (true);

CREATE INDEX idx_dq_slug ON public.publication_distribution_queue(slug);
CREATE INDEX idx_dq_state ON public.publication_distribution_queue(state);