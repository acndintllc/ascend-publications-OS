# PTL-028 — Phase 17: External Distribution Infrastructure

ASCEND now connects to external distribution ecosystems while keeping the
Phase 8–16 publishing OS intact.

## Architecture

### Runner Provider Layer (Phase 17A)
`src/publication/runner-provider.ts` defines a pure registry of artifact
runners with a standard result contract (`StandardRunnerResult`):

- `ok`, `provider`, `kind`, `warnings`, `errors`
- `callback_status`, `artifact_path`, `signed_url`
- `failure ∈ generation_failed | provider_unavailable | invalid_artifact | callback_failure | timeout`
- `validation` (JSON-serializable bag of metadata)

Registered providers:
| id | kind | fallback | available when |
|----|------|----------|----------------|
| `reference-runner-in-worker` | pdf | yes | `ASCEND_RUNNER_SECRET` set |
| `external-kindlegen` | kindle | no | `ASCEND_RUNNER_SECRET` + `ASCEND_KINDLEGEN_URL` set |
| `reference-kfx-runner-in-worker` | kindle | yes | `ASCEND_RUNNER_SECRET` set |

`resolveProvider(kind, preferredId?)` returns the best available
(non-fallback first, then fallback). All runners terminate by POSTing to
`/api/public/render/callback` so versioning, audit logging, and supersede
semantics are unchanged.

### External KindleGen runner (Phase 17A)
`src/publication/runner-external-kindlegen.server.ts` loads the active
Kindle EPUB, POSTs its bytes to `ASCEND_KINDLEGEN_URL`
(`Authorization: Bearer ASCEND_KINDLEGEN_TOKEN || ASCEND_RUNNER_SECRET`),
uploads the returned KFX bytes to `publication-assets`, and signs a
callback registration. Failure modes (`provider_unavailable`,
`generation_failed`, `invalid_artifact`, `timeout`, `callback_failure`)
short-circuit before mutating the registry. Stub KFX runner is preserved
as the fallback provider.

### KDP Submission Adapter (Phase 17B)
`src/publication/kdp-adapter.server.ts` wraps the existing
`buildSubmissionPackage("kdp")` with:
- State machine: `pending → validated → ready_for_submission → submitted → accepted|rejected → published`, with `canTransitionKdp()`.
- Vendor + credential gating (uses existing `reportVendorSecrets`).
- `runKdpAdapter({ slug, live })` — `live: false` is the default and runs a
  dry-run; `live: true` still refuses to submit unless
  `ready_for_submission`. The live-submit hook is intentionally a no-op
  placeholder so the adapter cannot silently publish before a real KDP
  automation runner exists (Phase 18).

### Publication Dry-Run (Phase 17C)
`src/publication/dry-run.server.ts` composes
`auditPublication → runArtifactGenerationForSlug → runKdpAdapter` and
returns a `DryRunReport` classified `READY | READY_WITH_WARNINGS |
BLOCKED` plus aggregated blockers/warnings and an artifact summary.

## Files created
- `src/publication/runner-provider.ts`
- `src/publication/runner-external-kindlegen.server.ts`
- `src/publication/kdp-adapter.server.ts`
- `src/publication/dry-run.server.ts`
- `docs/ascend/PTL-028-phase-17-external-distribution.md`

## Files modified
- `src/lib/publication.functions.ts` — added `runExternalKindlegenRunner`,
  `listRunnerProvidersFn`, `runKdpAdapterFn`, `runPublicationDryRunFn`.
- `src/routes/ascend.publications.$slug.command.tsx` — new actions:
  "Run external KindleGen", "Run KDP dry-run", "Run full publication
  dry-run".

## Ghost In The Bet dry-run
The Command Center → *Run full publication dry-run* triggers
`runPublicationDryRun({ slug: "ghost-in-the-bet" })`. With only the
bundled manuscript present and no editorial setup, the expected verdict
is **BLOCKED**, with deterministic blockers:
1. Publication status not at `ready/published`
2. Missing cover asset
3. Missing active Kindle artifact (until KFX runner runs)
4. ISBN required for `kdp/apple-books/google-play-books`
5. No enabled KDP vendor / credential secret missing

When the operator clears each, the verdict deterministically progresses
to READY_WITH_WARNINGS, then READY.

## Remaining blockers preventing live publication
1. **Editorial state** — set Ghost In The Bet status to `ready`.
2. **Cover asset** — upload via authoring.
3. **ISBN** — assign + transition to `assigned/registered`.
4. **KDP vendor + credential** — add vendor row, populate the
   `ASCEND_VENDOR_KDP_<ACCOUNT>` secret.
5. **External KindleGen endpoint** — set `ASCEND_KINDLEGEN_URL` (+ token)
   for real KFX; otherwise stub remains the active fallback.
6. **Live KDP submit endpoint** — adapter's live path is a deliberate
   placeholder; wire to a real KDP automation runner in Phase 18.

## Recommended Phase 18 roadmap
- Deploy a hosted KindleGen converter and point `ASCEND_KINDLEGEN_URL` at
  it; confirm round-trip via Command Center.
- Build the live KDP automation runner (browser-driver or partner API)
  that consumes the dry-run package and reports back through the
  submission lifecycle.
- Add Apple Books and Google Play adapters mirroring `kdp-adapter.server.ts`.
- Run "Ghost In The Bet" through live submission once the runner exists.
