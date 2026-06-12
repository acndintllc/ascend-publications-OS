## PTL-013 — PHASE 3D: ENRICH PASS

**Status:** Implemented.
**Spec:** PTL-008 §4.

### 1. Files

| File | Role |
|---|---|
| `src/manuscript/enrich/reading-stats.ts` | Word count / reading time / paragraphs |
| `src/manuscript/enrich/citations.ts` | BibTeX-lite parser + `[@key]` inline resolver |
| `src/manuscript/enrich/vera.ts` | VERA sidecar attach (anchored to body block index) |
| `manuscripts/cartographers-confession/citations.bib` | Specimen bibliography |
| `manuscripts/cartographers-confession/vera.json` | Specimen annotations |

### 2. Schema Extensions (`schema/aca.ts`)

- New inline node: `citation-ref { key, resolved? }`
- `body` block gains optional `vera` annotation
- New `ACAEnrichment { stats, bibliography, vera }` attached to `ACADocument`

### 3. Pipeline Wiring

`library.ts` chains: `parseManuscript` → `parseBib` → `resolveCitations` →
`attachVera` → `computeReadingStats` → `ACADocument.enrichment`. Sidecars
discovered via `import.meta.glob('/manuscripts/*/{citations.bib,vera.json}')`.

### 4. Render Surface

- `aca-renderer.tsx` renders `citation-ref` as superscript `[Author Year]`
  links to `#bib-<key>`; bibliography section auto-emitted when used.
- `body.vera` renders as an inline VERA-Note card bound to TIER-2
  `--am-vera-*` tokens.
- Reader route header shows `<words> · ~<minutes> min` from stats.

### 5. Markdown Authoring Addition

```
A claim drawn from the survey [@halliday1924] and corroborated later [@marsh1931].
```

### 6. Architectural Note (non-blocking)

VERA anchoring is currently positional (`anchor: <body block index>`).
Robust anchoring (slug + stable hash, or inline `{#id}` syntax) is logged
for a future phase — acceptable for ingress.

### 7. Next Executable Phase

**Phase 4A — PDF render path (PTL-008 §5 PDF column).** Implement the PDF
overlay's render: ACA → flattened HTML with embedded TIER-2 tokens →
headless render. Per PTL-008 §8, headless Chromium cannot run in the
Worker; this phase scaffolds the renderer + emits a printable
`/ascend/reader/$slug?mode=pdf` route relying on browser print, with the
out-of-Worker job stub documented for a build-runner phase.
