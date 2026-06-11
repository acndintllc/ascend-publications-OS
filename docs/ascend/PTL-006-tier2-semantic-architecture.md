# PTL-006 — TIER 2 SEMANTIC PUBLISHING TOKEN ARCHITECTURE

**Status:** Phase 1C — architecture plan, no implementation
**Parent:** PTL-004 three-tier model
**Cap:** ≤60 TIER 2 tokens (per R1 mitigation)

---

## 1. PRINCIPLES

- Components bind ONLY to TIER 2 tokens. Never to TIER 1 primitives directly.
- TIER 2 is publication-agnostic. Mode-specific values live in TIER 3 overlay.
- Naming: `--am-{publishing-role}-{property}` (e.g. `--am-chapter-title-size`).
- Every TIER 2 token resolves to a TIER 1 primitive via `var()` — no raw values.

## 2. PUBLISHING-ROLE TOKEN GROUPS

Each group below is one semantic publishing role with the minimum properties needed to bind to a component. Total token count budget reserved: **57 tokens**.

### 2.1 Chapter (root section)
```
--am-chapter-bg          → var(--am-color-ink-0)
--am-chapter-ink         → var(--am-color-ink-900)
--am-chapter-measure     → var(--am-measure-prose)
--am-chapter-rhythm      → var(--am-silence-chapter)
```

### 2.2 Chapter Opener (first-page treatment)
```
--am-chapter-opener-display-family → var(--am-font-display)
--am-chapter-opener-display-size   → var(--am-type-900)
--am-chapter-opener-display-leading → var(--am-leading-tight)
--am-chapter-opener-display-tracking → var(--am-tracking-tight)
--am-chapter-opener-rule-color     → var(--am-color-accent-500)
```

### 2.3 Section (mid-level heading)
```
--am-section-title-family  → var(--am-font-display)
--am-section-title-size    → var(--am-type-600)
--am-section-title-weight  → var(--am-weight-semibold)
--am-section-silence       → var(--am-silence-lg)
```

### 2.4 Body
```
--am-body-family   → var(--am-font-body)
--am-body-size     → var(--am-type-300)
--am-body-leading  → var(--am-leading-prose)
--am-body-measure  → var(--am-measure-prose)
--am-body-ink      → var(--am-color-ink-800)
```

### 2.5 Dialogue
```
--am-dialogue-indent  → var(--am-space-6)
--am-dialogue-leading → var(--am-leading-relaxed)
--am-dialogue-ink     → var(--am-color-ink-900)
```

### 2.6 Pull Quote
```
--am-pullquote-family   → var(--am-font-display)
--am-pullquote-size     → var(--am-type-500)
--am-pullquote-leading  → var(--am-leading-snug)
--am-pullquote-accent   → var(--am-color-accent-600)
--am-pullquote-silence  → var(--am-silence-md)
```

### 2.7 Sidebar
```
--am-sidebar-bg      → var(--am-color-ink-50)
--am-sidebar-ink     → var(--am-color-ink-800)
--am-sidebar-radius  → var(--am-radius-md)
--am-sidebar-pad     → var(--am-space-6)
```

### 2.8 Footnote
```
--am-footnote-size    → var(--am-type-200)
--am-footnote-ink     → var(--am-color-ink-600)
--am-footnote-leading → var(--am-leading-normal)
```

### 2.9 Endnote
```
--am-endnote-size  → var(--am-type-200)
--am-endnote-rule  → var(--am-color-ink-300)
```

### 2.10 Source Note
```
--am-sourcenote-size   → var(--am-type-100)
--am-sourcenote-track  → var(--am-tracking-wide)
--am-sourcenote-ink    → var(--am-color-ink-500)
```

### 2.11 Citation Block
```
--am-citation-family → var(--am-font-mono)
--am-citation-size   → var(--am-type-200)
--am-citation-bg     → var(--am-color-cool-50)
```

### 2.12 VERA Note (verification/research overlay)
```
--am-vera-accent → var(--am-color-info-500)
--am-vera-bg     → var(--am-color-cool-50)
--am-vera-label  → var(--am-tracking-widest)
```

### 2.13 Research Note
```
--am-research-accent → var(--am-color-cool-500)
--am-research-bg     → var(--am-color-cool-50)
```

### 2.14 Callout
```
--am-callout-accent  → var(--am-color-accent-500)
--am-callout-bg      → var(--am-color-accent-50)
--am-callout-radius  → var(--am-radius-md)
```

### 2.15 Scene Break
```
--am-scenebreak-glyph-color → var(--am-color-ink-400)
--am-scenebreak-silence     → var(--am-silence-md)
```

### 2.16 Appendix
```
--am-appendix-bg   → var(--am-color-ink-50)
--am-appendix-ink  → var(--am-color-ink-800)
```

### 2.17 Glossary
```
--am-glossary-term-weight → var(--am-weight-semibold)
--am-glossary-def-ink     → var(--am-color-ink-700)
```

### 2.18 Report Block (Operational mode primary)
```
--am-report-family   → var(--am-font-ui)
--am-report-size     → var(--am-type-300)
--am-report-rule     → var(--am-color-ink-200)
--am-report-accent   → var(--am-color-cool-500)
```

**Total: 57 tokens — within 60-token cap.**

## 3. RESOLUTION ORDER

```
component className
   └─ binds → TIER 2 semantic token
        └─ resolves → TIER 1 primitive
             └─ overridable by → TIER 3 mode overlay
                   (data-mode | data-mode-section)
```

## 4. FILE LAYOUT (planned)

```
src/styles.css                  ← TIER 1 (current)
src/styles/tier2-semantic.css   ← TIER 2 (next phase)
src/styles/modes/
   web-reader.css               ← TIER 3 overlay
   cinematic.css
   operational.css
   pdf.css
   ebook.css
   kindle.css
```

All TIER 2 + TIER 3 files imported from `src/styles.css` after primitives, before Tailwind utilities, so utilities still win specificity ties.

## 5. NEXT-PHASE GATES

- WCAG AA contrast test gate runs against every TIER 2 ink-on-bg pair.
- Snapshot of resolved values per mode emitted at build to catch primitive drift.
- TIER 2 token additions beyond 60 require PTL amendment.
