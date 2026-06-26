/* VERA Interpretation Component — Phase 2.
   Reusable product-facing visual identity for VERA references inside
   ASCEND publications. Renders ONLY when the publication's
   `vera_role` is "interpretation". Narrator / character / none modes
   must keep the manuscript text plain — they never reach this file.

   Constraints (Phase 2):
   - Premium, minimal, editorial.
   - Dark-interface compatible (jet-black surface, soft white ink).
   - Clean typography, subtle border, no avatar, no animation, no
     imagery. Not a chatbot.
   - Renders cleanly in web reader, PDF export, EPUB, and on mobile.
   - Does not break manuscript flow. */
import * as React from "react";
import type { VeraBlockKind } from "@/publication/profiles";

export type VeraInterpretationType =
  | "note"
  | "reflection"
  | "guidance"
  | "alert"
  | "interpretation";

const TYPE_LABELS: Record<VeraInterpretationType, string> = {
  note: "Note",
  reflection: "Reflection",
  guidance: "Guidance",
  alert: "Alert",
  interpretation: "Interpretation",
};

/** Map low-level VERA block kinds onto the Phase 2 editorial type set. */
export function veraTypeFromKind(kind: VeraBlockKind | undefined): VeraInterpretationType {
  switch (kind) {
    case "vera-note":
      return "note";
    case "vera-insight":
    case "vera-question":
      return "reflection";
    case "vera-explain":
    case "vera-learning-prompt":
    case "vera-research-prompt":
      return "guidance";
    case "vera-language-bridge":
      return "interpretation";
    default:
      return "interpretation";
  }
}

export interface VeraInterpretationProps {
  /** Optional Phase 2 type label. Defaults to "Interpretation". */
  type?: VeraInterpretationType;
  /** Optional short editorial title (one line). */
  title?: string;
  /** Body copy. */
  children: React.ReactNode;
  /** Optional source citation displayed in restrained type below body. */
  source?: string;
  /** Stable id for footnoting / deep-linking. */
  id?: string;
}

/**
 * VERA — editorial interpretation block.
 *
 * Visual contract:
 *   ┌─ thin rule top + bottom
 *   │  VERA · {TYPE}                 (uppercase eyebrow, tracked)
 *   │  {Optional title}              (display serif, restrained)
 *   │  {Body}                        (UI sans, comfortable measure)
 *   │  {Optional source}             (caption, muted)
 *   └─
 *
 * All color/spacing flows through TIER-2 semantic tokens so the block
 * adapts to web-reader (dark), PDF (paper), EPUB, and Kindle modes
 * automatically — no per-mode overrides required.
 */
export function VeraInterpretation({
  type = "interpretation",
  title,
  children,
  source,
  id,
}: VeraInterpretationProps) {
  return (
    <aside
      data-am="vera-interpretation"
      data-vera-type={type}
      role="note"
      aria-label={`VERA ${TYPE_LABELS[type]}`}
      style={{
        marginBlock: "var(--am-space-6)",
        paddingBlock: "var(--am-space-5)",
        paddingInline: 0,
        borderBlockStart: "1px solid var(--am-color-ink-300)",
        borderBlockEnd: "1px solid var(--am-color-ink-300)",
        fontFamily: "var(--am-font-ui)",
        color: "var(--am-color-ink-700)",
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "var(--am-space-3)",
          fontSize: "var(--am-sourcenote-size)",
          letterSpacing: "var(--am-tracking-widest)",
          textTransform: "uppercase",
          color: "var(--am-color-ink-500)",
          marginBlockEnd: "var(--am-space-3)",
        }}
      >
        <span style={{ fontWeight: "var(--am-weight-semibold)", color: "var(--am-color-ink-700)" }}>
          VERA
        </span>
        <span aria-hidden="true">·</span>
        <span>{TYPE_LABELS[type]}</span>
        {id ? (
          <span style={{ marginInlineStart: "auto", color: "var(--am-color-ink-400)" }}>{id}</span>
        ) : null}
      </header>
      {title ? (
        <h3
          style={{
            margin: 0,
            marginBlockEnd: "var(--am-space-3)",
            fontFamily: "var(--am-font-display)",
            fontSize: "var(--am-type-400)",
            fontWeight: "var(--am-weight-semibold)",
            lineHeight: "var(--am-leading-snug)",
            color: "var(--am-color-ink-900)",
          }}
        >
          {title}
        </h3>
      ) : null}
      <div
        style={{
          fontSize: "var(--am-type-300)",
          lineHeight: "var(--am-leading-prose)",
          color: "var(--am-color-ink-800)",
        }}
      >
        {children}
      </div>
      {source ? (
        <p
          style={{
            margin: 0,
            marginBlockStart: "var(--am-space-4)",
            fontSize: "var(--am-sourcenote-size)",
            letterSpacing: "var(--am-tracking-wide)",
            color: "var(--am-color-ink-500)",
          }}
        >
          Source · {source}
        </p>
      ) : null}
    </aside>
  );
}
