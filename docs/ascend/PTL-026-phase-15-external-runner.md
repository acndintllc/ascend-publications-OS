# PTL-026 — Phase 15: External Runner Deployment & Round-Trip

## 15A — Reference runner
- `src/publication/reference-runner.server.ts` ships a Worker-safe reference
  external runner. It loads the active `pdf-source` artifact for a slug,
  strips HTML to text, builds a hand-rolled multi-page PDF using PDF base-14
  Helvetica (no native deps, no font embedding), uploads the bytes to the
  `publication-assets` bucket under `<slug>/_runner/pdf/<ts>-<slug>.pdf`,
  HMAC-SHA256-signs the callback payload with `ASCEND_RUNNER_SECRET` and
  POSTs to `/api/public/render/callback` against the request's own origin.
- Server function: `runReferencePdfRunner({ slug, mode?, sourceQueueId? })`
  exposed from `src/lib/publication.functions.ts`. Origin is derived from
  the inbound request inside the handler.
- Callback handler (`src/routes/api/public/render.callback.ts`) now accepts
  an optional `status: "generated" | "failed"` field. Failed callbacks
  register a versioned, **inactive** artifact row with `status = "failed"`
  and emit an `auto_prepare_failed` event without superseding the prior
  active artifact or updating the queue.

## 15B — PDF round-trip validation (Research Over Emotion)
Trigger via Command Center → "Run reference PDF runner". Round-trip
confirmed:
1. PDF source artifact resolved and downloaded from bucket.
2. PDF bytes generated and uploaded.
3. HMAC signature verified by callback (status 200).
4. New `publication_artifacts` row inserted as v(N+1), prior active row
   marked `superseded` with `superseded_at` set.
5. If a `sourceQueueId` is provided, `publication_distribution_queue` row
   receives `artifact_url` (7-day signed URL).
6. `publication_events` row written with `event_type = "export.requested"`,
   `runner_callback: true`, runner id, version.
7. Active-artifacts list on Command Center re-fetches with a download link.

## 15C — Failure recovery (validated)
Run via Command Center → "Run failure simulations".
| Mode | Callback status | Registry effect |
|------|-----------------|------------------|
| `invalid_signature` | **401 Invalid signature** | No row inserted, no event |
| `missing_artifact` | 200 generated row with bogus path | Active row; download attempt 404s at sign time (path not in bucket) |
| `failed_generation` | 200 with `status: "failed"` | Inactive row; `auto_prepare_failed` event; prior active untouched; queue untouched |

## 15D — Readiness audit (Research Over Emotion, post-round-trip)
Remaining blockers between the OS and first live publication (operational,
not architectural):
1. ISBN assignment for Apple/Google targets.
2. Vendor configuration + storefront credential secrets per platform.
3. Production storefront submission API integration (currently manual /
   placeholder serializers + ONIX feed).
4. Lifecycle transition to `ready` after editorial sign-off.
5. Native KFX (Kindle) artifact — same runner contract applies; reference
   runner currently only covers PDF.

## Recommended next phase (16A)
Extend the reference runner contract to KFX (Kindle) by wrapping the
existing kindle EPUB artifact and round-tripping through the same callback,
then begin storefront submission API adoption (KDP first).
