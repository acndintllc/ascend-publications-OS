
CREATE TABLE public.publication_isbns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  isbn TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT '1',
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE (isbn, format)
);
GRANT SELECT ON public.publication_isbns TO authenticated;
GRANT ALL ON public.publication_isbns TO service_role;
ALTER TABLE public.publication_isbns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read isbns" ON public.publication_isbns FOR SELECT TO authenticated USING (true);

CREATE TABLE public.publication_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  account_id TEXT,
  label TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  credential_ref TEXT,
  submission_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, account_id)
);
GRANT SELECT ON public.publication_vendors TO authenticated;
GRANT ALL ON public.publication_vendors TO service_role;
ALTER TABLE public.publication_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read vendors" ON public.publication_vendors FOR SELECT TO authenticated USING (true);

CREATE TABLE public.publication_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  platform TEXT NOT NULL,
  vendor_id UUID REFERENCES public.publication_vendors(id) ON DELETE SET NULL,
  queue_id UUID,
  isbn TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX publication_submissions_slug_idx ON public.publication_submissions(slug);
GRANT SELECT ON public.publication_submissions TO authenticated;
GRANT ALL ON public.publication_submissions TO service_role;
ALTER TABLE public.publication_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read submissions" ON public.publication_submissions FOR SELECT TO authenticated USING (true);
