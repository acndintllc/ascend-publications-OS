/* /ascend/library — manuscript index (Phase 3C). */
import { createFileRoute, Link } from "@tanstack/react-router";
import { listManuscripts } from "@/manuscript/library";

export const Route = createFileRoute("/ascend/library")({
  head: () => ({
    meta: [
      { title: "ASCEND Library — Manuscripts" },
      { name: "description", content: "Index of ASCEND manuscripts available in the reader." },
    ],
  }),
  loader: () => ({ entries: listManuscripts() }),
  component: LibraryRoute,
});

function LibraryRoute() {
  const { entries } = Route.useLoaderData();
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
        </header>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {entries.map(({ slug, doc }) => (
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
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
