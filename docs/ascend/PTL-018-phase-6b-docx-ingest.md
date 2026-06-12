## PTL-018 — PHASE 6B: DOCX INGEST

**Status:** Implemented. Worker-safe.
**Spec:** PTL-008 §2 (DOCX input path).

### 1. Files

| File | Role |
|---|---|
| `src/manuscript/ingest/docx.ts` | Pure-JS DOCX → ACA parser (fflate + regex) |
| `src/manuscript/library.ts` | Discovers `manuscript.docx` alongside `manuscript.md`, prefers `.md` on conflict |

### 2. Why pure-JS / no LibreOffice / no pandoc / no mammoth

PTL-008 §8 and `@server-runtime` forbid native binaries, `child_process`,
and packages with binding.gyp / .node files in the Cloudflare Worker.
The `skill/docx` toolkit (LibreOffice, pandoc, python scripts) is
correct for desktop / build-runner use but cannot ship in the Worker
bundle. mammoth.js is JS-only but pulls a DOM dependency chain that
inflates the bundle and breaks on edge runtimes.

DOCX is, structurally, a zip of XML. The ingest path uses:
- **fflate** (already in deps for EPUB) for the unzip
- **scoped regex** over `word/document.xml` for paragraph + style extraction
- **no DOMParser, no XML-DOM**

The trade-off: regex extraction can't handle every Word edge case
(complex fields, smart-art, equations). ASCEND authors use a
controlled style vocabulary, so this is acceptable. Anything outside
the vocabulary folds into a `body` block.

### 3. Authoring contract (ASCEND DOCX style guide)

Authors assign these paragraph styles in Word/Pages/LibreOffice; the
ingest maps style → ACA block kind.

| Word style | ACA block |
|---|---|
| `AM-Eyebrow` | folded into the next chapter-opener |
| `AM-ChapterTitle` | `chapter-opener` |
| `AM-SectionTitle` | `section` (title only) |
| `AM-PullQuote` | `pullquote` (cite split on " — ") |
| `AM-Dialogue` | `dialogue` ("Speaker: line" → speaker + body) |
| `AM-Sidebar` | `sidebar` (consecutive paras group) |
| `AM-Callout` | `callout` (consecutive paras group) |
| `AM-Citation` | `citation` |
| `AM-Report` | `report` (consecutive paras group) |
| `AM-SceneBreak` | `scene-break` (text ignored) |
| Normal / anything else | `body` |

### 4. Frontmatter sources

Two paths, in priority order (later overrides earlier):
1. `docProps/custom.xml` ASCEND properties (`ASCEND:title`,
   `ASCEND:slug`, `ASCEND:mode`, `ASCEND:authors`, `ASCEND:eyebrow`,
   `ASCEND:subtitle`) — set via Word's File → Info → Properties or
   `Wd.CustomDocumentProperties`.
2. A leading `---frontmatter---` paragraph block followed by
   `key: value` lines, closed by `---`.

Falls back to sensible defaults: title = "Untitled DOCX", mode =
`web-reader`, authors = ["Unknown"]. Frontmatter is validated through
the same Zod schema as Markdown ingest.

### 5. Library wiring

`library.ts` now globs `/manuscripts/*/manuscript.docx` with
`?arraybuffer` and adds DOCX sources to the same ingest pipeline.
If both `manuscript.md` and `manuscript.docx` exist for one slug, the
Markdown wins (explicit authoring beats Word's hidden state).
Validation, enrichment (citations, VERA, reading stats), and the
reader / packager / validator routes all work unchanged — the ACA is
the same shape regardless of input format.

### 6. Pipeline state

```
INGEST ──┬─→ Markdown ✅
         └─→ DOCX     ✅ (this phase)
   ↓
NORMALIZE → ACA ─┬─→ web-reader ✅
                 ├─→ cinematic  ✅
                 ├─→ operational ✅
                 ├─→ pdf (browser) ✅
                 ├─→ pdf (KDP runner) ⏸
                 ├─→ epub3 ✅
                 ├─→ kindle epub ✅
                 └─→ kfx (runner) ⏸
```

Every PTL-008 §2 input is now supported; every PTL-008 §5 output has
at least one shippable path. The only deferrals are the two
runner-blocked emission jobs.

### 7. Next executable phase

**Phase 7A — external build-runner.** Now the highest-leverage
remaining work. Unblocks PDF Path B (PTL-014 §5) and KFX (PTL-016 §4)
simultaneously. Runner is a Node container that consumes the
documented `/api/public/render/*` contracts.

Alternative: **Phase 7B — author live-preview** (drag a .docx /
.md into a browser route and see the rendered reader without a
deploy). Independent of any runner; useful in-app authoring polish.
