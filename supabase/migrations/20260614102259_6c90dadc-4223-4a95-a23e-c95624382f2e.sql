
CREATE TABLE public.publication_sources (
  slug TEXT PRIMARY KEY,
  format TEXT NOT NULL CHECK (format IN ('md','docx')),
  storage_path TEXT NOT NULL,
  bib_path TEXT,
  vera_path TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.publication_sources TO service_role;
ALTER TABLE public.publication_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.publication_sources FOR ALL TO service_role USING (true) WITH CHECK (true);
