# PTL-025 — Phase 14: Live Publication Readiness

## Scope
Removes the remaining blockers between the ASCEND Publishing OS and the first
live publication.

## What shipped
- **External runner contracts**: `/api/public/render/pdf` and `/api/public/render/kindle`
  document the runner→Worker job contract. New `/api/public/render/callback`
  accepts HMAC-SHA256 signed POSTs from external runners, supersedes any
  active artifact of the same kind, and writes a new versioned row into
  `publication_artifacts` plus an event into `publication_events`.
  HMAC verification uses Web Crypto (`crypto.subtle.sign`) for Worker
  compatibility; secret name is `ASCEND_RUNNER_SECRET`.
- **ISBN registry** (`publication_isbns`): assignment, format, edition,
  status, ISBN-13 checksum validation. Integrated into `auditPublication`
  via `evaluateIsbnCoverage` against Apple/Google requirements.
- **Vendor management** (`publication_vendors`): platform, label, account_id,
  `credential_ref` (secret name), `settings`, `submission_prefs`, enabled flag.
  Stable secret naming convention via `vendorCredentialName()`.
- **Storefront submissions** (`publication_submissions`): one row per
  platform attempt with states pending → submitted → accepted/rejected →
  published/withdrawn; ties to vendor and originating queue row.
- **First-publication audit** (`audit.server.ts`): runs the full
  readiness engine plus ISBN coverage, artifact presence, vendor presence,
  and lifecycle status; returns blockers + warnings + facts.
- **Command Center** (`/ascend/publications/$slug/command`): single-pane
  view of readiness, signals, facts, ISBNs, vendors, submissions,
  artifacts, and queue with inline CRUD.

## Tables added (RLS enabled, authenticated read, service_role full)
- `publication_isbns`
- `publication_vendors`
- `publication_submissions`

## First-publication readiness audit — Research Over Emotion
Run the audit via `auditPublicationFn({ data: { slug: "research-over-emotion" } })`
or open `/ascend/publications/research-over-emotion/command`.
Expected remaining blockers on a fresh install:
1. No assigned ISBN (Apple/Google require).
2. No generated artifacts (run "Generate artifacts").
3. Lifecycle status not at `ready` (advance through workflow).
4. No vendor configured for target platforms.

These are operational, not architectural — each is a one-form action in
the Command Center.

## Outstanding architectural blockers
- External PDF / KFX runner deployment (contract exists; runner not deployed).
- Live storefront submission API integration (currently manual / placeholder).
- Role-gated mutations (Phase 9D — deferred).

## Recommended next phase (15A)
- Deploy reference external runner against the documented contract,
  exercising `/api/public/render/callback` end-to-end with a signed PDF.
