# PTL-021 — Phase 9A/9B/9C: Persistence, Authoring UI, VERA Renderer

## 9A — Persistence Layer

Tables (Lovable Cloud / Postgres):

- `publication_records` — slug PK, title, subtitle, series, volume, status
  (enum `publication_status`), version, profile, author, audience, language,
  publication_date, last_updated, created_at.
- `publication_metadata` — slug PK FK, description, keywords[], categories[],
  contributors[], reading_level, isbn, publisher, rights, updated_at.
- `publication_versions` — id, slug, version, status, notes, created_at.
  Append-only history; one row per status transition.
- `publication_assets` — id, slug, kind, url, label, created_at. Placeholder
  for cover art and supplemental files; written by future asset pipeline.
- `publication_vera_config` — slug PK, enabled_kinds[], default_voice,
  config JSONB. Drives the runtime VERA gating in the renderer.

RLS: enabled on every table. SELECT open (operations dashboard is currently
unauth per spec). Writes happen only through server functions that load the
service-role admin client — anon/authenticated cannot mutate directly. Role
gating arrives in Phase 9D.

## 9B — Authoring Operations UI

`src/lib/publication.functions.ts` exposes the operational surface:

- `seedFromLibrary` — idempotent backfill from the build-time manuscript
  library; runs on every dashboard load.
- `listPublications` / `getPublication` — read paths joined across record,
  metadata, and vera_config.
- `updatePublicationRecord`, `updatePublicationMetadata`,
  `updatePublicationVera` — Zod-validated upserts.
- `transitionPublicationStatus` — enforces `STATUS_TRANSITIONS` and writes a
  `publication_versions` history row.

Routes:

- `/ascend/publications` — table view, now DB-backed. Each row links to the
  detail editor and shows VERA kind counts.
- `/ascend/publications/$slug` — authoring detail view:
  - Lifecycle: shows allowed transitions only; one-click status moves.
  - Publication Record: all required fields editable (title, subtitle,
    series, volume, version, profile, author, audience, language,
    publication_date).
  - Distribution Metadata: description, keywords, categories, contributors,
    reading level, ISBN, publisher, rights. Live storefront readiness check
    against KDP / Apple / Kobo / D2D / Google Play.
  - VERA Configuration: per-kind checkboxes, profile allow-list enforced at
    the UI layer (kinds outside the profile are disabled).
  - Validation & Export: pulls live `enrich()` and `planExports()` against
    the bundled manuscript so the editor sees the same readiness as the
    dashboard.

No visual polish per spec — semantic form layout, native inputs.

## 9C — VERA Renderer Integration

Schema:

- `VeraNote` extended with optional `kind` (one of the seven registered
  VERA block kinds) and `source`. `attachVera` carries those fields end to
  end.

Renderer (`src/manuscript/render/aca-renderer.tsx`):

- `RenderManuscript` accepts `allowedVeraKinds?: VeraBlockKind[]`. Undefined
  means "render everything" (used for live preview / unseeded manuscripts).
- Each VERA block renders with kind-specific accent color, label drawn from
  `VERA_BLOCKS`, optional source line, interactivity hint, and a warning
  when `requiresSource` is set but no source was provided.
- When a block kind is outside the allow-list, a minimal "VERA block
  suppressed by profile" marker renders in its place (fallback handling
  for invalid/unsupported configurations).

Reader route:

- `/ascend/reader/$slug` loader now fetches `publication_vera_config` via
  `getPublication`. Allowed kinds flow into `RenderManuscript`. If the
  publication has not been seeded yet, the reader falls back to rendering
  every kind.

## Validation Targets

- **Research Over Emotion** — gained a `vera.json` with three notes covering
  `vera-insight`, `vera-research-prompt`, and `vera-question` (all permitted
  by the Research profile). The dashboard seeds it as Research, the reader
  applies the profile's allow-list, and all three kinds render with their
  proper styling. Toggling off a kind in the detail view immediately shows
  the suppression fallback in the reader on next load.
- **Cartographer's Confession** / **The Glass Archive** — auto-seeded as
  Novel profile. Profile permits `vera-note` and `vera-insight` only;
  pre-existing `vera.json` notes for Cartographer render unchanged.

## Outstanding Blockers

None observed. Writes are unauthenticated (Phase 9D will add roles + RLS
write policies).

## Recommended Phase 9D Roadmap

1. **Roles & RLS writes** — `user_roles` table + `has_role()` + replace
   service-role writes with `requireSupabaseAuth` middleware on the server
   functions.
2. **Storefront serialization** — emit ONIX / KDP CSV / Apple `.itmsp`
   from `adaptForTarget()` payloads.
3. **Asset pipeline** — wire `publication_assets` to Lovable Cloud Storage
   (covers, audio, supplemental files) with thumbnail generation.
4. **Workflow events** — Postgres triggers on status transitions to drive
   future notification / scheduling hooks.
5. **Multi-author** — author table + per-publication contributor invites
   once roles ship.
