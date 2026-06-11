# PTL-008 — MANUSCRIPT PIPELINE ARCHITECTURE

**Status:** Phase 1E — structure only, no conversion logic
**Inputs:** Markdown, DOCX
**Outputs:** EPUB3, Kindle EPUB (KF8 source), PDF, HTML Reader

---

## 1. PIPELINE STAGES

```
┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────┐
│  INGEST  │ → │  NORMAL  │ → │  ENRICH /    │ → │  RENDER  │ → │  PACKAGE │
│ (md/docx)│   │  (AST)   │   │  ANNOTATE    │   │ (per     │   │  (zip,   │
│          │   │          │   │  (VERA/refs) │   │  mode)   │   │  pdf, …) │
└──────────┘   └──────────┘   └──────────────┘   └──────────┘   └──────────┘
```

## 2. INGEST

- **Markdown:** GFM superset + ASCEND extensions (callouts, scene breaks, VERA notes, source notes).
- **DOCX:** parsed via Mammoth-style extractor → mapped to canonical AST. Styles named with ASCEND prefix (`AM-Chapter`, `AM-PullQuote`, …) drive semantic mapping.
- Output of stage: canonical ASCEND AST (see §4).

## 3. NORMALIZE

- Convert any input AST to **ASCEND Canonical AST (ACA)**.
- Resolve heading hierarchy, footnote numbering, citation refs.
- Validate against ASCEND schema; reject manuscripts missing required frontmatter (title, slug, mode, authors).

## 4. ENRICH / ANNOTATE

- Attach VERA notes from sidecar JSON.
- Resolve citation keys → bibliography entries.
- Inject scene-break glyphs.
- Compute reading time, word count, chapter rhythm metadata.

## 5. RENDER

Per publication mode (PTL-007), the ACA is rendered through a mode-specific renderer that emits tokenized HTML/CSS:

```
ACA ──┬─→ html-reader renderer  → HTML + TIER 1/2 CSS
      ├─→ cinematic renderer    → HTML + TIER 1/2/3 cinematic overlay
      ├─→ pdf renderer          → HTML (PDF mode) → headless render → PDF
      ├─→ epub renderer         → XHTML + flattened CSS + OPF/NCX → EPUB3
      └─→ kindle renderer       → EPUB3 (kindle profile) → KindleGen/KFX
```

All renderers consume the SAME TIER 2 token vocabulary; only the TIER 3 overlay differs.

## 6. PACKAGE

| Target | Packager | Notes |
|---|---|---|
| HTML Reader | TanStack route emit | Live web reader at `/reader/{slug}` |
| PDF | Headless Chromium / pdf-lib hybrid | Embeds subset WOFF2 + CMYK |
| EPUB3 | epub-gen-memory style | OEBPS zip with WOFF2 in `/fonts/` |
| Kindle | Source EPUB → KindleGen | Build-time CSS variable flattening |

## 7. FILE LAYOUT (planned, not implemented)

```
src/manuscript/
   schema/        ← ACA Zod schema + frontmatter validators
   ingest/
      markdown.ts
      docx.ts
   normalize/
      to-aca.ts
   enrich/
      vera.ts
      citations.ts
      reading-stats.ts
   render/
      html-reader.tsx
      cinematic.tsx
      pdf.ts
      epub.ts
      kindle.ts
   package/
      epub-zip.ts
      pdf-emit.ts
manuscripts/
   {slug}/
      manuscript.md
      frontmatter.json
      vera.json
      citations.bib
```

## 8. RUNTIME CONSTRAINTS

- All conversion logic must run server-side (TanStack server functions or build step).
- Cloudflare Workers runtime forbids `child_process` — KindleGen step must run in a separate non-Worker job (build runner) and surface artifacts via signed URL.
- PDF render via headless Chromium MUST NOT live in the Worker — same constraint.

## 9. NEXT EXECUTABLE PHASE (recommended)

**Phase 2A — TIER 2 semantic implementation** (per PTL-006). Highest leverage:
- Unblocks first component bindings.
- Enables web-reader overlay (PTL-007 §4.1) — first visible publication surface.
- Manuscript pipeline (PTL-008) deferred until at least one mode renders against TIER 2.

Subsequent phases in order: 2B web-reader overlay → 2C cinematic overlay → 3A manuscript ingest (Markdown only) → 3B HTML Reader render → 4A PDF overlay + render → 5A EPUB → 5B Kindle.
