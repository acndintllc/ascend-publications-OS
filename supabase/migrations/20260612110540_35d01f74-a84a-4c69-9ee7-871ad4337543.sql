
-- Lifecycle status enum
CREATE TYPE public.publication_status AS ENUM (
  'draft','editing','review','formatting','ready','published','archived'
);

CREATE TABLE public.publication_records (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  series TEXT,
  volume INTEGER,
  status public.publication_status NOT NULL DEFAULT 'draft',
  version TEXT NOT NULL DEFAULT '0.1.0',
  profile TEXT NOT NULL DEFAULT 'novel',
  author TEXT NOT NULL,
  audience TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  publication_date DATE,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.publication_records TO anon, authenticated;
GRANT ALL ON public.publication_records TO service_role;
ALTER TABLE public.publication_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publication_records readable" ON public.publication_records FOR SELECT USING (true);

CREATE TABLE public.publication_metadata (
  slug TEXT PRIMARY KEY REFERENCES public.publication_records(slug) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  categories TEXT[] NOT NULL DEFAULT '{}',
  contributors TEXT[] NOT NULL DEFAULT '{}',
  reading_level TEXT,
  isbn TEXT,
  publisher TEXT NOT NULL DEFAULT 'ASCEND Media',
  rights TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.publication_metadata TO anon, authenticated;
GRANT ALL ON public.publication_metadata TO service_role;
ALTER TABLE public.publication_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publication_metadata readable" ON public.publication_metadata FOR SELECT USING (true);

CREATE TABLE public.publication_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL REFERENCES public.publication_records(slug) ON DELETE CASCADE,
  version TEXT NOT NULL,
  status public.publication_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX publication_versions_slug_idx ON public.publication_versions (slug, created_at DESC);
GRANT SELECT ON public.publication_versions TO anon, authenticated;
GRANT ALL ON public.publication_versions TO service_role;
ALTER TABLE public.publication_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publication_versions readable" ON public.publication_versions FOR SELECT USING (true);

CREATE TABLE public.publication_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL REFERENCES public.publication_records(slug) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX publication_assets_slug_idx ON public.publication_assets (slug);
GRANT SELECT ON public.publication_assets TO anon, authenticated;
GRANT ALL ON public.publication_assets TO service_role;
ALTER TABLE public.publication_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publication_assets readable" ON public.publication_assets FOR SELECT USING (true);

CREATE TABLE public.publication_vera_config (
  slug TEXT PRIMARY KEY REFERENCES public.publication_records(slug) ON DELETE CASCADE,
  enabled_kinds TEXT[] NOT NULL DEFAULT '{}',
  default_voice TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.publication_vera_config TO anon, authenticated;
GRANT ALL ON public.publication_vera_config TO service_role;
ALTER TABLE public.publication_vera_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publication_vera_config readable" ON public.publication_vera_config FOR SELECT USING (true);
