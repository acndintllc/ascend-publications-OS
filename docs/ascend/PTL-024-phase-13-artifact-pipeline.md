# PTL-024 — Phase 13A/B/C/D: Artifact Pipeline & Registry

## 13A — In-Worker runner integration
- `src/publication/runner.server.ts` — builds final EPUB, Kindle EPUB,
  PDF-source HTML, the full publication package, and per-store sub-packages
  via existing `buildEpub` / `buildPackage` / `buildStorePackage`, uploads
  bytes to the `publication-assets` bucket (`<slug>/_artifacts/<kind>[-<target>]/vN-<file>`),
  and registers each in `publication_artifacts`. Native PDF/KFX compilation
  still happens off-Worker (see `src/routes/api/public/render.kindle.ts`).
- `src/publication/runner-orchestrator.server.ts` — resolves a slug into
  doc + metadata + profile + assets + readiness and invokes the runner.

## 13B — Artifact registry (`publication_artifacts`)
- Columns: `kind`, `target`, `version`, `is_active`, `storage_bucket`,
  `storage_path`, `filename`, `byte_size`, `media_type`, `status`
  (`pending|generated|validated|failed|superseded`), `validation` (jsonb),
  `source_queue_id`, `generated_by`, `generated_at`, `superseded_at`.
- Version history is automatic: each new generation per (slug, kind, target)
  marks the prior active row `superseded` and inserts a new row at v+1.
- RLS: public read; service-role write only.

## 13C — Automated distribution preparation
- `updateDistributionEntry` now detects a transition into `state = "ready"`
  with no `artifact_url`, runs the orchestrator (with the queue entry's
  target as a store target), attaches the signed package URL to the queue
  row, and logs both `export.requested` and `readiness.recomputed` events.
- Failures are caught and logged as an `auto_prepare_failed` event so the
  queue doesn't get stuck on a transient runner error.

## Server functions added
- `generatePublicationArtifacts({ slug, storeTargets?, sourceQueueId?, actor? })`
- `listPublicationArtifacts({ slug })` — returns rows + signed download URLs
  for active artifacts (7-day TTL).
- `signArtifactUrl({ path })` — on-demand re-sign for older artifact versions.

## UI
- `/ascend/publications/$slug/distribute` now shows the Artifact Registry
  with version history, byte size, status, and one-click signed downloads,
  plus a "Generate & register artifacts" button alongside the existing
  package download.

## 13D — Validation procedure (Research Over Emotion)
1. `/ascend/publications` → seed if needed.
2. Open Research Over Emotion → Distribute.
3. Click "Generate & register artifacts" → confirm EPUB, Kindle, PDF-source,
   package, and per-store packages appear in the registry.
4. Queue any target → click "Ready" → verify `artifact_url` is auto-attached
   and a new `export.requested` event records `auto_prepared: true`.

## Outstanding blockers before first live publication
- Real PDF rendering still requires the external runner (PTL-016 contract).
- KFX/Kindle native conversion still requires KindleGen off-Worker.
- ISBN assignment for Apple Books / Google Play targets.
- Production storefront credentials + ONIX submission endpoints.
