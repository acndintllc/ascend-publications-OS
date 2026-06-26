/* VERA sidecar enrichment (PTL-008 §4, Phase 3D).
   vera.json shape: { notes: [{ id, voice, body, anchor: <paragraph index> }] } */
import type { ACABlock, VeraNote } from "../schema/aca";

export interface VeraSidecar {
  notes: Array<VeraNote & { anchor: number }>;
}

export function attachVera(blocks: ACABlock[], sidecar: VeraSidecar | undefined): {
  blocks: ACABlock[];
  notes: VeraNote[];
} {
  if (!sidecar || !sidecar.notes?.length) return { blocks, notes: [] };
  let bodyIx = 0;
  const noteByAnchor = new Map(sidecar.notes.map((n) => [n.anchor, n]));

  const walk = (bs: ACABlock[]): ACABlock[] =>
    bs.map((b) => {
      if (b.kind === "body") {
        const ix = bodyIx++;
        const note = noteByAnchor.get(ix);
        return note
          ? { ...b, vera: { id: note.id, voice: note.voice, body: note.body, kind: note.kind, source: note.source, title: note.title } }
          : b;
      }
      if (b.kind === "section" || b.kind === "sidebar" || b.kind === "callout" || b.kind === "report") {
        return { ...b, children: walk(b.children) };
      }
      return b;
    });

  const out = walk(blocks);
  return {
    blocks: out,
    notes: sidecar.notes.map(({ id, voice, body, kind, source, title }) => ({ id, voice, body, kind, source, title })),
  };

}
