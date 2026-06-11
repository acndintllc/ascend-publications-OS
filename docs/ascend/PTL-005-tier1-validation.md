# PTL-005 — TIER 1 PRIMITIVE VALIDATION

**Status:** Phase 1B complete
**Stack:** Editorial Authority (Fraunces / Source Serif 4 / Inter Tight)
**Delivery:** Self-hosted WOFF2 via Fontsource (npm-bundled, no third-party CDN)

---

## 1. FONT LOADING

| Family | Package | Format | Self-hosted | License |
|---|---|---|---|---|
| Fraunces (variable, wght + ital) | `@fontsource-variable/fraunces` | WOFF2 | ✅ bundled via Vite | SIL OFL 1.1 |
| Source Serif 4 (400/400i/600/700) | `@fontsource/source-serif-4` | WOFF2 | ✅ bundled via Vite | SIL OFL 1.1 |
| Inter Tight (variable) | `@fontsource-variable/inter-tight` | WOFF2 | ✅ bundled via Vite | SIL OFL 1.1 |

Imports live in `src/routes/__root.tsx`. Fontsource ships `@font-face` rules and the WOFF2 binaries; Vite emits hashed asset URLs at build time. No external network requests at runtime. R4 (licensing) closed.

## 2. VARIABLE FONT BEHAVIOR

- Fraunces ships `wght` (100–900) and an italic axis. `opsz`, `SOFT`, `WONK` axes are exposed by Fraunces upstream; the Fontsource `index.css` (loaded) carries the full variable instance.
- Tokens `--am-opsz-*`, `--am-soft-*`, `--am-wonk-*` reserve the axis vocabulary for TIER 2 semantic bindings via `font-variation-settings`.
- Inter Tight variable supplies a continuous `wght` axis; weight primitives `--am-weight-*` map 1:1.
- **Risk:** PDF pipelines that do not preserve variable-font instancing must subset to static masters before embedding (see §4).

## 3. ACCESSIBILITY COMPATIBILITY

- All color primitives expressed in OKLCH. Ink ramp ink-0 → ink-950 is monotonic in L*, enabling deterministic contrast computation.
- Pairings reserved for TIER 2 that will be gated on WCAG AA (4.5:1 body / 3:1 large):
  - ink-900 on ink-0 → ~17:1 ✅
  - ink-700 on ink-50 → ~9.8:1 ✅
  - accent-700 on ink-0 → ~6.4:1 ✅ body-eligible
  - accent-500 on ink-0 → ~3.4:1 ⚠️ display-only, not body
- Silence primitives (`--am-silence-*`) are non-collapsible margin reserves — protect screen-reader pause cadence and visual rhythm equally.
- Type scale anchored at 1rem (`--am-type-300`) honors user root-font preference.

## 4. PDF EMBEDDING COMPATIBILITY

- All three families ship TTF/OTF masters upstream — full embedding rights under SIL OFL.
- Static weights for Source Serif 4 (400/400i/600/700) are loaded explicitly to guarantee PDF-safe embeddable subsets.
- **Risk R-PDF-1:** Fraunces variable instancing must be flattened for legacy PDF/A-2 targets. PDF Mode (Phase 1D) will declare a static fallback weight ladder (300/400/600/700/900).
- **Risk R-PDF-2:** OKLCH colors must be converted to CMYK/sRGB at PDF render. Conversion table to live in PDF Mode overlay (TIER 3).

## 5. EPUB COMPATIBILITY

- EPUB3 supports WOFF2 + variable fonts in Readium and Apple Books. Older readers (ADE, Calibre <5) fall back to system serif via the stack's `Georgia, Times New Roman, serif` chain.
- Fontsource WOFF2 binaries are reusable inside `OEBPS/fonts/` for EPUB packaging — no separate licensing step.
- CSS custom properties are supported by EPUB3 readers built on WebKit/Blink (Apple Books, Kobo, Google Play Books). Kindle's KF8 path requires flattening (see §6).

## 6. KINDLE COMPATIBILITY

- KFX / KF8 strips most CSS custom properties and rejects variable fonts. Kindle Mode (Phase 1D) must:
  - Resolve TIER 1 primitives at build-time into static CSS values
  - Substitute Fraunces variable → static Fraunces 400 + Fraunces 700 masters
  - Drop `font-variation-settings`; rely on weight + italic only
- Color rendering is greyscale on e-ink — Kindle Mode overlay collapses accent/cool ramps to ink ramp equivalents by L*.

## 7. CROSS-BROWSER STABILITY

| Surface | Status |
|---|---|
| Chromium 111+ | ✅ OKLCH + variable fonts native |
| Firefox 113+ | ✅ OKLCH + variable fonts native |
| Safari 15.4+ | ✅ OKLCH + variable fonts native |
| Safari ≤15.3 | ⚠️ OKLCH unsupported — fallback layer required in TIER 3 |
| Legacy Edge / IE | ❌ not a target |

No browser-specific shims required for primary support matrix.

## 8. RISKS LOGGED

- **R-PDF-1** — Variable-font flattening required for PDF/A-2.
- **R-PDF-2** — OKLCH → CMYK/sRGB conversion table outstanding.
- **R-KINDLE-1** — Build-time primitive flattening required for KF8.
- **R-SAFARI-1** — OKLCH fallback layer for Safari ≤15.3 (low priority — declining share).
- **R-VARFONT-1** — `opsz`/`SOFT`/`WONK` axis bindings unverified end-to-end until TIER 2 semantic bindings exist.

**Phase 1B verdict:** TIER 1 primitives are production-stable for Web Reader Mode v1. PDF / Kindle modes require flattening layers documented in Phase 1D below. No blocking conflicts.
