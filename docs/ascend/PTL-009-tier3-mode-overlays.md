# PTL-009 — PHASE 2B: TIER 3 PUBLICATION MODE OVERLAYS

**Status:** Implemented
**Spec:** PTL-007
**Activation:** `<html data-mode="{mode}">` + per-section `data-mode-section="{mode}"`

## 1. FILES CREATED

| File | Mode | Role |
|---|---|---|
| `src/styles/modes/web-reader.css` | `web-reader` | Default; pass-through + dark-scheme ink inversion |
| `src/styles/modes/cinematic.css` | `cinematic` | Hero canvas, +1 display ramp, dark surface, accent promotion |
| `src/styles/modes/operational.css` | `operational` | Inter Tight body, scan-density, cool accent, narrative chrome suppressed |
| `src/styles/modes/pdf.css` | `pdf` | Print surface + `@media print` page-break bindings |
| `src/styles/modes/ebook.css` | `ebook` | Reflowable EPUB3; measure dropped, spacing → `em` |
| `src/styles/modes/kindle.css` | `kindle` | E-ink greyscale collapse, reflowable, conservative ramp |
| `src/styles/modes/index.css` | — | Aggregator |

`src/styles.css` imports `./styles/modes/index.css` after TIER 2.

## 2. INVARIANT VERIFICATION (PTL-007 §3)

Shared tokens that MUST resolve identically across modes — verified untouched in every overlay:

- `--am-body-measure` — only overridden in `ebook` / `kindle` (reflowable targets where reader controls measure; explicit exception in spec §4.5/§4.6).
- `--am-silence-*` — TIER 1 primitives never overridden (only `--am-chapter-rhythm` / `--am-*-silence` TIER 2 tokens shift in reflowable modes, per spec).
- `--am-body-leading` — only `operational` shifts (`relaxed`, scan-density requirement §4.3); narrative modes hold the prose default.
- Citation / footnote / endnote structural sizes — TIER 2 tokens `--am-footnote-size`, `--am-endnote-size`, `--am-sourcenote-size`, `--am-citation-size` untouched in every overlay. Legal/scholarly fidelity preserved.

## 3. CASCADE RULES

- Every overlay re-maps TIER 2 → TIER 1 only. No raw values introduced. (Grep: zero `rem`/`oklch`/hex outside of `em` spacing in reflowable modes, which is explicitly mandated by §4.5.)
- Selectors use `[data-mode="X"], [data-mode-section="X"]` so per-section hybrid resolution (PTL-007 §5) works by attribute cascade — no JS, no import-order dependency.
- TIER 2 cap (60) and TIER 1 namespace remain untouched.

## 4. NOT YET IMPLEMENTED (deferred per PTL-007 §6)

- Component bindings (no component reads TIER 2 yet — Phase 3).
- Build-time OKLCH→CMYK flatten utility (R-PDF-2).
- Build-time variable-font → static master flatten (R-PDF-1, Kindle KF8 strip).
- EPUB/Kindle render pipelines (depend on PTL-008 manuscript pipeline).
- `font-variation-settings` axis binding in `cinematic` overlay — pending component layer (axes are declarative properties, not custom-property substitutions).

## 5. NEXT EXECUTABLE PHASE

**Phase 3A — Component primitives.** Build the first TIER-2-bound components:

1. `<Chapter>` / `<ChapterOpener>` — binds `--am-chapter-*` + `--am-chapter-opener-*`.
2. `<Body>` / `<Section>` — binds `--am-body-*` + `--am-section-*`.
3. `<PullQuote>` / `<Callout>` / `<Sidebar>` — first narrative chrome.
4. Demo route `/ascend/proof` rendering the same MDX across all six `data-mode` values to validate overlay cascade end-to-end.

This is the first phase that produces visible output.
