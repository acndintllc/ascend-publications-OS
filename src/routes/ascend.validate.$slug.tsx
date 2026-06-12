/* /ascend/validate/$slug — manuscript validation report (Phase 6A). */
import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getManuscript } from "@/manuscript/library";
import type { ChapterRhythm, ValidationIssue, ValidationReport } from "@/manuscript/validate";
import type { ACADocument } from "@/manuscript/schema/aca";

export const Route = createFileRoute("/ascend/validate/$slug")({
  loader: ({ params }) => {
    const entry = getManuscript(params.slug);
    if (!entry) throw notFound();
    return { doc: entry.doc, report: entry.report, slug: entry.slug };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Validate · ${loaderData.doc.frontmatter.title} — ASCEND`
          : "ASCEND Validate",
      },
    ],
  }),
  notFoundComponent: () => (
    <main style={{ padding: "var(--am-silence-md)", fontFamily: "var(--am-font-ui)" }}>
      <p>Manuscript not found.</p>
      <Link to="/ascend/library">← Library</Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main style={{ padding: "var(--am-silence-md)", fontFamily: "var(--am-font-ui)" }}>
      <p>Validation crashed: {error.message}</p>
    </main>
  ),
  component: ValidateRoute,
});

const SEV_COLOR: Record<ValidationIssue["severity"], string> = {
  error: "var(--am-color-danger-500)",
  warning: "var(--am-color-warning-500)",
  info: "var(--am-color-info-500)",
};

function ValidateRoute() {
  const { doc, report, slug } = Route.useLoaderData() as {
    doc: ACADocument;
    report: ValidationReport;
    slug: string;
  };

  const counts = report.issues.reduce(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--am-chapter-bg)",
        color: "var(--am-chapter-ink)",
        paddingBlock: "var(--am-silence-md)",
        paddingInline: "var(--am-space-6)",
        fontFamily: "var(--am-font-ui)",
      }}
    >
      <div style={{ maxWidth: "var(--am-chapter-measure)", marginInline: "auto" }}>
        <nav style={{ display: "flex", gap: "var(--am-space-4)", marginBlockEnd: "var(--am-space-7)", fontSize: "var(--am-type-200)" }}>
          <Link to="/ascend/library" style={{ color: "var(--am-color-ink-500)", textDecoration: "none", letterSpacing: "var(--am-tracking-widest)", textTransform: "uppercase" }}>
            ← Library
          </Link>
          <Link to="/ascend/reader/$slug" params={{ slug }} style={{ color: "var(--am-color-ink-500)", textDecoration: "none", letterSpacing: "var(--am-tracking-widest)", textTransform: "uppercase" }}>
            Reader →
          </Link>
        </nav>

        <h1 style={{ fontFamily: "var(--am-font-display)", fontSize: "var(--am-type-700)", margin: 0, marginBlockEnd: "var(--am-space-3)" }}>
          {doc.frontmatter.title}
        </h1>
        <p style={{ color: "var(--am-color-ink-500)", margin: 0, marginBlockEnd: "var(--am-space-7)" }}>
          Validation report ·{" "}
          {doc.enrichment ? `${doc.enrichment.stats.words.toLocaleString()} words · ~${doc.enrichment.stats.readingMinutes} min` : null}
        </p>

        <Section title={`Issues (${report.issues.length})`}>
          <p style={{ color: "var(--am-color-ink-500)", fontSize: "var(--am-type-200)", marginBlockStart: 0 }}>
            {(["error", "warning", "info"] as const)
              .map((s) => `${counts[s] ?? 0} ${s}`)
              .join(" · ")}
          </p>
          {report.issues.length === 0 ? (
            <p style={{ color: "var(--am-color-success-500)" }}>No issues.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {report.issues.map((i, ix) => (
                <li
                  key={ix}
                  style={{
                    display: "flex",
                    gap: "var(--am-space-4)",
                    padding: "var(--am-space-4)",
                    borderBlockEnd: "var(--am-border-thin) solid var(--am-color-ink-100)",
                  }}
                >
                  <span
                    style={{
                      padding: "var(--am-space-1) var(--am-space-3)",
                      borderRadius: "var(--am-radius-sm)",
                      background: SEV_COLOR[i.severity],
                      color: "var(--am-color-ink-0)",
                      fontSize: "var(--am-type-100)",
                      letterSpacing: "var(--am-tracking-wide)",
                      textTransform: "uppercase",
                      flexShrink: 0,
                      alignSelf: "flex-start",
                    }}
                  >
                    {i.severity}
                  </span>
                  <code style={{ fontFamily: "var(--am-font-mono)", fontSize: "var(--am-type-200)", color: "var(--am-color-ink-500)", flexShrink: 0 }}>
                    {i.code}
                  </code>
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Chapter rhythm (${report.rhythm.length})`}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--am-type-200)" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--am-color-ink-500)", borderBlockEnd: "var(--am-border-thin) solid var(--am-color-ink-200)" }}>
                <Th>#</Th>
                <Th>Title</Th>
                <Th right>Words</Th>
                <Th right>¶</Th>
                <Th right>Sections</Th>
                <Th right>Dialogue</Th>
                <Th right>Pull</Th>
              </tr>
            </thead>
            <tbody>
              {report.rhythm.map((c: ChapterRhythm) => (
                <tr key={c.index} style={{ borderBlockEnd: "var(--am-border-thin) solid var(--am-color-ink-100)" }}>
                  <Td mono>{c.index + 1}</Td>
                  <Td>{c.title}</Td>
                  <Td right mono>{c.words.toLocaleString()}</Td>
                  <Td right mono>{c.paragraphs}</Td>
                  <Td right mono>{c.sections}</Td>
                  <Td right mono>{c.dialogue}</Td>
                  <Td right mono>{c.pullquotes}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBlockEnd: "var(--am-silence-md)" }}>
      <h2 style={{ fontFamily: "var(--am-font-display)", fontSize: "var(--am-type-500)", margin: 0, marginBlockEnd: "var(--am-space-5)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ padding: "var(--am-space-3)", textAlign: right ? "right" : "left", fontWeight: "var(--am-weight-medium)", letterSpacing: "var(--am-tracking-wide)", textTransform: "uppercase", fontSize: "var(--am-type-100)" }}>
      {children}
    </th>
  );
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td style={{ padding: "var(--am-space-3)", textAlign: right ? "right" : "left", fontFamily: mono ? "var(--am-font-mono)" : "inherit" }}>
      {children}
    </td>
  );
}
