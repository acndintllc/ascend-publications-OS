# Submission Workflow Fix

Splits today's single "Submit" flow into two clearly separated tracks (Manuscripts vs Packages), makes both **persist forever**, adds in-place **versioning** instead of duplicate records, and gives admin visibility for outreach. No approval workflow on the manuscript side — users validate and iterate themselves.

## What changes for the user

### My Manuscripts (new dashboard section)
- Lists every manuscript the user has uploaded — never disappears.
- Columns: Title, Date, Current Version (v1/v2/v3…), Status.
- Statuses: `Validation Running` → `Report Ready` → `Revision Submitted` (loops back to Validation Running, then Report Ready again).
- Actions per row:
  - **View Report** — opens the stored audit (errors, warnings, flags) for the latest version.
  - **Resubmit** — opens a single-file upload form, pre-filled with the previous title; user swaps the manuscript file; submitting bumps the version on the same record.
  - **History** — expandable list of prior versions, each with its own report.

### My Packages (rework of existing dashboard)
- Same persistence + versioning model.
- Statuses: `Filter Running` → `Not Ready` / `Ready` → `Submitted to KDP` → `Live`.
- Actions: **View Report**, **Update Package** (pre-filled form, swap files/metadata, resubmit → versions the same record), **History**.
- The current "Submit a Package" entry stays; it just routes into the versioned record on resubmit.

### Submission entry points
Dashboard gets two clear CTAs side-by-side:
- **+ Submit Manuscript** (lightweight: file + title, runs validation, returns report)
- **+ Submit Package** (existing 5-step wizard)

## What changes for admin

### Manuscript Tracking (new admin view)
- Read-only table of every manuscript across all users.
- Columns: Title, Author, User email, First Submitted, Latest Version, Latest Status, Last Activity, Stale flag.
- **Stale flag** lights up when `Report Ready` and no resubmission for ≥ 14 days — drives outreach.
- No approve/reject buttons. Pure visibility.

Existing Submission Queue (packages) stays as-is.

## Versioning rules (both tracks)
- Resubmit = new row in a `*_versions` table, parent record's `current_version` increments.
- Dashboards show the latest version by default; History expands the rest.
- Reports are stored per version (jsonb) so old reports remain viewable.

---

## Technical section

### Database (one migration)

New table `publication_manuscripts` (parent, one per title):
```
id uuid pk, owner_id uuid, title text, current_version int default 1,
status text check in ('validation_running','report_ready','revision_submitted'),
created_at, last_activity_at
```

New table `publication_manuscript_versions` (one row per submission):
```
id uuid pk, manuscript_id uuid fk, version int,
storage_path text,          -- supabase storage key
filename text, format text, -- md|docx|pdf
report jsonb,               -- audit output: errors[], warnings[], flags[]
status text,                -- mirrors parent at time of run
created_at
```

Add to `publication_records` (packages):
```
current_version int default 1,
last_activity_at timestamptz,
filter_report jsonb         -- latest filter/readiness result
```

New table `publication_record_versions` for package history:
```
id, slug fk, version int, snapshot jsonb, filter_report jsonb, created_at
```

All tables: `GRANT` to authenticated + service_role, RLS = owner-readable + service_role full; admin reads via existing `requireOwner` middleware bypassing RLS via `supabaseAdmin`.

### Storage
Reuse `publication-manuscripts` bucket, keyed `<user_id>/<manuscript_id>/v<n>/<filename>`.

### Server functions (`src/lib/manuscripts.functions.ts`, new)
- `submitManuscript({ title, file })` → creates parent + v1, runs validation, writes report, returns `{ manuscriptId, report }`.
- `resubmitManuscript({ manuscriptId, file })` → asserts ownership, creates v(n+1), re-runs validation, returns new report.
- `listMyManuscripts()` → parent rows + latest version summary for the dashboard.
- `getManuscriptDetail({ manuscriptId })` → parent + all versions + reports (owner or admin).
- `listAllManuscripts()` (owner-only) → cross-user view with stale flag computed.

Package versioning: extend existing `submitCreatorPackage` to detect existing slug + owner and version instead of erroring; add `listMyPackages` returning latest + activity, and `updatePackage({ slug, ... })`.

### Routes (TanStack)
- `src/routes/_authenticated/ascend.manuscripts.index.tsx` — My Manuscripts list.
- `src/routes/_authenticated/ascend.manuscripts.$id.tsx` — detail + report viewer + resubmit form + history.
- `src/routes/_authenticated/ascend.manuscripts.new.tsx` — single-file submission form (title + file).
- `src/routes/_authenticated/ascend.admin.manuscripts.tsx` — owner-only tracking table.
- Update `src/routes/_authenticated/dashboard.tsx`: split "My Manuscripts" (new table from above) and "My Packages" (existing list, with new Update + History controls).
- Owner console gets a link to the new admin manuscripts view next to Submission Queue.

### Validation
Reuse existing `src/manuscript/validate.ts` + ingest pipeline. Wrap its result into the `report` jsonb shape: `{ errors: [...], warnings: [...], flags: [...], summary: {...} }`. No new validator logic.

### Out of scope (explicitly)
- No admin approval/reject for manuscripts.
- No notifications/email yet — stale flag is visual only.
- No package approval changes beyond the versioning + dashboard update.
