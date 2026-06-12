# PTL-022 — Phase 9E + 9F: Asset Pipeline & Workflow Events

## 9E — Asset Pipeline

**Schema extensions on `publication_assets`:**
- `version` (int, default 1) — incremented when same kind is replaced
- `is_active` (bool, default true) — only one active asset per (slug, kind)
- `replaces_id` (uuid, nullable, FK self) — chain of replacement history
- `uploaded_at` (timestamptz) — explicit upload time
- `notes` (text) — author commentary on the asset
- Index: `(slug, kind, is_active)` for fast active-asset lookup

**Asset kinds (`src/publication/assets.ts`):**
front-cover · back-cover · epub-cover · paperback-cover · hardcover-cover ·
author-image · series-banner · marketing-graphic · interior-illustration ·
supporting-media

**Readiness scoring:**
- `PROFILE_ASSET_REQUIREMENTS` defines blocking assets per profile.
- `PROFILE_ASSET_RECOMMENDED` defines non-blocking nice-to-haves.
- `scoreAssets(profileId, assets)` returns required-score, combined-score,
  present/missing lists, and a `ready` boolean.

**Server functions (`src/lib/publication.functions.ts`):**
- `listPublicationAssets({slug})`
- `listAllPublicationAssets()` — used by the dashboard for cross-publication readiness
- `uploadPublicationAsset({slug, kind, url, label?, notes?})` — auto-deactivates
  the prior active asset of the same kind and bumps the version
- `deactivatePublicationAsset({slug, id})`

## 9F — Workflow Event Hooks

**New table `publication_events`:**
- `slug` FK → `publication_records.slug`
- `event_type` text (see `EVENT_TYPES`)
- `payload` jsonb
- `actor` text (nullable; "system" for seed events)
- `created_at` timestamptz
- Public SELECT, service-role writes.

**Event vocabulary (`src/publication/events.ts`):**
publication.created · metadata.updated · status.changed · asset.uploaded ·
asset.replaced · asset.deactivated · profile.changed · vera.updated ·
export.requested · readiness.recomputed

**Wired into existing mutations:**
- `seedFromLibrary` → `publication.created`
- `updatePublicationRecord` → `metadata.updated` *(or `profile.changed` when profile flips)*
- `updatePublicationMetadata` → `metadata.updated`
- `updatePublicationVera` → `vera.updated`
- `transitionPublicationStatus` → `status.changed`
- `uploadPublicationAsset` → `asset.uploaded` or `asset.replaced` + `readiness.recomputed`
- `deactivatePublicationAsset` → `asset.deactivated`

**UI:**
- `/ascend/publications` dashboard adds an **Assets** column (% required +
  missing list).
- `/ascend/publications/$slug` adds:
  - **Assets** section with upload form, versioned table, deactivate action,
    live readiness summary.
  - **Workflow Events** section showing the last 50 events with timestamps,
    actor, and payload.

## Validation Targets

- `research-over-emotion` — already seeded; profile = `research`; required
  assets: front-cover, epub-cover, author-image.
- `ghost-in-the-bet` — new stub manuscript under
  `manuscripts/ghost-in-the-bet/manuscript.md`; profile = `novel`; required
  assets: front-cover, epub-cover, author-image.

Both are auto-seeded on first dashboard load, generating a
`publication.created` event each.

## Outstanding Blockers

- None architectural. Asset uploads currently accept a URL; a binary
  upload pipeline (Lovable Cloud storage bucket + signed PUT) is the
  natural Phase 10 prerequisite for storefront-ready cover binaries.

## Recommended Phase 10 Starting Point

- **10A** — Storage-backed asset uploads (cover binaries to a public bucket;
  derive EPUB/Kindle cover resizes server-side).
- **10B** — ONIX / Apple / Kobo XML serialization driven by metadata +
  active assets.
- **10C** — Distribution submission queue + retry/event reconciliation hooks
  off `export.requested`.
