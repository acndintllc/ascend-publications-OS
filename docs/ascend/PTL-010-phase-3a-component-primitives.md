# PTL-010 — PHASE 3A: TIER-2-BOUND COMPONENT PRIMITIVES

**Status:** Implemented — first phase with visible output.
**Spec:** PTL-006 (TIER 2) + PTL-007 (mode cascade)

## 1. FILES CREATED

| File | Role |
|---|---|
| `src/components/ascend/primitives.tsx` | TIER-2-bound React primitives |
| `src/routes/ascend.proof.tsx` | `/ascend/proof` demo route, mode switcher |

## 2. COMPONENTS

`Chapter`, `ChapterOpener`, `Section`, `Body`, `Dialogue`, `PullQuote`,
`Sidebar`, `Callout`, `Footnote`, `CitationBlock`, `SceneBreak`,
`ReportBlock`.

## 3. BINDING DISCIPLINE

- Every visual property resolves to a TIER 2 token via `var(--am-<role>-*)`.
- Zero raw values (no hex, no rem, no oklch literals inside components).
- Zero TIER 1 references except for layout chrome (spacing/borders) where
  no TIER 2 token is defined — consistent with PTL-006 §2 scope (TIER 2
  governs publishing roles, not generic layout chrome).
- No Tailwind color utilities. No `cn()` color classes. Inline style is
  the binding surface so TIER 3 `[data-mode]` overlays cascade through
  `var()` substitution at the root.

## 4. PROOF ROUTE

`/ascend/proof` renders one canonical specimen (chapter opener, section,
body, dialogue, pull quote, sidebar, callout, report block, citation,
footnotes, scene break) under a runtime `data-mode` switch across all six
modes: `web-reader`, `cinematic`, `operational`, `pdf`, `ebook`, `kindle`.

This validates end-to-end:
1. TIER 2 → TIER 1 resolution (Phase 2A).
2. TIER 3 `[data-mode]` overlay cascade (Phase 2B).
3. Component → TIER 2 binding (Phase 3A).

## 5. KNOWN DEFERRED ITEMS

- Variable-font axis bindings (`font-variation-settings`) for `cinematic`
  remain unbound — logged in PTL-009 §4. Components currently rely on
  family + weight only; axes will be applied as a follow-on prop pass.
- `pdf` mode page-break behavior only manifests under print preview.
- `ebook` / `kindle` measure relaxation is visible but not yet packaged.

## 6. NEXT EXECUTABLE PHASE

**Phase 3B — manuscript pipeline ingress (PTL-008 §1–§3).** Implement the
Markdown → ACA (ASCEND Canonical AST) parser and the ACA → component
renderer, so authored manuscripts (not hand-written JSX) drive the proof
route. Output formats (EPUB/Kindle/PDF) remain deferred per original
directive.
