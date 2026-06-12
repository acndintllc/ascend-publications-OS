/* ASCEND TIER-2-bound component primitives (PTL Phase 3A)
   Components bind ONLY to TIER 2 semantic tokens via inline CSS vars.
   No raw values. No TIER 1 references. No Tailwind color classes. */
import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type SectionProps = React.HTMLAttributes<HTMLElement>;

const cx = (...c: Array<string | undefined | false>) => c.filter(Boolean).join(" ");

export function Chapter({ className, style, children, ...rest }: SectionProps) {
  return (
    <section
      data-am="chapter"
      className={cx("am-chapter", className)}
      style={{
        background: "var(--am-chapter-bg)",
        color: "var(--am-chapter-ink)",
        paddingBlock: "var(--am-chapter-rhythm)",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          maxWidth: "var(--am-chapter-measure)",
          marginInline: "auto",
          paddingInline: "var(--am-space-6)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function ChapterOpener({
  eyebrow,
  title,
  className,
  style,
  ...rest
}: { eyebrow?: React.ReactNode; title: React.ReactNode } & Omit<DivProps, "title">) {
  return (
    <header
      data-am="chapter-opener"
      className={cx("am-chapter-opener", className)}
      style={{
        marginBlockEnd: "var(--am-section-silence)",
        ...style,
      }}
      {...(rest as React.HTMLAttributes<HTMLElement>)}
    >
      {eyebrow ? (
        <div
          style={{
            fontFamily: "var(--am-report-family)",
            letterSpacing: "var(--am-vera-label)",
            color: "var(--am-chapter-opener-rule-color)",
            textTransform: "uppercase",
            fontSize: "var(--am-sourcenote-size)",
            marginBlockEnd: "var(--am-space-5)",
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <h1
        style={{
          fontFamily: "var(--am-chapter-opener-display-family)",
          fontSize: "var(--am-chapter-opener-display-size)",
          lineHeight: "var(--am-chapter-opener-display-leading)",
          letterSpacing: "var(--am-chapter-opener-display-tracking)",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <div
        aria-hidden
        style={{
          width: "var(--am-space-9)",
          height: "var(--am-border-medium)",
          background: "var(--am-chapter-opener-rule-color)",
          marginBlockStart: "var(--am-space-6)",
        }}
      />
    </header>
  );
}

export function Section({
  title,
  children,
  className,
  style,
  ...rest
}: { title?: React.ReactNode } & Omit<SectionProps, "title">) {
  return (
    <section
      data-am="section"
      className={className}
      style={{ marginBlockStart: "var(--am-section-silence)", ...style }}
      {...rest}
    >
      {title ? (
        <h2
          style={{
            fontFamily: "var(--am-section-title-family)",
            fontSize: "var(--am-section-title-size)",
            fontWeight: "var(--am-section-title-weight)" as unknown as number,
            lineHeight: "var(--am-leading-snug)",
            margin: 0,
            marginBlockEnd: "var(--am-space-6)",
          }}
        >
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export function Body({ className, style, children, ...rest }: DivProps) {
  return (
    <div
      data-am="body"
      className={className}
      style={{
        fontFamily: "var(--am-body-family)",
        fontSize: "var(--am-body-size)",
        lineHeight: "var(--am-body-leading)",
        color: "var(--am-body-ink)",
        maxWidth: "var(--am-body-measure)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Dialogue({ speaker, children, style, ...rest }: { speaker?: string } & DivProps) {
  return (
    <p
      data-am="dialogue"
      style={{
        paddingInlineStart: "var(--am-dialogue-indent)",
        lineHeight: "var(--am-dialogue-leading)",
        color: "var(--am-dialogue-ink)",
        margin: 0,
        marginBlockEnd: "var(--am-space-5)",
        ...style,
      }}
      {...(rest as React.HTMLAttributes<HTMLParagraphElement>)}
    >
      {speaker ? <strong style={{ marginInlineEnd: "var(--am-space-3)" }}>{speaker}:</strong> : null}
      {children}
    </p>
  );
}

export function PullQuote({ cite, children, style, ...rest }: { cite?: string } & React.BlockquoteHTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote
      data-am="pullquote"
      style={{
        fontFamily: "var(--am-pullquote-family)",
        fontSize: "var(--am-pullquote-size)",
        lineHeight: "var(--am-pullquote-leading)",
        color: "var(--am-pullquote-accent)",
        marginBlock: "var(--am-pullquote-silence)",
        marginInline: 0,
        paddingInlineStart: "var(--am-space-6)",
        borderInlineStart: "var(--am-border-medium) solid var(--am-pullquote-accent)",
        ...style,
      }}
      cite={cite}
      {...rest}
    >
      {children}
    </blockquote>
  );
}

export function Sidebar({ title, children, style, ...rest }: { title?: React.ReactNode } & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <aside
      data-am="sidebar"
      style={{
        background: "var(--am-sidebar-bg)",
        color: "var(--am-sidebar-ink)",
        borderRadius: "var(--am-sidebar-radius)",
        padding: "var(--am-sidebar-pad)",
        marginBlock: "var(--am-silence-md)",
        ...style,
      }}
      {...rest}
    >
      {title ? (
        <div
          style={{
            fontFamily: "var(--am-section-title-family)",
            fontSize: "var(--am-type-400)",
            fontWeight: "var(--am-section-title-weight)" as unknown as number,
            marginBlockEnd: "var(--am-space-5)",
          }}
        >
          {title}
        </div>
      ) : null}
      {children}
    </aside>
  );
}

export function Callout({ children, style, ...rest }: DivProps) {
  return (
    <div
      data-am="callout"
      style={{
        background: "var(--am-callout-bg)",
        borderInlineStart: "var(--am-border-thick) solid var(--am-callout-accent)",
        borderRadius: "var(--am-callout-radius)",
        padding: "var(--am-space-6)",
        marginBlock: "var(--am-silence-md)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Footnote({ children, style, ...rest }: DivProps) {
  return (
    <p
      data-am="footnote"
      style={{
        fontSize: "var(--am-footnote-size)",
        color: "var(--am-footnote-ink)",
        lineHeight: "var(--am-footnote-leading)",
        margin: 0,
        marginBlockEnd: "var(--am-space-4)",
        ...style,
      }}
      {...(rest as React.HTMLAttributes<HTMLParagraphElement>)}
    >
      {children}
    </p>
  );
}

export function CitationBlock({ children, style, ...rest }: DivProps) {
  return (
    <pre
      data-am="citation"
      style={{
        fontFamily: "var(--am-citation-family)",
        fontSize: "var(--am-citation-size)",
        background: "var(--am-citation-bg)",
        padding: "var(--am-space-5)",
        borderRadius: "var(--am-radius-sm)",
        whiteSpace: "pre-wrap",
        margin: 0,
        marginBlock: "var(--am-space-6)",
        ...style,
      }}
      {...(rest as React.HTMLAttributes<HTMLPreElement>)}
    >
      {children}
    </pre>
  );
}

export function SceneBreak() {
  return (
    <div
      data-am="scenebreak"
      aria-hidden
      style={{
        textAlign: "center",
        color: "var(--am-scenebreak-glyph-color)",
        marginBlock: "var(--am-scenebreak-silence)",
        letterSpacing: "var(--am-tracking-widest)",
      }}
    >
      ❦ ❦ ❦
    </div>
  );
}

export function ReportBlock({ children, style, ...rest }: DivProps) {
  return (
    <div
      data-am="report"
      style={{
        fontFamily: "var(--am-report-family)",
        fontSize: "var(--am-report-size)",
        borderTop: "var(--am-border-thin) solid var(--am-report-rule)",
        borderBottom: "var(--am-border-thin) solid var(--am-report-rule)",
        paddingBlock: "var(--am-space-6)",
        marginBlock: "var(--am-silence-md)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
