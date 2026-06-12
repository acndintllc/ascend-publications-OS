## PTL-017 — PHASE 6A: MANUSCRIPT AUTHORING POLISH

**Status:** Implemented. Independent of any external runner.
**Spec:** PTL-008 §3 (normalize/validate), §4 (enrich).

### 1. Files

| File | Role |
|---|---|
| `src/manuscript/validate.ts` | Pure validator: frontmatter, citations, VERA anchors, chapter rhythm |
| `src/manuscript/library.ts` | Now retains parse failures + attaches validation report per entry |
| `src/routes/ascend.library.tsx` | Surfaces issue chip + Validate link + Failed-to-parse section |
| `src/routes/ascend.validate.$slug.tsx` | `/ascend/validate/$slug` — full report view |

### 2. Validator output

```ts
ValidationReport {
  issues: { severity, code, message }[]
  unresolvedCitations: string[]
  orphanVeraAnchors: number[]
  rhythm: ChapterRhythm[]    // per-chapter words/¶/sections/dialogue/pull
}
```

Issue codes:
- `FM001` — frontmatter has no author (error)
- `FM002` — title > 120 chars (warning)
- `CIT001` — unresolved `[@key]` (warning)
- `CIT002` — bib entry unused (info)
- `VERA001` — anchor index past last body block (warning)
- `STR001` — no `:::chapter-opener` directive (warning)

### 3. Failure retention

Previously, a manuscript that failed Zod validation in `parseManuscript`
silently dropped from the index. The library loader now wraps each
parse in try/catch, pushes failures into `state.failures`, and exposes
them via `listFailures()`. The library route renders a "Failed to
parse" section with slug + error message — authors see why a manuscript
is missing rather than guessing.

### 4. Chapter rhythm

`chapterRhythm()` walks the ACA, splitting at each `chapter-opener`.
For each chapter it tallies words, paragraphs, sections, dialogue
turns, and pullquotes — the per-chapter view authors need to judge
pacing without leaving the app.

### 5. Routes touched

- `/ascend/library` — now shows clean/issue chip and a Validate link
  per entry, plus a Failed-to-parse footer when present.
- `/ascend/validate/$slug` — new. Issue table + chapter rhythm table.

### 6. Next executable phase

**Phase 7A — external build-runner.** The remaining deferred work
(PDF Path B, KFX) shares the same runner contract documented in
PTL-014 §5 and PTL-016 §4. Building the runner unblocks both at
once. Until then, every publication mode has at least a shippable
in-Worker path.

Alternative: **Phase 6B — DOCX ingest** (PTL-008 §2 second input
path), Worker-safe via pure-JS mammoth fork or xml-js. Independent
of the runner.
