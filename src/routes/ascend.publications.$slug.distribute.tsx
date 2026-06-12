/* /ascend/publications/$slug/distribute — PTL-024/025 distribution console.
   Shows composite readiness, per-platform reports, distribution queue
   controls, and one-click downloads for the full publication package and
   per-store submission packages. */
import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  getPublication,
  listPublicationAssets,
  listDistributionQueue,
  enqueueDistribution,
  updateDistributionEntry,
  removeDistributionEntry,
  generatePublicationArtifacts,
  listPublicationArtifacts,
} from "@/lib/publication.functions";
import { getManuscript } from "@/manuscript/library";
import { enrich } from "@/manuscript/pipeline";
import { getProfile } from "@/publication/profiles";
import { planExports } from "@/publication/export";
import { computeReadiness } from "@/publication/readiness";
import { adaptForAllTargets, publicationMetadataSchema, DISTRIBUTION_TARGETS, type DistributionTarget, type PublicationMetadata } from "@/publication/metadata";
import { buildPackage, buildStorePackage } from "@/publication/packager";
import { validateAllExports } from "@/publication/validate-exports";
import type { AssetRecord } from "@/publication/assets";
import type { QueueRow } from "@/publication/queue";
import type { ArtifactRow } from "@/publication/runner.server";

export const Route = createFileRoute("/ascend/publications/$slug/distribute")({
  head: ({ params }) => ({
    meta: [
      { title: `Distribute — ${params.slug} — ASCEND` },
      { name: "description", content: "Publication readiness, distribution queue, and store submission packages." },
    ],
  }),
  loader: async ({ params }) => {
    const [pub, assets, queue, artifacts] = await Promise.all([
      getPublication({ data: { slug: params.slug } }),
      listPublicationAssets({ data: { slug: params.slug } }),
      listDistributionQueue({ data: { slug: params.slug } }),
      listPublicationArtifacts({ data: { slug: params.slug } }),
    ]);
    return { pub, assets, queue, artifacts, slug: params.slug };
  },
  component: DistributeRoute,
});

const cell: React.CSSProperties = {
  padding: "var(--am-space-3)",
  borderBlockEnd: "1px solid var(--am-color-ink-200)",
  fontFamily: "var(--am-font-ui)",
  fontSize: "var(--am-type-200)",
  verticalAlign: "top",
};

const btn: React.CSSProperties = {
  padding: "var(--am-space-2) var(--am-space-4)",
  borderRadius: "var(--am-radius-pill)",
  border: "1px solid var(--am-color-ink-300)",
  background: "transparent",
  fontFamily: "var(--am-font-ui)",
  fontSize: "var(--am-type-200)",
  cursor: "pointer",
};

function downloadBytes(filename: string, bytes: Uint8Array, mime: string) {
  // BlobPart requires ArrayBuffer; copy the underlying buffer to a plain ArrayBuffer
  // because Uint8Array.buffer can be a SharedArrayBuffer.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DistributeRoute() {
  const { pub, assets, queue, artifacts, slug } = Route.useLoaderData() as {
    pub: Awaited<ReturnType<typeof getPublication>>;
    assets: AssetRecord[];
    queue: QueueRow[];
    artifacts: { rows: ArtifactRow[]; signed: Record<string, string> };
    slug: string;
  };
  const router = useRouter();
  const r = pub.record;
  const lib = getManuscript(slug);
  const profile = getProfile(r.profile);
  const enriched = lib ? enrich(lib.doc, { bib: lib.bib, vera: lib.veraSidecar }) : null;

  const metadataParsed = pub.metadata
    ? publicationMetadataSchema.safeParse({
        title: r.title,
        subtitle: r.subtitle ?? undefined,
        description: pub.metadata.description || r.title,
        keywords: pub.metadata.keywords,
        categories: pub.metadata.categories,
        author: r.author,
        contributors: pub.metadata.contributors,
        language: r.language,
        audience: r.audience ?? undefined,
        publicationDate: r.publication_date ?? undefined,
        isbn: pub.metadata.isbn ?? undefined,
        publisher: pub.metadata.publisher,
        rights: pub.metadata.rights ?? undefined,
      })
    : undefined;
  const metadata: PublicationMetadata | null = metadataParsed?.success ? metadataParsed.data : null;

  const recordForPlan = {
    slug: r.slug, title: r.title, subtitle: r.subtitle ?? undefined,
    series: r.series ?? undefined, volume: r.volume ?? undefined,
    status: r.status, version: r.version, profile: r.profile,
    lastUpdated: r.last_updated, author: r.author,
  };
  const exportPlan = enriched ? planExports(recordForPlan, enriched) : undefined;
  const errCount = enriched?.report.issues.filter((i) => i.severity === "error").length ?? 0;
  const warnCount = enriched?.report.issues.filter((i) => i.severity === "warning").length ?? 0;

  const readiness = computeReadiness({
    slug, status: r.status, profileId: r.profile, metadata, assets,
    exportPlan, validationErrorCount: errCount, validationWarnCount: warnCount,
  });
  const adapters = metadata ? adaptForAllTargets(metadata) : [];
  const exportValidations = enriched && profile
    ? validateAllExports(enriched.doc, profile.behavior.export.targets)
    : [];

  const [busy, setBusy] = React.useState(false);
  const enqueueFn = enqueueDistribution;
  const updateFn = updateDistributionEntry;
  const removeFn = removeDistributionEntry;

  async function handleEnqueue(target: DistributionTarget) {
    setBusy(true);
    try {
      const adapter = adapters.find((a) => a.target === target);
      const blockers = adapter?.issues.filter((i) => i.level === "error").map((i) => `${i.field}: ${i.message}`) ?? [];
      await enqueueFn({ data: { slug, target, blockers } });
      router.invalidate();
    } finally { setBusy(false); }
  }
  async function handleStateChange(id: string, state: QueueRow["state"]) {
    setBusy(true);
    try {
      await updateFn({ data: { id, slug, state } });
      router.invalidate();
    } finally { setBusy(false); }
  }
  async function handleSubmit(id: string) {
    setBusy(true);
    try {
      await updateFn({ data: { id, slug, submitted: true } });
      router.invalidate();
    } finally { setBusy(false); }
  }
  async function handleRemove(id: string) {
    setBusy(true);
    try { await removeFn({ data: { id } }); router.invalidate(); }
    finally { setBusy(false); }
  }

  function handleDownloadPackage() {
    if (!lib || !profile || !metadata || !enriched) return;
    const art = buildPackage({
      slug, doc: enriched.doc, metadata, profile, assets, readiness,
    });
    downloadBytes(art.filename, art.bytes, art.mediaType);
  }
  function handleDownloadStorePackage(target: DistributionTarget) {
    if (!lib || !profile || !metadata || !enriched) return;
    const art = buildStorePackage({
      slug, doc: enriched.doc, metadata, profile, assets, readiness,
    }, target);
    downloadBytes(art.filename, art.bytes, art.mediaType);
  }

  return (
    <main style={{ minHeight: "100dvh", background: "var(--am-chapter-bg)", color: "var(--am-chapter-ink)", paddingBlock: "var(--am-silence-lg)", paddingInline: "var(--am-space-6)" }}>
      <div style={{ maxWidth: 1100, marginInline: "auto" }}>
        <div style={{ fontFamily: "var(--am-font-ui)", letterSpacing: "var(--am-tracking-widest)", textTransform: "uppercase", fontSize: "var(--am-sourcenote-size)", color: "var(--am-color-ink-500)", marginBlockEnd: "var(--am-space-5)" }}>
          ASCEND / Publications / {slug} · distribute
        </div>
        <h1 style={{ fontFamily: "var(--am-font-display)", fontSize: "var(--am-type-700)", margin: 0 }}>
          {r.title}
        </h1>
        <nav style={{ display: "flex", gap: "var(--am-space-4)", marginBlockStart: "var(--am-space-3)", marginBlockEnd: "var(--am-silence-sm)", fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-200)" }}>
          <Link to="/ascend/publications">← All publications</Link>
          <Link to="/ascend/publications/$slug" params={{ slug }}>Authoring</Link>
          <Link to="/ascend/reader/$slug" params={{ slug }}>Reader</Link>
        </nav>

        {/* Readiness summary */}
        <section style={{ marginBlockEnd: "var(--am-silence-md)", padding: "var(--am-space-5)", border: "1px solid var(--am-color-ink-200)", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--am-space-4)" }}>
            <h2 style={{ fontFamily: "var(--am-font-display)", margin: 0 }}>Readiness</h2>
            <div style={{ fontSize: "var(--am-type-700)", fontFamily: "var(--am-font-display)", color: readiness.ready ? "#15803d" : "#b45309" }}>
              {readiness.percent}%
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "var(--am-space-3)", marginBlockStart: "var(--am-space-4)" }}>
            {readiness.signals.map((s) => (
              <div key={s.id} style={{ padding: "var(--am-space-3)", border: "1px solid var(--am-color-ink-200)", borderRadius: 8 }}>
                <div style={{ fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-200)", color: "var(--am-color-ink-500)" }}>{s.label}</div>
                <div style={{ fontFamily: "var(--am-font-display)", fontSize: "var(--am-type-500)" }}>{Math.round(s.score * 100)}%</div>
                {s.blockers.length > 0 && (
                  <ul style={{ paddingInlineStart: 16, color: "#b91c1c", fontSize: "var(--am-type-100)" }}>
                    {s.blockers.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {readiness.blockers.length > 0 && (
            <details style={{ marginBlockStart: "var(--am-space-3)" }}>
              <summary>{readiness.blockers.length} blocker(s)</summary>
              <ul>{readiness.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </details>
          )}
          {readiness.recommendations.length > 0 && (
            <details style={{ marginBlockStart: "var(--am-space-2)" }}>
              <summary>{readiness.recommendations.length} recommendation(s)</summary>
              <ul>{readiness.recommendations.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </details>
          )}
          <div style={{ marginBlockStart: "var(--am-space-4)", display: "flex", gap: "var(--am-space-3)", flexWrap: "wrap" }}>
            <button type="button" style={btn} onClick={handleDownloadPackage} disabled={!lib || !metadata || !profile}>
              ⬇ Full publication package (.zip)
            </button>
          </div>
        </section>

        {/* Per-platform reports */}
        <section style={{ marginBlockEnd: "var(--am-silence-md)" }}>
          <h2 style={{ fontFamily: "var(--am-font-display)", marginBlockEnd: "var(--am-space-3)" }}>Platform readiness</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Platform","Status","Issues","Submission","Action"].map((h) => <th key={h} style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>
              {DISTRIBUTION_TARGETS.map((t) => {
                const a = adapters.find((x) => x.target === t);
                const errs = a?.issues.filter((i) => i.level === "error") ?? [];
                const warns = a?.issues.filter((i) => i.level === "warning") ?? [];
                const status = !metadata ? "blocked" : errs.length ? "blocked" : warns.length ? "warning" : "ready";
                const color = status === "ready" ? "#15803d" : status === "warning" ? "#b45309" : "#b91c1c";
                return (
                  <tr key={t}>
                    <td style={cell}><strong>{t}</strong></td>
                    <td style={cell}><span style={{ color }}>{status.toUpperCase()}</span></td>
                    <td style={cell}>
                      {errs.length === 0 && warns.length === 0 ? "—" : (
                        <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                          {errs.slice(0, 3).map((i, k) => <li key={`e${k}`} style={{ color: "#b91c1c" }}>{i.message}</li>)}
                          {warns.slice(0, 2).map((i, k) => <li key={`w${k}`} style={{ color: "#b45309" }}>{i.message}</li>)}
                        </ul>
                      )}
                    </td>
                    <td style={cell}>
                      <button type="button" style={btn} disabled={!metadata || !profile} onClick={() => handleDownloadStorePackage(t)}>
                        ⬇ Submission package
                      </button>
                    </td>
                    <td style={cell}>
                      <button type="button" style={btn} disabled={busy} onClick={() => handleEnqueue(t)}>
                        Queue
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Export validation */}
        {exportValidations.length > 0 && (
          <section style={{ marginBlockEnd: "var(--am-silence-md)" }}>
            <h2 style={{ fontFamily: "var(--am-font-display)" }}>Export validation</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Target","Size","Status","Issues"].map((h) => <th key={h} style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {exportValidations.map((v) => (
                  <tr key={v.target}>
                    <td style={cell}>{v.target}</td>
                    <td style={cell}>{v.artifactSize ? `${Math.round(v.artifactSize / 1024)} KB` : "—"}</td>
                    <td style={cell} >
                      <span style={{ color: v.ok ? "#15803d" : "#b91c1c" }}>{v.ok ? "OK" : "BLOCKED"}</span>
                    </td>
                    <td style={cell}>
                      <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                        {v.issues.map((i, k) => (
                          <li key={k} style={{ color: i.level === "error" ? "#b91c1c" : i.level === "warning" ? "#b45309" : "var(--am-color-ink-500)" }}>
                            <code>{i.code}</code> {i.message}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Queue */}
        <section>
          <h2 style={{ fontFamily: "var(--am-font-display)" }}>Distribution queue</h2>
          {queue.length === 0 ? (
            <p style={{ fontFamily: "var(--am-font-ui)", color: "var(--am-color-ink-500)" }}>Queue is empty. Use "Queue" buttons above to add submissions.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Target","State","Blockers","Created","Submitted","Actions"].map((h) => <th key={h} style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.id}>
                    <td style={cell}>{q.target}</td>
                    <td style={cell}>{q.state}</td>
                    <td style={cell}>{q.blockers.length === 0 ? "—" : q.blockers.length}</td>
                    <td style={cell}>{new Date(q.created_at).toLocaleString()}</td>
                    <td style={cell}>{q.submitted_at ? new Date(q.submitted_at).toLocaleString() : "—"}</td>
                    <td style={cell}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {q.state !== "processing" && <button type="button" style={btn} disabled={busy} onClick={() => handleStateChange(q.id, "processing")}>Process</button>}
                        {q.state !== "ready" && <button type="button" style={btn} disabled={busy} onClick={() => handleStateChange(q.id, "ready")}>Ready</button>}
                        {q.state !== "submitted" && <button type="button" style={btn} disabled={busy} onClick={() => handleSubmit(q.id)}>Submit</button>}
                        <button type="button" style={btn} disabled={busy} onClick={() => handleRemove(q.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
