/* /ascend/library — manuscript index (Phase 3C + 6A). */
import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/ascend/brand-mark";
import {
  listFailures,
  listManuscripts,
  type LibraryEntry,
  type LibraryFailure,
} from "@/manuscript/library";

export const Route = createFileRoute("/ascend/library")({
  head: () => ({
    meta: [
      { title: "ASCEND Library — Manuscripts" },
      { name: "description", content: "Index of ASCEND manuscripts available in the reader." },
    ],
  }),
  loader: () => ({ entries: listManuscripts(), failures: listFailures() }),
  component: LibraryRoute,
});

function LibraryRoute() {
  const { entries, failures } = Route.useLoaderData() as {
    entries: LibraryEntry[];
    failures: LibraryFailure[];
  };
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--am-chapter-bg)",
        color: "var(--am-chapter-ink)",
        paddingBlock: "var(--am-silence-lg)",
        paddingInline: "var(--am-space-6)",
      }}
    >
      <div style={{ maxWidth: "var(--am-chapter-measure)", marginInline: "auto" }}>
        <header style={{ marginBlockEnd: "var(--am-silence-md)" }}>
          <div style={{ marginBlockEnd: "var(--am-space-5)" }}>
            <BrandMark size={36} tagline />
          </div>
          <div
            style={{
              fontFamily: "var(--am-font-ui)",
              letterSpacing: "var(--am-tracking-widest)",
              textTransform: "uppercase",
              fontSize: "var(--am-sourcenote-size)",
              color: "var(--am-color-ink-500)",
              marginBlockEnd: "var(--am-space-5)",
            }}
          >
            ASCEND / Library
          </div>
          <h1
            style={{
              fontFamily: "var(--am-font-display)",
              fontSize: "var(--am-type-800)",
              lineHeight: "var(--am-leading-tight)",
              letterSpacing: "var(--am-tracking-tight)",
              margin: 0,
            }}
          >
            Manuscripts
          </h1>
          <p
            style={{
              fontFamily: "var(--am-font-ui)",
              color: "var(--am-color-ink-600)",
              marginBlockStart: "var(--am-space-4)",
              marginBlockEnd: 0,
            }}
          >
            <Link
              to="/ascend/live"
              style={{
                color: "var(--am-color-accent-600)",
                textDecoration: "none",
                letterSpacing: "var(--am-tracking-wide)",
              }}
            >
              → Live preview
            </Link>
            <span style={{ marginInlineStart: "var(--am-space-3)", color: "var(--am-color-ink-500)" }}>
              Drop a .md or .docx to render without redeploying.
            </span>
          </p>
        </header>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {entries.map(({ slug, doc, report }) => (
            <li
              key={slug}
              style={{
                borderTop: "var(--am-border-thin) solid var(--am-color-ink-200)",
                paddingBlock: "var(--am-space-6)",
              }}
            >
              <Link
                to="/ascend/reader/$slug"
                params={{ slug }}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                {doc.frontmatter.eyebrow ? (
                  <div
                    style={{
                      fontFamily: "var(--am-font-ui)",
                      letterSpacing: "var(--am-tracking-widest)",
                      textTransform: "uppercase",
                      fontSize: "var(--am-sourcenote-size)",
                      color: "var(--am-color-accent-600)",
                      marginBlockEnd: "var(--am-space-3)",
                    }}
                  >
                    {doc.frontmatter.eyebrow}
                  </div>
                ) : null}
                <h2
                  style={{
                    fontFamily: "var(--am-font-display)",
                    fontSize: "var(--am-type-600)",
                    lineHeight: "var(--am-leading-snug)",
                    margin: 0,
                    marginBlockEnd: "var(--am-space-4)",
                  }}
                >
                  {doc.frontmatter.title}
                </h2>
                {doc.frontmatter.subtitle ? (
                  <p
                    style={{
                      fontFamily: "var(--am-body-family)",
                      fontSize: "var(--am-body-size)",
                      lineHeight: "var(--am-body-leading)",
                      color: "var(--am-color-ink-600)",
                      margin: 0,
                      marginBlockEnd: "var(--am-space-4)",
                    }}
                  >
                    {doc.frontmatter.subtitle}
                  </p>
                ) : null}
                <div
                  style={{
                    fontFamily: "var(--am-font-ui)",
                    fontSize: "var(--am-type-200)",
                    color: "var(--am-color-ink-500)",
                  }}
                >
                  {doc.frontmatter.authors.join(", ")} · default mode:{" "}
                  <code style={{ fontFamily: "var(--am-font-mono)" }}>
                    {doc.frontmatter.mode}
                  </code>
                </div>
              </Link>
              <div style={{ marginBlockStart: "var(--am-space-4)", display: "flex", gap: "var(--am-space-3)", alignItems: "center", fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-100)" }}>
                {report.issues.length > 0 ? (
                  <span style={{
                    padding: "var(--am-space-1) var(--am-space-3)",
                    borderRadius: "var(--am-radius-sm)",
                    background: report.issues.some((i) => i.severity === "error") ? "var(--am-color-danger-500)" : "var(--am-color-warning-500)",
                    color: "var(--am-color-ink-0)",
                    letterSpacing: "var(--am-tracking-wide)",
                    textTransform: "uppercase",
                  }}>
                    {report.issues.length} issue{report.issues.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span style={{ color: "var(--am-color-success-500)" }}>✓ clean</span>
                )}
                <Link
                  to="/ascend/validate/$slug"
                  params={{ slug }}
                  style={{
                    color: "var(--am-color-ink-500)",
                    textDecoration: "none",
                    letterSpacing: "var(--am-tracking-widest)",
                    textTransform: "uppercase",
                  }}
                >
                  Validate →
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {failures.length > 0 ? (
          <section style={{ marginBlockStart: "var(--am-silence-md)" }}>
            <h2 style={{ fontFamily: "var(--am-font-display)", fontSize: "var(--am-type-500)", color: "var(--am-color-danger-500)" }}>
              Failed to parse ({failures.length})
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {failures.map((f) => (
                <li key={f.slug} style={{ padding: "var(--am-space-5)", borderInlineStart: "var(--am-border-thick) solid var(--am-color-danger-500)", marginBlockEnd: "var(--am-space-4)", background: "var(--am-color-ink-50)", fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-200)" }}>
                  <code style={{ fontFamily: "var(--am-font-mono)", color: "var(--am-color-ink-700)" }}>{f.slug}</code>
                  <p style={{ margin: 0, marginBlockStart: "var(--am-space-3)", color: "var(--am-color-ink-600)" }}>{f.error}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
