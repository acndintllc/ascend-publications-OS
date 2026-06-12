# PTL-019 — Phase 7B: Author Live Preview

Drag-and-drop runtime preview for ASCEND manuscripts. Authors iterate
without redeploying; everything runs in the browser.

## Route

- `/ascend/live` — drop zone + file picker. Accepts:
  - `manuscript.md` / `.markdown` / `.txt` → `parseManuscript`
  - `manuscript.docx` → `parseDocx` (fflate, Worker-safe)
  - `citations.bib` → `parseBib`
  - `vera.json` → JSON sidecar

Multi-file drops are classified by extension; the manuscript file is
required, sidecars are optional.

## Pipeline parity

Bundled manuscripts and dropped manuscripts go through the same code
path. The shared pipeline lives in `src/manuscript/pipeline.ts`:

```
parse → resolveCitations → attachVera → computeReadingStats → validate
```

`src/manuscript/library.ts` (build-time) and `ascend.live.tsx`
(runtime) both call `ingestMarkdown` / `ingestDocx`. Adding a new
enrichment step in `pipeline.ts` automatically benefits the live route.

## UX

- Sticky nav mirrors the reader (← Library / Live Preview / source name / Clear).
- Validation issue count surfaces in the nav when present (full report
  remains at `/ascend/validate/$slug` for bundled manuscripts only).
- Errors render inline below the drop zone; the zone stays interactive.

## Privacy

Files never leave the browser — no fetch, no upload. The route can run
offline once loaded.

## Out of scope

- Persisting dropped manuscripts (deferred; would need Lovable Cloud).
- EPUB/PDF export from the live route (rendering parity is enough for
  Phase 7B; export buttons can be wired in a follow-up).
- Folder drops via the File System Access API.
