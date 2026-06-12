## PTL-014 — PHASE 4A: PDF RENDER PATH

**Status:** Implemented (browser-print path). Out-of-Worker headless
render job: stubbed in spec only.
**Spec:** PTL-008 §5 (PDF column), §8 (runtime constraints).

### 1. Two-path PDF strategy

PTL-008 §8 forbids headless Chromium in the Cloudflare Worker. PDF
emission therefore splits along two paths:

| Path | Where it runs | Status |
|---|---|---|
| **A. Browser print** | Reader client (`window.print()`) | Implemented this phase |
| **B. Build-runner render** | External non-Worker job (signed-URL artifact) | Stubbed; future phase |

Path A unblocks authors immediately. Path B is the production
emission for archival / KDP-grade PDFs (per PTL-007 §4.4 R-PDF-1/2:
static weight ladder + CMYK flattening).

### 2. Files

| File | Role |
|---|---|
| `src/styles/modes/pdf.css` | TIER-3 overlay + screen page-sheet preview + `@media print` chrome stripper |
| `src/routes/ascend.reader.$slug.tsx` | `?mode=pdf` deep link, Print/Save PDF button, `am-print-root` toggle |

### 3. Print pipeline

1. Reader route reads `?mode=pdf` (validated via Zod search schema).
2. PDF mode shows a **Print / Save PDF** action.
3. On click, `am-print-root` class is added to `<html>`, then
   `window.print()` fires.
4. `@media print` in `pdf.css` hides everything except the
   `[data-am="chapter"]` subtree, applies `@page Letter; margin: 0.75in`,
   and enforces page breaks at chapter openers and avoid-breaks on
   pullquotes / sidebars / callouts.
5. `afterprint` event removes `am-print-root`; reader returns to
   screen preview.

### 4. Screen preview

`@media screen [data-mode="pdf"]` renders the chapter as a stack of
8.5in paper sheets with drop shadow on `--am-color-ink-100`, so
authors can roughly preview the printed result before invoking the
browser print dialog.

### 5. Out-of-Worker job stub (Path B — future)

The production PDF render belongs in a build runner outside the
Worker (Node container or GitHub Actions job). Contract sketch:

```
POST /api/render/pdf { slug }
   → enqueue job { slug, aca, mode: "pdf" }
   → runner: headless Chromium prints /ascend/reader/<slug>?mode=pdf
   → flatten OKLCH → CMYK (R-PDF-2)
   → subset WOFF2 → embed (R-PDF-1)
   → upload artifact → return signed URL
```

Not implemented in this phase. Worker-side runtime checks (`@server-runtime`)
forbid `child_process` / `puppeteer` / native binaries, so the runner
must be external.

### 6. Next executable phase

**Phase 5A — EPUB3 packager** (PTL-008 §5 EPUB column). Pure-JS
(Worker-safe) OEBPS zip emitter: ACA → XHTML + flattened TIER-2 CSS
+ OPF/NCX + WOFF2. Can run inside a TanStack server function (no
native dependencies). Phase 5B Kindle reuses the EPUB3 output and
runs through KindleGen in the same external runner as Path B PDF.
