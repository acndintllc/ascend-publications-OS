## PTL-016 — PHASE 5B: KINDLE PROFILE + EXTERNAL RUNNER CONTRACT

**Status:** Source EPUB (Kindle profile) implemented. KFX conversion
contract documented; runner is external.
**Spec:** PTL-008 §5 Kindle column, §8 runtime constraints.

### 1. Files

| File | Role |
|---|---|
| `src/manuscript/package/kindle-css.ts` | KF8-safe flattened stylesheet (no flex/grid/vars/hyphens) |
| `src/manuscript/package/epub-zip.ts` | Now takes a `profile: "epub3" \| "kindle"` |
| `src/routes/api/public/render.kindle.ts` | Public stub endpoint documenting the runner contract |

### 2. Why a separate Kindle profile

Kindle (KF8) ignores or breaks on several modern CSS features that
work fine in EPUB3 reflowable: CSS custom properties, flexbox, grid,
`hyphens`. Shipping a single stylesheet to both would silently degrade
on Kindle. The Kindle profile flattens to KF8-safe properties only,
adds the legacy `page-break-*` hints KindleGen honors, and uses a
Bookerly-first font stack.

### 3. OPF profile marker

The Kindle build emits `<meta name="ascend:profile" content="kindle" />`
in the package metadata. The external runner uses this marker to
select KindleGen vs straight EPUB pass-through.

### 4. External runner — why and where

Per PTL-008 §8 and `@server-runtime`: KindleGen / kfxlib are native
binaries; `child_process` is stubbed in the Worker; sharp/puppeteer/
KindleGen all fail at runtime. The KFX emission therefore lives in
an external runner (Node container / Fly machine / GitHub Action).

The endpoint `/api/public/render/kindle` exists in this Worker to:
- Document the public contract (`GET` returns the schema)
- Reject unimplemented `POST` with `501` + the contract payload
- Provide a stable URL the runner deploys behind (swap-in later)

`/api/public/*` per `@public-api-endpoints` bypasses user auth; the
runner authenticates via `x-ascend-signature` HMAC over the raw body
using `ASCEND_RUNNER_SECRET`. Wiring the secret is deferred until the
runner exists (no point storing an unused secret).

### 5. Reader integration

`/ascend/reader/$slug` in `kindle` mode now downloads the Kindle-
profile EPUB (`<slug>.kindle.epub`) instead of the generic EPUB3.
Users can sideload via Send-to-Kindle today; once the runner exists,
the button will swap to "Generate KFX" + artifact-URL polling.

### 6. Pipeline state

```
ACA ──┬─→ HTML Reader   ✅ Phase 3B+3C
      ├─→ PDF (browser) ✅ Phase 4A Path A
      ├─→ PDF (KDP)     ⏸ Phase 4A Path B (external runner)
      ├─→ EPUB3         ✅ Phase 5A
      ├─→ Kindle EPUB   ✅ Phase 5B (this phase)
      └─→ KFX           ⏸ Phase 5B runner (external)
```

### 7. Next executable phase

**Phase 6A — manuscript authoring polish.** Independent of any
external runner. Scope:
- Surface frontmatter validation errors in `/ascend/library` (today
  a malformed manuscript silently disappears from the index).
- Add `/ascend/validate/$slug` route showing the ACA parse tree,
  enrichment status, unresolved citation keys, orphan VERA anchors.
- Add a CLI-style word-count / chapter-rhythm report.

Phase 7A — external build-runner — is the next runner-blocked phase
and would unblock both PDF Path B and KFX in one deploy.
