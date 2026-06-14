import { createFileRoute, Link } from "@tanstack/react-router";
import { ASCEND_LOGO_URL } from "@/components/ascend/brand-mark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ASCEND Publishing OS — Internal Console" },
      {
        name: "description",
        content:
          "Internal admin console for the ASCEND Publishing OS: ingest manuscripts, manage publications, run readiness audits, and trigger distribution.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Home,
});

interface Entry {
  to: string;
  title: string;
  desc: string;
  cta: string;
}

const PRIMARY: Entry[] = [
  {
    to: "/ascend/publications",
    title: "Publication Operations",
    desc: "Persistent dashboard of every publication. Status, profile, export readiness, VERA config, assets, distribution.",
    cta: "Open dashboard →",
  },
  {
    to: "/ascend/live",
    title: "Ingest a Manuscript",
    desc: "Drop manuscript.md or manuscript.docx (plus optional citations.bib and vera.json) to preview through the full pipeline in your browser. Nothing is uploaded.",
    cta: "Open ingest →",
  },
  {
    to: "/ascend/library",
    title: "Manuscript Library",
    desc: "Build-time manuscript catalog auto-seeded into the publication store on first dashboard load.",
    cta: "Open library →",
  },
];

const SECONDARY: Entry[] = [
  {
    to: "/ascend/proof",
    title: "Tier-1 Proof",
    desc: "Validate semantic primitives and rendering proofs.",
    cta: "Open proof →",
  },
];

function Card({ entry, primary }: { entry: Entry; primary?: boolean }) {
  return (
    <Link
      to={entry.to}
      style={{
        display: "block",
        padding: primary ? "var(--am-space-6)" : "var(--am-space-5)",
        borderRadius: 12,
        border: "1px solid var(--am-color-ink-200)",
        background: "var(--am-color-ink-0)",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 120ms ease, border-color 120ms ease",
      }}
    >
      <div
        style={{
          fontFamily: "var(--am-font-display)",
          fontSize: primary ? "var(--am-type-600)" : "var(--am-type-500)",
          lineHeight: "var(--am-leading-tight)",
          marginBlockEnd: "var(--am-space-3)",
        }}
      >
        {entry.title}
      </div>
      <p
        style={{
          fontFamily: "var(--am-font-ui)",
          color: "var(--am-color-ink-600)",
          fontSize: "var(--am-type-200)",
          margin: 0,
          marginBlockEnd: "var(--am-space-4)",
        }}
      >
        {entry.desc}
      </p>
      <div
        style={{
          fontFamily: "var(--am-font-ui)",
          fontSize: "var(--am-type-200)",
          letterSpacing: "var(--am-tracking-wide)",
          color: "var(--am-color-accent-500, #0a66ff)",
        }}
      >
        {entry.cta}
      </div>
    </Link>
  );
}

function Home() {
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
      <div style={{ maxWidth: 1100, marginInline: "auto" }}>
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
          ASCEND · Publishing OS · Internal Console
        </div>
        <h1
          style={{
            fontFamily: "var(--am-font-display)",
            fontSize: "var(--am-type-800)",
            margin: 0,
            marginBlockEnd: "var(--am-space-3)",
          }}
        >
          Publishing OS
        </h1>
        <p
          style={{
            fontFamily: "var(--am-font-ui)",
            fontSize: "var(--am-type-300)",
            color: "var(--am-color-ink-600)",
            maxWidth: 720,
            marginBlockEnd: "var(--am-silence-md)",
          }}
        >
          Internal control surface for manuscript ingestion, publication
          lifecycle, metadata, assets, readiness audits, artifact
          generation, and distribution. Backend logic is not exposed to
          the public web.
        </p>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "var(--am-space-5)",
            marginBlockEnd: "var(--am-silence-md)",
          }}
        >
          {PRIMARY.map((e) => (
            <Card key={e.to} entry={e} primary />
          ))}
        </section>

        <h2
          style={{
            fontFamily: "var(--am-font-display)",
            fontSize: "var(--am-type-500)",
            margin: 0,
            marginBlockEnd: "var(--am-space-4)",
          }}
        >
          Workflow
        </h2>
        <ol
          style={{
            fontFamily: "var(--am-font-ui)",
            fontSize: "var(--am-type-200)",
            color: "var(--am-color-ink-600)",
            paddingInlineStart: "var(--am-space-5)",
            marginBlockEnd: "var(--am-silence-md)",
            lineHeight: 1.7,
          }}
        >
          <li>
            Add a manuscript directory under <code>/manuscripts/&lt;slug&gt;/</code>{" "}
            with <code>manuscript.md</code> or <code>.docx</code> (plus optional{" "}
            <code>citations.bib</code> and <code>vera.json</code>), or drop
            files into <Link to="/ascend/live">Ingest</Link> for a transient
            preview.
          </li>
          <li>
            Open <Link to="/ascend/publications">Publication Operations</Link>{" "}
            — new manuscripts auto-seed on first load.
          </li>
          <li>
            Click a title to edit metadata, transition status, configure
            VERA, upload assets, and run the readiness audit.
          </li>
          <li>
            Use the publication's <em>Distribute</em> tab to plan exports,
            register ISBNs, and queue vendor submissions; use{" "}
            <em>Command Center</em> for runners, governance, and live
            submission.
          </li>
        </ol>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "var(--am-space-5)",
          }}
        >
          {SECONDARY.map((e) => (
            <Card key={e.to} entry={e} />
          ))}
        </section>

        <p
          style={{
            marginBlockStart: "var(--am-silence-md)",
            fontFamily: "var(--am-font-ui)",
            fontSize: "var(--am-type-100)",
            color: "var(--am-color-ink-500)",
          }}
        >
          This console is <code>noindex</code>. Vendor credentials and live
          submission adapters require server-side secrets and are not
          callable from this page.
        </p>
      </div>
    </main>
  );
}
