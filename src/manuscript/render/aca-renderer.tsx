/* ACA → React renderer (PTL-008 §5 web-reader path, Phase 3B)
   Pure mapping ACA nodes → TIER-2-bound components. No styling here. */
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
import type { ACABlock, ACADocument, ACAInline } from "../schema/aca";

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
    </>
  );
}
