create type artifact_status as enum ('pending','generated','validated','failed','superseded');

create table public.publication_artifacts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  kind text not null,
  target text,
  version integer not null default 1,
  is_active boolean not null default true,
  storage_bucket text not null default 'publication-assets',
  storage_path text not null,
  filename text not null,
  byte_size integer not null default 0,
  media_type text not null,
  status artifact_status not null default 'generated',
  validation jsonb not null default '{}'::jsonb,
  source_queue_id uuid,
  generated_by text,
  generated_at timestamptz not null default now(),
  superseded_at timestamptz
);

create index publication_artifacts_slug_idx on public.publication_artifacts (slug);
create index publication_artifacts_kind_idx on public.publication_artifacts (slug, kind, is_active);

grant select on public.publication_artifacts to authenticated, anon;
grant all on public.publication_artifacts to service_role;

alter table public.publication_artifacts enable row level security;
create policy "publication_artifacts readable"
  on public.publication_artifacts for select using (true);