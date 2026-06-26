/* ACA → React renderer (PTL-008 §5 web-reader path, Phase 3B + 9C)
   PTL-022: VERA block kinds are gated by an optional allow-list (per
   publication profile / per-publication vera_config). When a kind is
   suppressed by policy, a minimal fallback marker renders instead.
   Phase 2: when the publication's vera_role is "interpretation", the
   allowed block renders through the editorial <VeraInterpretation />
   component (premium / minimal / dark-compatible). */
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
import {
  VeraInterpretation,
  veraTypeFromKind,
} from "@/components/ascend/vera-interpretation";
import { VERA_BLOCKS } from "@/publication/vera-blocks";
import type { VeraBlockKind } from "@/publication/profiles";
import { VERA_ROLES, type VeraRole } from "@/publication/vera-role";
import type { ACABlock, ACADocument, ACAInline, VeraNote } from "../schema/aca";

interface VeraPolicy {
  allowedKinds?: VeraBlockKind[]; // undefined = allow all
  role?: VeraRole;                // undefined defaults to "interpretation"
}

function renderVera(note: VeraNote, policy: VeraPolicy): React.ReactNode {
  const role = policy.role ?? "interpretation";
  // Per VERA Role Engine: only "interpretation" emits styled components.
  // "none", "narrator", and "character" preserve manuscript as authored —
  // suppress all VERA UI entirely.
  if (!VERA_ROLES[role].rendersInterpretationBlocks) return null;
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
  const missingSource = spec?.requiresSource && !note.source;
  return (
    <VeraInterpretation
      type={veraTypeFromKind(kind)}
      title={note.title}
      source={note.source}
      id={note.id}
    >
      <p style={{ margin: 0 }}>{note.body}</p>
      {missingSource ? (
        <p
          style={{
            margin: 0,
            marginBlockStart: "var(--am-space-3)",
            fontSize: "var(--am-sourcenote-size)",
            color: "#b45309",
          }}
        >
          ⚠ {spec?.label ?? "VERA"} requires a source citation.
        </p>
      ) : null}
      {spec?.interactive ? (
        <p
          style={{
            margin: 0,
            marginBlockStart: "var(--am-space-3)",
            fontSize: "var(--am-sourcenote-size)",
            color: "var(--am-color-ink-500)",
            letterSpacing: "var(--am-tracking-wide)",
          }}
        >
          ↳ Interactive prompt — reader response expected.
        </p>
      ) : null}
    </VeraInterpretation>
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

function renderBlock(b: ACABlock, key: React.Key, policy: VeraPolicy): React.ReactNode {
  switch (b.kind) {
    case "chapter-opener":
      return <ChapterOpener key={key} eyebrow={b.eyebrow} title={renderInline(b.title)} />;
    case "section":
      return (
        <Section key={key} title={b.title ? renderInline(b.title) : undefined}>
          {b.children.map((c, i) => renderBlock(c, i, policy))}
        </Section>
      );
    case "body":
      return (
        <Body key={key} style={{ marginBlockEnd: "var(--am-space-5)" }}>
          {renderInline(b.children)}
          {b.vera ? renderVera(b.vera, policy) : null}
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
          {b.children.map((c, i) => renderBlock(c, i, policy))}
        </Sidebar>
      );
    case "callout":
      return (
        <Callout key={key}>{b.children.map((c, i) => renderBlock(c, i, policy))}</Callout>
      );
    case "citation":
      return <CitationBlock key={key}>{b.value}</CitationBlock>;
    case "report":
      return (
        <ReportBlock key={key}>
          {b.children.map((c, i) => renderBlock(c, i, policy))}
        </ReportBlock>
      );
    case "scene-break":
      return <SceneBreak key={key} />;
    case "footnote":
      return null;
  }
}

export function RenderManuscript({
  doc,
  allowedVeraKinds,
  veraRole,
}: {
  doc: ACADocument;
  allowedVeraKinds?: VeraBlockKind[];
  veraRole?: VeraRole;
}) {
  const bib = doc.enrichment?.bibliography ?? [];
  const policy: VeraPolicy = { allowedKinds: allowedVeraKinds, role: veraRole };
  return (
    <>
      {doc.blocks.map((b, i) => renderBlock(b, i, policy))}
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
