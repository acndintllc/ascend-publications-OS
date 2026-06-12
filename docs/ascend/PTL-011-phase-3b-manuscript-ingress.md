## PTL-011 — PHASE 3B: MANUSCRIPT PIPELINE INGRESS

**Status:** Implemented — Markdown → ACA → component renderer live.
**Spec:** PTL-008 §1–§5 (web-reader render path only).

### 1. Files

| File | Role |
|---|---|
| `src/manuscript/schema/aca.ts` | ACA types + Zod frontmatter schema |
| `src/manuscript/ingest/markdown.ts` | GFM superset + ASCEND directives → ACA |
| `src/manuscript/render/aca-renderer.tsx` | ACA → TIER-2 components |
| `src/manuscript/samples/specimen.ts` | In-source canonical specimen |
| `src/routes/ascend.reader.tsx` | `/ascend/reader` proof route w/ mode switcher |

### 2. ACA Block Coverage

`chapter-opener`, `section`, `body`, `dialogue`, `pullquote`, `sidebar`,
`callout`, `citation`, `report`, `scene-break`, `footnote`. Inline:
`text`, `emphasis`, `strong`, `code`, `link`, `footnote-ref`.

### 3. ASCEND Markdown Directives

```
:::chapter-opener eyebrow="..."
# Title
:::

:::section title="..."
...
:::

:::dialogue speaker="..."
line
:::

:::pullquote cite="..."
text
:::

:::sidebar title="..."
body
:::

:::callout
body
:::

:::citation
raw
:::

:::report
body
:::

---scene---
```

### 4. End-to-End Cascade (validated)

`Markdown source` → `parseManuscript()` → `ACADocument` →
`RenderManuscript` → TIER-2-bound components → TIER 2 tokens →
TIER 3 `[data-mode]` overlay → TIER 1 primitives.

### 5. Deferred (per PTL-008 §9)

- DOCX ingest (§2.2) — not yet wired.
- Enrich pass (§4): VERA sidecars, bib resolution, reading stats.
- Render paths beyond web-reader: PDF, EPUB, Kindle packagers (§5–§6).
- Manuscript directory loader (`manuscripts/{slug}/manuscript.md` build
  step) — specimen is in-source pending server-side fs ingest.

### 6. Next Executable Phase

**Phase 3C — manuscript directory loader + multi-document index.**
Move the specimen to `manuscripts/cartographers-confession/manuscript.md`,
add a server function that lists/loads manuscripts, render an index at
`/ascend/library`, and parametrize `/ascend/reader/$slug`. Still no
output-format conversion; that begins at Phase 4A (PDF) per PTL-008 §9.
