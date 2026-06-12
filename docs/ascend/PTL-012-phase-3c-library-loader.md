## PTL-012 — PHASE 3C: MANUSCRIPT DIRECTORY LOADER + LIBRARY INDEX

**Status:** Implemented.
**Spec:** PTL-008 §7 (file layout), extends PTL-011.

### 1. Files

| File | Role |
|---|---|
| `manuscripts/cartographers-confession/manuscript.md` | Specimen (default mode: web-reader) |
| `manuscripts/the-glass-archive/manuscript.md` | Specimen (default mode: cinematic) |
| `src/manuscript/library.ts` | Build-time bundler via `import.meta.glob` |
| `src/routes/ascend.library.tsx` | `/ascend/library` index route |
| `src/routes/ascend.reader.$slug.tsx` | Parametric reader, head() from frontmatter |

### 2. Removed

- `src/routes/ascend.reader.tsx` (replaced by parametric `$slug` route)
- `src/manuscript/samples/specimen.ts` (manuscripts now live on disk)

### 3. Loader Strategy

`import.meta.glob('/manuscripts/*/manuscript.md', { query: '?raw', eager: true })`
bundles every manuscript at build time. No runtime filesystem access — Worker
runtime compatible. Slug derived from directory name; manuscripts are parsed
once at module init and cached.

### 4. Route Wiring

- `/ascend/library` — sorted index, each entry links to `/ascend/reader/$slug` with `<Link params>`.
- `/ascend/reader/$slug` — `notFound()` on unknown slug, errorComponent on parse failure, head() derives title/description from frontmatter, initial mode pulled from frontmatter.
- `/ascend/proof` remains as the synthetic specimen route (Phase 3A) for design QA.

### 5. Architectural Note (non-blocking)

`import.meta.glob` is a Vite primitive; new manuscripts require a dev-server
restart on first add but no code change. DOCX ingest (PTL-008 §2.2) still
deferred — Markdown is the sole ingress path through Phase 3.

### 6. Next Executable Phase

**Phase 3D — enrich pass (PTL-008 §4).** Implement reading-stats (word count,
reading time), scene-break glyph injection metadata, and citation key
resolution against a `citations.bib` sidecar. Optionally land a VERA sidecar
loader (`vera.json`) to surface annotation chrome in the web-reader overlay.
Output-format conversion (Phase 4A PDF) still deferred per PTL-008 §9.
