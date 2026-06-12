# PTL-027 — Phase 16: Live Publication Completion

Phases 16A–16E close the architectural gap to first live publication.

## 16A — Kindle / KFX runner

- `src/publication/reference-runner-kfx.server.ts`: in-Worker reference KFX
  runner. Loads the active `kindle` (EPUB-format) artifact, wraps it in a
  deterministic KFX-shaped container (`KFXSTUB\0` magic + length-prefixed
  metadata + payload), uploads to the `publication-assets` bucket, and posts
  an HMAC-signed callback to `/api/public/render/callback` with
  `kind="kindle"`, `target="kdp"`, `media_type="application/vnd.amazon.ebook"`.
- Reuses the Phase 15 signed-callback contract, the versioning logic in
  `runner.server.ts`, and the failure-mode taxonomy (`ok`,
  `invalid_signature`, `missing_artifact`, `failed_generation`).
- Real KFX (Amazon's KindleGen/KPR) remains a native-binary dependency and
  must be served by an external runner; this in-Worker runner provides the
  reference round-trip and an EPUB-faithful payload until that runner ships.

## 16B — KDP submission package builder

- `src/publication/submission-package.server.ts`: builds a per-platform
  manifest combining metadata (validated via `publicationMetadataSchema`),
  the platform serializer body, a usable ISBN (`assigned`/`registered`,
  checksum-valid), the active EPUB or Kindle artifact (signed URL), and the
  active cover asset.
- `ready=true` only when no `error`-level issues are present:
  missing required metadata fields, missing/invalid ISBN on
  ISBN-required platforms, missing artifact for the platform, missing
  cover.
- Surfaced as `buildPublicationSubmissionPackage` server fn and a
  "Validate submission packages" button in the Command Center.

## 16C — Vendor secret management

- `src/publication/vendor-secrets.server.ts`: reports — without leaking
  values — whether the environment variable named by `credential_ref` (or
  by the conventional `ASCEND_VENDOR_<PLATFORM>_<ACCOUNT>` fallback)
  is set. Flags non-conventional names and provides the expected rotation
  target.
- `reportVendorSecretsFn` server fn + new "Credential Secrets" panel in the
  Command Center.
- Missing secret for an enabled vendor with submissions is now an audit
  **blocker** (previously a warning).

## 16D — ISBN workflow

- `src/publication/isbn-workflow.ts`: lifecycle map
  `reserved → assigned → registered → retired` with terminal `retired`.
- `transitionIsbn` server fn enforces the transition graph and records a
  `metadata.updated` event with `action: "isbn.transition"`.
- Per-row transition buttons in the ISBN Registry table.

## 16E — First-live deployment audit

`auditPublication()` now also reports:
- artifact presence by kind (`hasEpubArtifact`, `hasKindleArtifact`,
  `hasPdfArtifact`)
- vendor configuration count (`vendorsConfigured`)
- `vendorSecrets: VendorSecretReport[]`

Research-Over-Emotion audit (run via Command Center → Readiness):

Known remaining operational gaps before first live publication:

1. **Real KFX:** the reference KFX runner emits a KFX-shaped stub. KDP
   accepts the EPUB payload it wraps, but native KFX needs an external
   KindleGen/KPR runner against the existing `/api/public/render/callback`
   contract — adopt by deploying the runner and pointing it at the same
   signed callback. No additional ASCEND code is required.
2. **Live storefront submission APIs:** packages are validated and signed
   end-to-end; the per-vendor "submit" call still requires per-platform
   adapter implementations (KDP automation, Apple Books API, Kobo Writing
   Life upload, Google Play Books partner API, Draft2Digital). Track per
   `publication_submissions.status`.
3. **ISBN agency registration:** the workflow now models `registered`
   formally; tying it to a real ISBN agency (Bowker, Nielsen) requires
   that agency's account and remains a manual step.
4. **Vendor credentials:** secret slots exist (see "Credential Secrets"
   panel); each platform's actual token type and rotation cadence is a
   per-account operational decision.

## Files

**Created**
- `src/publication/reference-runner-kfx.server.ts`
- `src/publication/submission-package.server.ts`
- `src/publication/vendor-secrets.server.ts`
- `src/publication/isbn-workflow.ts`
- `docs/ascend/PTL-027-phase-16-live-completion.md`

**Modified**
- `src/lib/publication.functions.ts` — added `runReferenceKfxRunner`,
  `buildPublicationSubmissionPackage`, `reportVendorSecretsFn`,
  `transitionIsbn`.
- `src/publication/audit.server.ts` — added vendor-secret blockers,
  per-kind artifact facts, `vendorSecrets[]`.
- `src/routes/ascend.publications.$slug.command.tsx` — KFX runner button,
  submission-package validator, vendor-secret panel, ISBN transition row
  controls.

## Recommended Phase 17

External adoption: deploy a real KindleGen/KPR runner against
`/api/public/render/callback` and a live KDP submission adapter that
consumes `buildPublicationSubmissionPackage` output. Once both round-trip,
publish "Ghost In The Bet" via the Command Center as the first live title.
