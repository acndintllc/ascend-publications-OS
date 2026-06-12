# PTL-020 — PHASE 8 PUBLICATION OPERATIONS LAYER

**Status:** Implemented (architecture-first; visual polish deferred)
**Scope:** Phase 8A–8F
**Surface:** `/ascend/publications`

---

## 1. SUBSYSTEMS

| Phase | Module | Responsibility |
|---|---|---|
| 8A | `src/publication/status.ts` | Lifecycle vocabulary + transition matrix (`draft → editing → review → formatting → ready → published → archived`). `PublicationRecord` tracks title/subtitle/series/volume/status/version/profile/lastUpdated/author. |
| 8B | `src/publication/metadata.ts` | Zod-validated `PublicationMetadata` + storefront adapters (`kdp`, `apple-books`, `kobo`, `draft2digital`, `google-play-books`). |
| 8C | `src/publication/profiles.ts` | Reusable behavior bundles for Novel / Research / Documentary / Educational / Children's lines. Defines typography, chapter rhythm, citation style, callouts, VERA behavior, and allowed export targets. |
| 8D | `src/publication/vera-blocks.ts` | VERA block registry: Note / Explain / Insight / Question / Research Prompt / Learning Prompt / Language Bridge. Per-block surface allow-list + source/interactive flags. |
| 8E | `src/publication/export.ts` | `planExports()` — wraps EPUB/Kindle/PDF/HTML-reader emitters with status, profile, and validation gates. Returns ready/blocked verdict per target without re-running conversion. |
| 8F | `src/publication/registry.ts` + `manuscripts/research-over-emotion/` | In-memory ops registry seeded from the manuscript library; `Research Over Emotion` added as end-to-end validation target. |

## 2. METADATA FRAMEWORK

`PublicationMetadata` is the single source of truth. Storefront-specific
emit is delegated to adapters that report `error` / `warning` issues:

- **KDP** — flags missing description/keywords/categories; warns when >7 keywords.
- **Apple Books / Google Play** — require ISBN (warning until assigned).
- **Kobo / Draft2Digital** — minimal: title + author + description + categories + language.

ISBN is intentionally a placeholder string — assignment happens out-of-band.

## 3. PUBLICATION PROFILES

```
novel        Ghost Series · DON Protocol · Realignment Cycle      cinematic, no citations, all targets
research     Research Over Emotion · Signal Economy · AI Reports   scholarly cites, digital PDF, no Kindle by default
documentary  History vs The Story · Documentary Scripts            endnote cites, PDF + HTML reader only
educational  AI Rulebook · Educational Guides                      footnote cites, all targets, VERA-EDU voice
childrens    VERA Encyclopedia · Bilingual Bridge                  intimate scale, drop-cap, language-bridge enabled
```

Each profile constrains `allowedStatuses` and `export.targets`, so the export
planner refuses combinations that violate the line's editorial rules.

## 4. VERA BLOCK ARCHITECTURE

Blocks are *descriptors*, not renderers. They piggy-back on the existing ACA
`VeraNote` annotation (`src/manuscript/schema/aca.ts`) so manuscripts already
in the pipeline immediately gain semantic VERA support once a renderer maps
`kind` → component. Each spec carries `surfaces`, `requiresSource`, and
`interactive` flags so publishing UIs can filter blocks per profile family.

## 5. EXPORT PREPARATION

`planExports(record, enriched)` returns one `ExportCheck` per target with
blockers (illegal status, profile mismatch, validation errors) and warnings
(profile/format mismatch, validation warnings). No conversion runs here;
`src/manuscript/package/epub-zip.ts` and `src/routes/api/public/render.kindle.ts`
remain the emit points. Gate first, emit second.

## 6. VALIDATION RESULTS — *Research Over Emotion*

- **Ingestion:** parses via existing markdown pipeline; frontmatter, citations.bib, and chapter directives all valid.
- **Metadata:** registry seeds title/subtitle/author; description currently mirrors subtitle (publisher action: enrich description + keywords before KDP submit).
- **Profile:** inferred as `research` (regex on slug); allowed targets `epub | pdf | html-reader`. Kindle correctly excluded by profile.
- **VERA blocks:** profile permits `vera-note`, `vera-insight`, `vera-research-prompt`, `vera-question`. Manuscript ships with none yet — opportunity, not blocker.
- **Export readiness:** blocked on status `draft` (must reach `formatting` to export). Once promoted, all three permitted targets pass.
- **Validation report:** 0 errors, 0 warnings on the seeded manuscript.

## 7. FILES CHANGED

Created:
- `src/publication/status.ts`
- `src/publication/metadata.ts`
- `src/publication/profiles.ts`
- `src/publication/vera-blocks.ts`
- `src/publication/export.ts`
- `src/publication/registry.ts`
- `src/publication/index.ts`
- `src/routes/ascend.publications.tsx`
- `manuscripts/research-over-emotion/manuscript.md`
- `manuscripts/research-over-emotion/citations.bib`
- `docs/ascend/PTL-020-phase-8-publication-ops.md`

## 8. RECOMMENDED PHASE 9 ROADMAP

1. **9A — Persistence:** move registry from in-memory `Map` to Lovable Cloud (status history + metadata revisions per slug).
2. **9B — Authoring UI:** form-driven status transitions + metadata editing on `/ascend/publications/$slug`.
3. **9C — VERA renderer integration:** map `VeraBlockKind` → React components in `src/manuscript/render/aca-renderer.tsx`, so docs/educational/children's profiles render the right block surface.
4. **9D — Storefront emit:** ONIX 3.0 / KDP metadata XML serializers behind the existing adapter shapes.
5. **9E — Asset pipeline:** cover image + interior asset management tied to `PublicationRecord`.
6. **9F — Workflow events:** transition hooks (status change → notify, generate snapshot, archive prior version).
