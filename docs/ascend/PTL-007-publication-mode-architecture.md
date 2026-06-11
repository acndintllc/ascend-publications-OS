# PTL-007 — PUBLICATION MODE ARCHITECTURE

**Status:** Phase 1D — architecture only
**Activation:** `<html data-mode="{mode}">` (single source of truth per PTL-004)
**Section override:** `data-mode-section="{mode}"` (hybrid resolution)

---

## 1. MODE INVENTORY

| Mode | Surface | Primary use | Render target |
|---|---|---|---|
| `web-reader` | Browser | Long-form article reading | HTML/CSS live |
| `cinematic` | Browser / large screen | Hero pieces, immersive features | HTML/CSS live |
| `operational` | Browser / PDF | Reports, dashboards, ops docs | HTML + PDF |
| `pdf` | Print / download | Print-ready manuscript | PDF render pipeline |
| `ebook` | Reflowable EPUB3 | Apple Books / Kobo / Play Books | EPUB3 |
| `kindle` | KF8 / KFX | Amazon Kindle | EPUB→KF8 build |

## 2. INHERITANCE STRATEGY

```
TIER 1 primitives  (universal, never overridden)
       ↓
TIER 2 semantic    (publication-agnostic defaults)
       ↓
TIER 3 mode overlay (re-points TIER 2 → different TIER 1 primitives)
       ↓
data-mode-section  (per-block override for hybrid documents)
```

- TIER 3 overlays NEVER introduce raw values — they only re-map TIER 2 tokens to different TIER 1 primitives.
- A mode overlay is a single CSS file scoped under `[data-mode="{mode}"]`.
- `data-mode-section` enables Operational/Cinematic Hybrid on a per-section basis (PTL-004 R7 mitigation).

## 3. SHARED TOKEN BEHAVIOR

Tokens that MUST resolve identically across every mode (protect cross-format continuity):

- `--am-body-measure` (reading line length)
- `--am-silence-*` (pacing infrastructure)
- `--am-chapter-rhythm`
- `--am-body-leading`
- Citation, footnote, endnote structural sizes (legal/scholarly fidelity)

Tokens that CAN diverge per mode:

- All color tokens (Kindle → greyscale, Cinematic → high-contrast)
- Display family axis bindings (`opsz`, `SOFT`, `WONK`)
- Chapter-opener layout
- Pull-quote scale

## 4. MODE-SPECIFIC OVERRIDES (sketch)

### 4.1 web-reader
- Default mode. TIER 2 values pass through unchanged.
- Adds `prefers-color-scheme: dark` ink ramp inversion.

### 4.2 cinematic
- Display ramp shifts up one step (chapter-opener → `--am-type-1000`).
- Background → `--am-color-ink-950`, ink → `--am-color-ink-50`.
- Motion durations promoted to `--am-duration-cinematic` family.
- `font-variation-settings` binds `opsz` to `--am-opsz-display`.

### 4.3 operational
- Body family swaps to `--am-font-ui` (Inter Tight) for scan-density.
- Pull-quote and chapter-opener suppressed.
- Report-block tokens elevated; accent collapses to `--am-color-cool-*`.

### 4.4 pdf
- Color tokens convert OKLCH → CMYK via build-time lookup (R-PDF-2).
- Variable font axes flatten to static weight ladder (R-PDF-1).
- Page-break tokens activated: `--am-chapter-rhythm` becomes `page-break-before: always`.

### 4.5 ebook
- Measure tokens drop (reader controls reflow).
- Spacing primitives shift to `em` from `rem` for reader font-size scaling.
- Variable fonts retained (modern EPUB3 readers).

### 4.6 kindle
- Build-time CSS variable flattening (KF8 strips custom properties).
- Variable fonts → static masters (Fraunces 400/700, Source Serif 4 400/700).
- All color tokens map to ink ramp by L* (e-ink greyscale).
- Footnote tokens auto-promote to popup markup.

## 5. HYBRID MODE RESOLUTION

```html
<html data-mode="operational">
  <section data-mode-section="cinematic">
    <!-- Cinematic overlay applies inside this section only -->
  </section>
</html>
```

Cascade ensures per-section overlay wins over root mode. No JS required; pure CSS scope.

## 6. NEXT EXECUTABLE PHASE

After TIER 2 implementation:
1. Implement `web-reader` overlay (pass-through, smallest risk).
2. Implement `cinematic` overlay (visual identity proof).
3. Implement `pdf` overlay paired with build-time flattening utility.
4. EPUB / Kindle modes deferred until manuscript pipeline lands (PTL-008).
