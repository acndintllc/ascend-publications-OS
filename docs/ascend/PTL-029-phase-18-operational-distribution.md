# PTL-029 — Phase 18 · Operational Distribution

Phase 18 closes the gap between Distribution Infrastructure (PTL-028) and
Publishing Operations by promoting external Kindle generation to a primary
provider with automatic failover, wiring a governed live KDP submission
path that captures evidence into existing tracking systems, and automating
readiness re-evaluation on every status transition.

## 18A — Live KDP Integration Layer (`src/publication/kdp-live.server.ts`)
- `runLiveKdpSubmission({ slug, liveEnabled, approver })` consumes the
  existing `runKdpAdapter()`, gated by `evaluateGovernanceGate()`.
- Locates or creates a `publication_submissions` row, persists evidence
  (`receipt_id`, `submitted_at`, vendor, ISBN, package readiness, adapter
  response, governance checks) into `response_payload`, then transitions
  the row to `submitted`/`rejected` — no new lifecycle states.
- Mirrors the receipt + outcome into `publication_events`.

## 18B — KindleGen Provider Failover (`src/publication/kindle-orchestrator.server.ts`)
- `runKindleWithFailover()` resolves `external-kindlegen` via the runner
  provider registry; if `available()` is false, the primary call returns a
  failure (`provider_unavailable`, `generation_failed`, `timeout`,
  `callback_failure`, `invalid_artifact`), the orchestrator records the
  attempt and invokes `runReferenceKfx()` (stub) as the fallback.
- `forceFallback=true` proves the fallback path on demand.
- `kindleProviderHealth()` reports primary/fallback availability and the
  presence of `ASCEND_RUNNER_SECRET` / `ASCEND_KINDLEGEN_URL`.
- Each invocation appends an `export.requested` event with
  `action=kindle.failover`.

## 18C — Readiness Automation (`src/publication/readiness-automation.server.ts`)
- `revalidateReadiness(slug, trigger)` re-runs `auditPublication()` and
  emits `readiness.recomputed` with score, blocker/warning counts, active
  artifact count, configured vendor count, and ISBN count.
- `transitionPublicationStatus` now auto-invokes this after every status
  change; manual trigger is available via `revalidateReadinessFn`.

## 18F — Governance Gate (`src/publication/governance.server.ts`)
- `evaluateGovernanceGate({ slug, platform })` aggregates audit,
  submission-package readiness, vendor enablement, credential presence,
  ISBN assignment, audit cleanliness. Returns `{ approved, checks,
  blockers }` and writes an audit event.
- Live KDP submission refuses without `approved=true`.

## 18D — Ghost In The Bet Release Audit
Run via Command Center: **"Run full publication dry-run"**. Current
verdict for `ghost-in-the-bet` is **BLOCKED**, blockers:
- editorial status not `ready`
- no cover asset
- no assigned ISBN (KDP requires ISBN-13)
- `ASCEND_VENDOR_KDP_*` credential secret missing
- `ASCEND_KINDLEGEN_URL` unset → primary provider unavailable (fallback
  remains operational).

These are operational data inputs, not architectural gaps.

## 18E — Operational Proof
The complete pathway is exercisable from the Command Center:
1. **Generate artifacts** → fills `publication_artifacts`.
2. **Run Kindle (primary → fallback)** → records `kindle.failover` event;
   produces a registered KFX artifact with a signed URL even when the
   primary external endpoint is unconfigured.
3. **Validate submission packages** → confirms per-platform readiness.
4. **Evaluate governance gate (KDP)** → must return APPROVED.
5. **Execute live KDP submission** → writes receipt to
   `publication_submissions.response_payload`, advances status to
   `submitted`, emits `kdp.live_submission` event.

Until the workspace populates `ASCEND_KINDLEGEN_URL`, **Primary Provider
Success** is provable only against a configured external endpoint;
**Fallback Provider Success** is provable today via the "Force fallback"
button. Both paths are logged in `publication_events`.

## Remaining Live Publication Blockers
1. Provision external KindleGen endpoint + `ASCEND_KINDLEGEN_URL` /
   `ASCEND_KINDLEGEN_TOKEN` (no architectural work; pure ops).
2. Populate `ASCEND_VENDOR_KDP_<ACCOUNT>` for the live KDP account.
3. Replace the KDP live-submit stub in `kdp-adapter.server.ts` with a
   real KDP automation runner (browser-driver or partner API). The
   evidence capture layer is already in place.
4. Per-publication data: `ready` status, cover asset, assigned ISBN.

## Phase 19 Roadmap
- Deploy hosted KindleGen converter and verify primary-path success.
- Implement live KDP submission runner (replace stub, return real receipt
  data).
- Add Apple Books / Google Play live adapters reusing the governance gate.
- Wire scheduled `revalidateReadiness` sweeps across all publications.

## Files
**Created:** `kindle-orchestrator.server.ts`, `governance.server.ts`,
`kdp-live.server.ts`, `readiness-automation.server.ts`, this PTL.
**Modified:** `src/lib/publication.functions.ts` (Phase 18 server fns +
auto-readiness hook), `src/routes/ascend.publications.$slug.command.tsx`
(failover, governance, live-submission, revalidate buttons).
