/* /ascend/reader — ACA pipeline proof route (Phase 3B).
   Renders the in-source specimen through Markdown → ACA → components. */
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Chapter } from "@/components/ascend/primitives";
import { parseManuscript } from "@/manuscript/ingest/markdown";
import { RenderManuscript } from "@/manuscript/render/aca-renderer";
import { specimenManuscript } from "@/manuscript/samples/specimen";

const MODES = ["web-reader", "cinematic", "operational", "pdf", "ebook", "kindle"] as const;
type Mode = (typeof MODES)[number];

export const Route = createFileRoute("/ascend/reader")({
  head: () => ({
    meta: [
      { title: "ASCEND Reader — Manuscript Pipeline Proof" },
      { name: "description", content: "Markdown → ACA → TIER-2 components across all publication modes." },
    ],
  }),
  component: ReaderRoute,
});

function ReaderRoute() {
  const [mode, setMode] = React.useState<Mode>("web-reader");
  const doc = React.useMemo(() => parseManuscript(specimenManuscript), []);

  return (
    <div data-mode={mode} style={{ minHeight: "100dvh", background: "var(--am-chapter-bg)" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--am-space-3)",
          padding: "var(--am-space-5) var(--am-space-6)",
          background: "var(--am-color-ink-0)",
          borderBottom: "var(--am-border-thin) solid var(--am-color-ink-200)",
          fontFamily: "var(--am-font-ui)",
          fontSize: "var(--am-type-200)",
        }}
      >
        <span style={{ letterSpacing: "var(--am-tracking-widest)", textTransform: "uppercase", color: "var(--am-color-ink-500)" }}>
          ASCEND / Reader /
        </span>
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "var(--am-space-2) var(--am-space-4)",
              borderRadius: "var(--am-radius-pill)",
              border: `var(--am-border-thin) solid var(--am-color-ink-200)`,
              background: mode === m ? "var(--am-color-ink-900)" : "transparent",
              color: mode === m ? "var(--am-color-ink-0)" : "var(--am-color-ink-700)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "inherit",
            }}
          >
            {m}
          </button>
        ))}
      </nav>
      <Chapter>
        <RenderManuscript doc={doc} />
      </Chapter>
    </div>
  );
}
