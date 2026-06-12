/* /ascend/reader/$slug — parametric reader (Phase 3C).
   Loads a manuscript from the build-bundled library, renders through
   the ACA pipeline with a runtime mode switcher. */
import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Chapter } from "@/components/ascend/primitives";
import { getManuscript } from "@/manuscript/library";
import { RenderManuscript } from "@/manuscript/render/aca-renderer";
import type { ACADocument } from "@/manuscript/schema/aca";

const MODES = ["web-reader", "cinematic", "operational", "pdf", "ebook", "kindle"] as const;
type Mode = (typeof MODES)[number];

export const Route = createFileRoute("/ascend/reader/$slug")({
  loader: ({ params }) => {
    const entry = getManuscript(params.slug);
    if (!entry) throw notFound();
    return { doc: entry.doc, slug: entry.slug };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.doc.frontmatter.title} — ASCEND Reader` },
          {
            name: "description",
            content:
              loaderData.doc.frontmatter.subtitle ??
              `${loaderData.doc.frontmatter.title} by ${loaderData.doc.frontmatter.authors.join(", ")}`,
          },
        ]
      : [{ title: "ASCEND Reader" }],
  }),
  notFoundComponent: () => (
    <main style={{ padding: "var(--am-silence-md)", fontFamily: "var(--am-font-ui)" }}>
      <p>Manuscript not found.</p>
      <Link to="/ascend/library">← Library</Link>
    </main>
  ),
  errorComponent: ({ error, reset }) => (
    <main style={{ padding: "var(--am-silence-md)", fontFamily: "var(--am-font-ui)" }}>
      <p>Failed to load manuscript: {error.message}</p>
      <button onClick={reset}>Retry</button>
    </main>
  ),
  component: ReaderRoute,
});

function ReaderRoute() {
  const { doc } = Route.useLoaderData() as { doc: ACADocument; slug: string };
  const [mode, setMode] = React.useState<Mode>(doc.frontmatter.mode);

  return (
    <div data-mode={mode} style={{ minHeight: "100dvh", background: "var(--am-chapter-bg)" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--am-space-3)",
          padding: "var(--am-space-5) var(--am-space-6)",
          background: "var(--am-color-ink-0)",
          borderBottom: "var(--am-border-thin) solid var(--am-color-ink-200)",
          fontFamily: "var(--am-font-ui)",
          fontSize: "var(--am-type-200)",
        }}
      >
        <Link
          to="/ascend/library"
          style={{
            letterSpacing: "var(--am-tracking-widest)",
            textTransform: "uppercase",
            color: "var(--am-color-ink-500)",
            textDecoration: "none",
          }}
        >
          ← Library
        </Link>
        <span style={{ color: "var(--am-color-ink-400)" }}>/</span>
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "var(--am-space-2) var(--am-space-4)",
              borderRadius: "var(--am-radius-pill)",
              border: "var(--am-border-thin) solid var(--am-color-ink-200)",
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
        {doc.enrichment ? (
          <span
            style={{
              marginInlineStart: "auto",
              color: "var(--am-color-ink-500)",
              fontSize: "var(--am-type-100)",
              letterSpacing: "var(--am-tracking-wide)",
            }}
          >
            {doc.enrichment.stats.words.toLocaleString()} words · ~
            {doc.enrichment.stats.readingMinutes} min
          </span>
        ) : null}
      </nav>
      <Chapter>
        <RenderManuscript doc={doc} />
      </Chapter>
    </div>
  );
}
