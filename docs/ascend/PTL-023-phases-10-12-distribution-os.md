# PTL-023 / PTL-024 / PTL-025 — PHASES 10–12: DISTRIBUTION OS

**Status:** Implemented.

## Phase 10A — Storage-backed asset pipeline
- New Supabase Storage bucket `publication-assets` (private; public read policy on `storage.objects` for that bucket so the rendered URLs work in EPUB/HTML).
- `src/publication/storage.server.ts` — `createSignedUpload({slug,kind,filename})` returns a signed PUT URL plus the public-read URL. Path layout: `<slug>/<kind>/<uuid><ext>`.
- Server fn `createAssetUploadUrl` exposes it. Browser PUTs to `signedUrl`, then calls existing `uploadPublicationAsset({url: publicUrl, ...})` to register in `publication_assets` — preserving version chains, `replaces_id`, and the existing readiness scorer.

## Phase 10B — Distribution serializers
- `src/publication/serializers/` with `kdp`, `apple-books`, `kobo`, `draft2digital`, `google-play`, `onix`.
- ONIX 3.0 is the canonical trade payload (Ingram, OverDrive, Google Play accept it). Per-platform serializers emit JSON (KDP/Kobo/D2D/Google) or XML (Apple itmsp, ONIX).
- Each serializer returns `{target, format, mediaType, filename, body, issues}` and surfaces per-platform required-field blockers.

## Phase 10C — Distribution queue
- Table `publication_distribution_queue` with enum `distribution_queue_state` (queued/processing/blocked/ready/submitted/failed).
- `src/publication/queue.ts` + `queue.server.ts` + server fns: `listDistributionQueue`, `enqueueDistribution`, `updateDistributionEntry`, `removeDistributionEntry`.
- Every queue mutation emits an `export.requested` workflow event.

## Phase 10D — Readiness engine
- `src/publication/readiness.ts::computeReadiness()` combines five weighted signals: metadata (0.30), assets (0.25), profile compliance (0.10), export validation (0.20), lifecycle status (0.15). Returns percent, blockers, recommendations.

## Phase 11A/B — EPUB + Kindle generation
- Existing `buildEpub(doc, "epub3" | "kindle")` already shipped (PTL-015/016). Packager reuses both profiles; KF8-safe stylesheet from `kindle-css.ts`.

## Phase 11C — PDF generation
- `printableHtml(doc)` in `packager.ts` emits a single self-contained HTML5 doc with the flattened manuscript stylesheet plus `@page` rules. This is the PDF source consumed by the external runner per PTL-016's contract; native PDF/KFX compilation cannot run inside the Worker (server-runtime constraint).

## Phase 11D — Export validation
- `src/publication/validate-exports.ts::validateAllExports()` runs profile-aware checks on the EPUB/Kindle binary (size caps, dc:title, dc:creator, content presence) and PDF source.

## Phase 12A — Publication package
- `buildPackage(inputs)` zips manifest.json, metadata (+ ONIX), asset manifest, exports/(epub|kindle.epub|print.html|reader.xhtml), distribution/*.{json,xml}, validation/report.json. Pure-JS via fflate (Worker-safe).

## Phase 12B — Per-store submission packages
- `buildStorePackage(inputs, target)` produces a focused zip: target serializer payload + ONIX + correct EPUB profile (KDP → kindle.epub; others → profile default) + asset manifest + metadata.

## Phase 12C — Platform readiness reports
- `/ascend/publications/$slug/distribute` shows the per-platform table with READY / WARNING / BLOCKED state, surfaces missing fields, exposes "Submission package" download and "Queue" action per platform, and renders the full readiness panel + queue console.

## Validation targets
- Research Over Emotion and Ghost In The Bet ingest into the library, persist on dashboard seed, and exercise the full distribute console (readiness → queue → store packages).

## Outstanding
- Real PDF/KFX bytes require the external runner (PTL-016 contract). The Worker side is feature-complete.
- Phase 9D auth/role gates still deferred; queue + packager are reachable by anyone with dashboard access.

## Next executable phase
- **Phase 13A** — external build-runner adoption: wire the `/api/public/render/*` contract to consume `buildStorePackage()` output and emit final PDF/KFX artifact URLs onto queue rows.
