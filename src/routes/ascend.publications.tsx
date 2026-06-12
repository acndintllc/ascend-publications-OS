/* /ascend/publications — Phase 8 operations dashboard.
   Shows lifecycle status, profile, metadata coverage, and export
   readiness for every manuscript in the registry. Architecture-first;
   minimal styling, reuses TIER-2 tokens. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { listRegistry, describe } from "@/publication/registry";
import { planExports, type ExportPlan } from "@/publication/export";
import { adaptForAllTargets, type AdapterResult, type PublicationMetadata } from "@/publication/metadata";
import type { PublicationProfile } from "@/publication/profiles";
import type { PublicationRecord } from "@/publication/status";
import { getManuscript } from "@/manuscript/library";
import { enrich } from "@/manuscript/pipeline";

interface Row {
  record: PublicationRecord;
  metadata: PublicationMetadata;
  profile: PublicationProfile | undefined;
  plan: ExportPlan | undefined;
  adapters: AdapterResult<PublicationMetadata>[];
  issueCount: number;
}

export const Route = createFileRoute("/ascend/publications")({
  head: () => ({
    meta: [
      { title: "ASCEND Publications — Operations" },
      { name: "description", content: "Publication lifecycle, metadata, profiles, and export readiness." },
    ],
  }),
  loader: () => {
    const rows = listRegistry().map((e) => {
      const lib = getManuscript(e.record.slug);
      const enriched = lib
        ? enrich(lib.doc, { bib: lib.bib, vera: lib.veraSidecar })
        : undefined;
      const plan = enriched ? planExports(e.record, enriched) : undefined;
      const adapters = adaptForAllTargets(e.metadata);
      const d = describe(e.record.slug);
      return {
        record: e.record,
        metadata: e.metadata,
        profile: d?.profile,
        plan,
        adapters,
        issueCount: enriched?.report.issues.length ?? 0,
      };
    });
    return { rows };
  },
  component: PublicationsRoute,
});

const cell: React.CSSProperties = {
  padding: "var(--am-space-3)",
  borderBlockEnd: "1px solid var(--am-color-ink-200)",
  fontFamily: "var(--am-font-ui)",
  fontSize: "var(--am-type-200)",
  verticalAlign: "top",
};

function PublicationsRoute() {
  const { rows } = Route.useLoaderData() as ReturnType<typeof Route.useLoaderData>;
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
          ASCEND / Publications
        </div>
        <h1
          style={{
            fontFamily: "var(--am-font-display)",
            fontSize: "var(--am-type-800)",
            margin: 0,
            marginBlockEnd: "var(--am-silence-sm)",
          }}
        >
          Publication Operations
        </h1>
        <nav
          style={{
            fontFamily: "var(--am-font-ui)",
            fontSize: "var(--am-type-200)",
            display: "flex",
            gap: "var(--am-space-5)",
            marginBlockEnd: "var(--am-silence-md)",
          }}
        >
          <Link to="/ascend/library">→ Library</Link>
          <Link to="/ascend/live">→ Live preview</Link>
        </nav>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Title", "Profile", "Status", "Version", "Issues", "Export readiness", "Distribution"].map((h) => (
                <th key={h} style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ record, profile, plan, adapters, issueCount }) => {
              const okTargets = plan?.checks.filter((c) => c.ready).map((c) => c.target) ?? [];
              const blockedTargets = plan?.checks.filter((c) => !c.ready).map((c) => c.target) ?? [];
              const adapterErrors = adapters.flatMap((a) =>
                a.issues.filter((i) => i.level === "error").map(() => a.target),
              );
              return (
                <tr key={record.slug}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>
                      <Link to="/ascend/reader/$slug" params={{ slug: record.slug }}>
                        {record.title}
                      </Link>
                    </div>
                    {record.subtitle && (
                      <div style={{ color: "var(--am-color-ink-500)" }}>{record.subtitle}</div>
                    )}
                    <div style={{ color: "var(--am-color-ink-500)", marginBlockStart: 4 }}>
                      {record.author}
                    </div>
                  </td>
                  <td style={cell}>
                    {profile?.label ?? record.profile}
                    {profile?.lines.length ? (
                      <div style={{ color: "var(--am-color-ink-500)" }}>{profile.lines.join(" · ")}</div>
                    ) : null}
                  </td>
                  <td style={cell}>{record.status}</td>
                  <td style={cell}>{record.version}</td>
                  <td style={cell}>
                    {issueCount === 0 ? "clean" : `${issueCount}`}{" "}
                    <Link to="/ascend/validate/$slug" params={{ slug: record.slug }}>
                      audit →
                    </Link>
                  </td>
                  <td style={cell}>
                    <div style={{ color: okTargets.length ? "inherit" : "var(--am-color-ink-500)" }}>
                      ✓ {okTargets.join(", ") || "—"}
                    </div>
                    {blockedTargets.length > 0 && (
                      <div style={{ color: "var(--am-color-ink-500)" }}>
                        ✗ {blockedTargets.join(", ")}
                      </div>
                    )}
                  </td>
                  <td style={cell}>
                    {adapterErrors.length === 0
                      ? "metadata complete"
                      : `missing: ${Array.from(new Set(adapterErrors)).join(", ")}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <section style={{ marginBlockStart: "var(--am-silence-md)", fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-200)", color: "var(--am-color-ink-500)" }}>
          <p>
            Statuses advance via <code>setStatus()</code>; metadata via{" "}
            <code>updateMetadata()</code>. Export plans are recomputed on each load
            against the live enrichment pipeline.
          </p>
        </section>
      </div>
    </main>
  );
}
