## PTL-015 — PHASE 5A: EPUB3 PACKAGER

**Status:** Implemented (client-side download path).
**Spec:** PTL-008 §5 EPUB column, §6 Packager.

### 1. Files

| File | Role |
|---|---|
| `src/manuscript/package/epub-xhtml.ts` | ACA → well-formed XHTML (EPUB3 namespaces, `epub:type` semantics) |
| `src/manuscript/package/epub-css.ts` | Flattened TIER-2 stylesheet (no `var()` chains — KF8/ADE-safe) |
| `src/manuscript/package/epub-zip.ts` | OEBPS zip emitter (fflate, pure-JS, Worker-safe) |

### 2. Why fflate

PTL-008 §8 forbids native binaries in the Worker. fflate is pure JS,
zero deps, edge-runtime compatible — works identically in browser and
TanStack server functions. EPUB requires `mimetype` to be the first
entry and stored uncompressed; `fflate.zipSync` supports that via
`{ level: 0 }`.

### 3. Archive layout

```
mimetype                          (stored, uncompressed)
META-INF/container.xml
OEBPS/content.opf                 (EPUB3 package, dc:* metadata)
OEBPS/nav.xhtml                   (toc nav, EPUB3 navigation)
OEBPS/text/chapter.xhtml          (the manuscript)
OEBPS/styles/manuscript.css       (flattened TIER-2)
```

### 4. XHTML semantics

- `epub:type="chapter"` on `<main>`
- `epub:type="noteref"` / `"footnote"` for footnotes
- `epub:type="sidebar"` / `"annotation"` for sidebars and VERA notes
- `epub:type="bibliography"` on the auto-emitted references list
- VERA notes preserved inline as `<aside>` with annotation semantics

### 5. CSS flattening rationale

TIER-2 tokens (`--am-*`) drive the reader's runtime cascade, but Kindle
KF8 does not support CSS custom properties and ADE has partial support.
`epub-css.ts` ships a single stylesheet with resolved values inlined.
Future phase: build-time generator that reads TIER-2 declarations and
emits the flattened sheet (currently hand-mirrored).

### 6. Reader integration

`/ascend/reader/$slug` shows a **Download EPUB** button in `ebook` and
`kindle` modes. `buildEpub(doc)` runs in the browser; the result is
wrapped in a `Blob` and downloaded via an ephemeral object URL. No
server roundtrip — keeps the Worker out of packaging entirely.

### 7. Kindle path (Phase 5B preview)

Phase 5B reuses the EPUB3 output as KindleGen input. KindleGen is a
native binary → cannot run in the Worker (PTL-008 §8). Same external
build-runner as Phase 4A Path B handles the EPUB→KFX conversion.
Reader's `kindle` mode currently downloads the source EPUB; Phase 5B
will swap to an artifact URL once the runner exists.

### 8. Next executable phase

**Phase 5B — Kindle profile + external runner contract**, or
**Phase 6A — manuscript authoring polish** (frontmatter validation
errors surfaced in `/ascend/library`, manuscript validation report
route). Phase 5B blocks on the external runner; Phase 6A is
independently shippable.
