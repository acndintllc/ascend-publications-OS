/* ACA → React renderer (PTL-008 §5 web-reader path, Phase 3B + 9C)
   PTL-022: VERA block kinds are gated by an optional allow-list (per
   publication profile / per-publication vera_config). When a kind is
   suppressed by policy, a minimal fallback marker renders instead. */
import * as React from "react";
import {
  Body,
  Callout,
  ChapterOpener,
  CitationBlock,
  Dialogue,
  Footnote,
  PullQuote,
  ReportBlock,
  SceneBreak,
  Section,
  Sidebar,
} from "@/components/ascend/primitives";
import { VERA_BLOCKS } from "@/publication/vera-blocks";
import type { VeraBlockKind } from "@/publication/profiles";
import type { ACABlock, ACADocument, ACAInline, VeraNote } from "../schema/aca";

const VERA_ACCENTS: Record<VeraBlockKind, string> = {
  "vera-note": "var(--am-vera-accent)",
  "vera-explain": "#2563eb",
  "vera-insight": "#7c3aed",
  "vera-question": "#0891b2",
  "vera-research-prompt": "#059669",
  "vera-learning-prompt": "#d97706",
  "vera-language-bridge": "#db2777",
};

interface VeraPolicy {
  allowedKinds?: VeraBlockKind[]; // undefined = allow all
}

function renderVera(note: VeraNote, policy: VeraPolicy): React.ReactNode {
  const kind: VeraBlockKind = (note.kind ?? "vera-note") as VeraBlockKind;
  const spec = VERA_BLOCKS[kind];
  if (policy.allowedKinds && !policy.allowedKinds.includes(kind)) {
    return (
      <aside
        data-am="vera-suppressed"
        data-vera-kind={kind}
        style={{
          marginBlockStart: "var(--am-space-4)",
          padding: "var(--am-space-3) var(--am-space-4)",
          borderInlineStart: "2px dashed var(--am-color-ink-300)",
          fontFamily: "var(--am-font-ui)",
          fontSize: "var(--am-sourcenote-size)",
          color: "var(--am-color-ink-500)",
          letterSpacing: "var(--am-tracking-widest)",
          textTransform: "uppercase",
        }}
      >
        VERA block suppressed by profile · {spec?.label ?? kind}
      </aside>
    );
  }
  const accent = VERA_ACCENTS[kind];
  const missingSource = spec?.requiresSource && !note.source;
  return (
    <aside
      data-am="vera-block"
      data-vera-kind={kind}
      data-vera-interactive={spec?.interactive ? "true" : undefined}
      style={{
        marginBlockStart: "var(--am-space-5)",
        padding: "var(--am-space-5)",
        background: "var(--am-vera-bg)",
        borderInlineStart: `var(--am-border-thick) solid ${accent}`,
        borderRadius: "var(--am-radius-sm)",
        fontFamily: "var(--am-font-ui)",
        fontSize: "var(--am-type-200)",
        color: "var(--am-color-ink-700)",
      }}
    >
      <div
        style={{
          letterSpacing: "var(--am-vera-label)",
          textTransform: "uppercase",
          color: accent,
          fontSize: "var(--am-sourcenote-size)",
          marginBlockEnd: "var(--am-space-3)",
        }}
      >
        {note.voice} · {spec?.label ?? kind} · {note.id}
      </div>
      <div>{note.body}</div>
      {note.source ? (
        <div
          style={{
            marginBlockStart: "var(--am-space-3)",
            fontSize: "var(--am-sourcenote-size)",
            color: "var(--am-color-ink-500)",
          }}
        >
          Source: {note.source}
        </div>
      ) : null}
      {missingSource ? (
        <div
          style={{
            marginBlockStart: "var(--am-space-3)",
            fontSize: "var(--am-sourcenote-size)",
            color: "#b45309",
          }}
        >
          ⚠ {spec.label} requires a source citation.
        </div>
      ) : null}
      {spec?.interactive ? (
        <div
          style={{
            marginBlockStart: "var(--am-space-3)",
            fontSize: "var(--am-sourcenote-size)",
            color: "var(--am-color-ink-500)",
          }}
        >
          ↳ Interactive prompt — reader response expected.
        </div>
      ) : null}
    </aside>
  );
}

function renderInline(nodes: ACAInline[]): React.ReactNode {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case "text":
        return <React.Fragment key={i}>{n.value}</React.Fragment>;
      case "emphasis":
        return <em key={i}>{renderInline(n.children)}</em>;
      case "strong":
        return <strong key={i}>{renderInline(n.children)}</strong>;
      case "code":
        return (
          <code key={i} style={{ fontFamily: "var(--am-citation-family)" }}>
            {n.value}
          </code>
        );
      case "link":
        return (
          <a key={i} href={n.href} style={{ color: "var(--am-callout-accent)" }}>
            {renderInline(n.children)}
          </a>
        );
      case "footnote-ref":
        return (
          <sup key={i}>
            <a href={`#fn-${n.id}`} id={`fnref-${n.id}`}>
              [{n.id}]
            </a>
          </sup>
        );
      case "citation-ref":
        return (
          <sup key={i}>
            <a
              href={`#bib-${n.key}`}
              title={n.resolved ? `${n.resolved.author ?? ""} ${n.resolved.year ?? ""}`.trim() : n.key}
              style={{ color: "var(--am-callout-accent)" }}
            >
              [{n.resolved?.author?.split(",")[0] ?? n.key}
              {n.resolved?.year ? ` ${n.resolved.year}` : ""}]
            </a>
          </sup>
        );
    }
  });
}

function renderBlock(b: ACABlock, key: React.Key): React.ReactNode {
  switch (b.kind) {
    case "chapter-opener":
      return <ChapterOpener key={key} eyebrow={b.eyebrow} title={renderInline(b.title)} />;
    case "section":
      return (
        <Section key={key} title={b.title ? renderInline(b.title) : undefined}>
          {b.children.map((c, i) => renderBlock(c, i))}
        </Section>
      );
    case "body":
      return (
        <Body key={key} style={{ marginBlockEnd: "var(--am-space-5)" }}>
          {renderInline(b.children)}
          {b.vera ? (
            <aside
              data-am="vera-note"
              style={{
                marginBlockStart: "var(--am-space-5)",
                padding: "var(--am-space-5)",
                background: "var(--am-vera-bg)",
                borderInlineStart: "var(--am-border-thick) solid var(--am-vera-accent)",
                borderRadius: "var(--am-radius-sm)",
                fontFamily: "var(--am-font-ui)",
                fontSize: "var(--am-type-200)",
                color: "var(--am-color-ink-700)",
              }}
            >
              <div
                style={{
                  letterSpacing: "var(--am-vera-label)",
                  textTransform: "uppercase",
                  color: "var(--am-vera-accent)",
                  fontSize: "var(--am-sourcenote-size)",
                  marginBlockEnd: "var(--am-space-3)",
                }}
              >
                {b.vera.voice} · {b.vera.id}
              </div>
              {b.vera.body}
            </aside>
          ) : null}
        </Body>
      );
    case "dialogue":
      return (
        <Dialogue key={key} speaker={b.speaker}>
          {renderInline(b.children)}
        </Dialogue>
      );
    case "pullquote":
      return (
        <PullQuote key={key} cite={b.cite}>
          {renderInline(b.children)}
        </PullQuote>
      );
    case "sidebar":
      return (
        <Sidebar key={key} title={b.title}>
          {b.children.map((c, i) => renderBlock(c, i))}
        </Sidebar>
      );
    case "callout":
      return (
        <Callout key={key}>{b.children.map((c, i) => renderBlock(c, i))}</Callout>
      );
    case "citation":
      return <CitationBlock key={key}>{b.value}</CitationBlock>;
    case "report":
      return (
        <ReportBlock key={key}>
          {b.children.map((c, i) => renderBlock(c, i))}
        </ReportBlock>
      );
    case "scene-break":
      return <SceneBreak key={key} />;
    case "footnote":
      return null;
  }
}

export function RenderManuscript({ doc }: { doc: ACADocument }) {
  const bib = doc.enrichment?.bibliography ?? [];
  return (
    <>
      {doc.blocks.map((b, i) => renderBlock(b, i))}
      {doc.footnotes.length > 0 ? (
        <Section title="Footnotes">
          {doc.footnotes.map((f) => (
            <Footnote key={f.id} id={`fn-${f.id}`}>
              <strong style={{ marginInlineEnd: "var(--am-space-3)" }}>[{f.id}]</strong>
              {renderInline(f.children)}{" "}
              <a href={`#fnref-${f.id}`}>↩</a>
            </Footnote>
          ))}
        </Section>
      ) : null}
      {bib.length > 0 ? (
        <Section title="Bibliography">
          {bib.map((e) => (
            <p
              key={e.key}
              id={`bib-${e.key}`}
              style={{
                fontFamily: "var(--am-font-body)",
                fontSize: "var(--am-footnote-size)",
                color: "var(--am-footnote-ink)",
                lineHeight: "var(--am-footnote-leading)",
                margin: 0,
                marginBlockEnd: "var(--am-space-4)",
              }}
            >
              <strong style={{ marginInlineEnd: "var(--am-space-3)" }}>[{e.key}]</strong>
              {[e.author, e.year && `(${e.year})`, e.title, e.source].filter(Boolean).join(". ")}
            </p>
          ))}
        </Section>
      ) : null}
    </>
  );
}
