import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BrandMark } from "@/components/ascend/brand-mark";
import {
  Chapter,
  ChapterOpener,
  Section,
  Body,
  Dialogue,
  PullQuote,
  Sidebar,
  Callout,
  Footnote,
  CitationBlock,
  SceneBreak,
  ReportBlock,
} from "@/components/ascend/primitives";

export const Route = createFileRoute("/_authenticated/ascend/proof")({
  head: () => ({
    meta: [
      { title: "ASCEND — Proof of Cascade" },
      { name: "description", content: "TIER-2-bound primitives rendered across all six publication modes." },
    ],
  }),
  component: ProofPage,
});

const MODES = ["web-reader", "cinematic", "operational", "pdf", "ebook", "kindle"] as const;
type Mode = (typeof MODES)[number];

function Specimen() {
  return (
    <Chapter>
      <ChapterOpener eyebrow="Chapter 1 · Specimen" title="The Cartographer's Silence" />
      <Body>
        <p>
          The map was not the territory. It had never claimed to be. And yet, beneath the lacquered glass of the
          reading room, generations of clerks had treated its lines as binding — promises etched in iron oxide and
          gum arabic, ratified by repetition.
        </p>

        <SceneBreak />

        <Section title="On Verification">
          <p>
            Every claim, the editor wrote in the margin, must answer to two witnesses: the document itself, and
            the silence that surrounds it.
          </p>

          <PullQuote cite="VERA Field Notebook, vol. III">
            A footnote is a confession that the body of the text could not bear the whole weight of what was true.
          </PullQuote>

          <Dialogue speaker="Vera">
            We don't publish certainty. We publish the structure of our doubt, plainly enough that the reader can
            audit it.
          </Dialogue>

          <Callout>
            <strong>Editor's note —</strong> the manuscript pipeline (PTL-008) treats this paragraph as a canonical
            <code> Callout</code> node; the visual treatment is mode-dependent.
          </Callout>
        </Section>

        <Section title="Apparatus">
          <Sidebar title="On the binding">
            The first edition was bound in quarter calf over marbled boards. Only the spine survives; the boards
            were lost in the 1971 flood.
          </Sidebar>

          <ReportBlock>
            <strong>Provenance —</strong> Acquired 1973, Lot 14, Sotheby's London. Prior owner: estate of
            J. Halverson. No conservation interventions on record before 2004.
          </ReportBlock>

          <CitationBlock>
{`Halverson, J. (1968). Marginalia and the Editorial Conscience.
  In Quarterly Review of Textual Practice, 22(3), 401–438.`}
          </CitationBlock>

          <Footnote>
            <sup>1</sup> The phrase "editorial conscience" is Halverson's own; earlier usage by Pound is contested
            and likely apocryphal.
          </Footnote>
          <Footnote>
            <sup>2</sup> See appendix B for the full collation table.
          </Footnote>
        </Section>
      </Body>
    </Chapter>
  );
}

function ProofPage() {
  const [mode, setMode] = React.useState<Mode>("web-reader");

  return (
    <div data-mode={mode} style={{ minHeight: "100vh", background: "var(--am-color-ink-0)" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--am-space-3)",
          alignItems: "center",
          padding: "var(--am-space-5) var(--am-space-6)",
          background: "var(--am-color-ink-50)",
          borderBottom: "var(--am-border-thin) solid var(--am-color-ink-200)",
          fontFamily: "var(--am-font-ui)",
          fontSize: "var(--am-type-200)",
        }}
      >
        <BrandMark size={72} />
        <span style={{ color: "var(--am-color-ink-400)" }}>·</span>
        <strong style={{ letterSpacing: "var(--am-tracking-widest)", textTransform: "uppercase" }}>
          ASCEND · Proof
        </strong>
        <span style={{ color: "var(--am-color-ink-500)" }}>data-mode →</span>
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                fontFamily: "inherit",
                fontSize: "inherit",
                padding: "var(--am-space-3) var(--am-space-5)",
                borderRadius: "var(--am-radius-pill)",
                border: `var(--am-border-thin) solid ${
                  active ? "var(--am-color-accent-500)" : "var(--am-color-ink-300)"
                }`,
                background: active ? "var(--am-color-accent-500)" : "transparent",
                color: active ? "var(--am-color-ink-0)" : "var(--am-color-ink-800)",
                cursor: "pointer",
                letterSpacing: "var(--am-tracking-wide)",
              }}
            >
              {m}
            </button>
          );
        })}
      </nav>

      <Specimen />

      <footer
        style={{
          padding: "var(--am-space-8) var(--am-space-6)",
          fontFamily: "var(--am-font-ui)",
          fontSize: "var(--am-type-100)",
          color: "var(--am-color-ink-500)",
          textAlign: "center",
          letterSpacing: "var(--am-tracking-wide)",
        }}
      >
        TIER 2 → TIER 3 cascade · current mode: <code>{mode}</code>
      </footer>
    </div>
  );
}
