import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublication, listPackageVersions } from "@/lib/publication.functions";

export const Route = createFileRoute("/_authenticated/ascend/packages/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Package` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async ({ params }) => {
    try {
      const [detail, versions] = await Promise.all([
        getPublication({ data: { slug: params.slug } }),
        listPackageVersions({ data: { slug: params.slug } }),
      ]);
      return { detail, versions, slug: params.slug };
    } catch {
      throw notFound();
    }
  },
  notFoundComponent: () => (
    <main style={{ padding: 60, color: "#a0a0a0", textAlign: "center" }}>
      <p>Package not found.</p>
      <Link to="/dashboard" style={{ color: "#5cbdb9" }}>← Dashboard</Link>
    </main>
  ),
  errorComponent: ({ error, reset }) => (
    <main style={{ padding: 60, color: "#fca5a5" }}>
      <p>Error: {error.message}</p>
      <button onClick={reset}>Retry</button>
    </main>
  ),
  component: PackageDetailRoute,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

function PackageDetailRoute() {
  const { detail, versions, slug } = Route.useLoaderData();
  const r = detail.record as typeof detail.record & {
    current_version?: number | null;
    last_activity_at?: string | null;
    filter_report?: unknown;
    submission_status?: string | null;
  };
  const filter = (r.filter_report ?? null) as null | {
    ready?: boolean; score?: number; scoreWithRecommended?: number;
    missingRequired?: string[]; missingRecommended?: string[];
    missingMeta?: string[]; warningsMeta?: string[]; blockers?: string[];
    hasCover?: boolean; computed_at?: string;
  };

  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <main style={{ padding: "40px 24px", color: FG, maxWidth: 960, marginInline: "auto" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL }}>
        Package · v{r.current_version ?? 1}
      </div>
      <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", fontSize: 34, margin: "4px 0 0", color: GOLD }}>
        {r.title}
      </h1>
      <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>
        {r.author} · <code>{slug}</code>
        {r.last_activity_at && (
          <> · last activity {new Date(r.last_activity_at).toLocaleString()}</>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <Link to="/ascend/submit" search={{ slug }} style={btnGold}>
          ✎ Update Package
        </Link>
        <Link to="/dashboard" style={btnGhost}>← Dashboard</Link>
      </div>

      <section style={card}>
        <h2 style={h2}>Latest Filter Report</h2>
        {filter ? (
          <>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
              <Pill ok={!!filter.ready} label={filter.ready ? "Ready" : "Not ready"} />
              <span style={{ color: MUTED, fontSize: 12 }}>
                Required {Math.round((filter.score ?? 0) * 100)}% · With recommended {Math.round((filter.scoreWithRecommended ?? 0) * 100)}%
              </span>
              {filter.computed_at && (
                <span style={{ color: MUTED, fontSize: 11 }}>
                  computed {new Date(filter.computed_at).toLocaleString()}
                </span>
              )}
            </div>
            <Issues label="Missing required assets" items={filter.missingRequired ?? []} tone="error" />
            <Issues label="Missing recommended" items={filter.missingRecommended ?? []} tone="warn" />
            <Issues label="Missing metadata" items={filter.missingMeta ?? []} tone="warn" />
            {!filter.hasCover && (
              <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 12 }}>· No active cover asset</div>
            )}
          </>
        ) : (
          <p style={{ color: MUTED, fontSize: 13 }}>No filter report yet.</p>
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>Version History · {versions.length}</h2>
        {versions.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 13 }}>No saved versions yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {versions.map((v: typeof versions[number]) => {
              const isOpen = openId === v.id;
              const fr = (v.filter_report ?? null) as null | {
                ready?: boolean; score?: number;
              };
              return (
                <li key={v.id} style={{ border: `1px solid ${LINE}`, borderRadius: 8, background: "#000" }}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : v.id)}
                    style={{
                      width: "100%", padding: "12px 14px", background: "transparent",
                      color: FG, border: "none", cursor: "pointer", textAlign: "left",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                    }}
                  >
                    <span style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: GOLD, fontWeight: 600 }}>v{v.version}</span>
                      <span style={{ color: MUTED, fontSize: 12 }}>{new Date(v.created_at).toLocaleString()}</span>
                      {fr && (
                        <Pill ok={!!fr.ready} label={fr.ready ? "ready" : "not ready"} small />
                      )}
                    </span>
                    <span style={{ color: TEAL, fontSize: 11 }}>{isOpen ? "Hide ▴" : "Details ▾"}</span>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${LINE}`, padding: 14, display: "grid", gap: 10 }}>
                      <details>
                        <summary style={{ color: TEAL, fontSize: 12, cursor: "pointer" }}>filter_report</summary>
                        <pre style={preStyle}>{JSON.stringify(v.filter_report, null, 2)}</pre>
                      </details>
                      <details>
                        <summary style={{ color: TEAL, fontSize: 12, cursor: "pointer" }}>snapshot</summary>
                        <pre style={preStyle}>{JSON.stringify(v.snapshot, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  marginTop: 28, padding: 22, borderRadius: 12,
  border: `1px solid ${LINE}`, background: PANEL,
};
const h2: React.CSSProperties = {
  fontFamily: "Fraunces Variable, Fraunces, serif",
  fontSize: 20, margin: "0 0 10px", color: FG,
};
const btnGold: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 8, border: "none",
  background: GOLD, color: "#111", fontWeight: 700, cursor: "pointer",
  fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
  textDecoration: "none", display: "inline-block",
};
const btnGhost: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 8, border: `1px solid ${LINE}`,
  background: "transparent", color: FG, fontSize: 12,
  letterSpacing: "0.08em", textTransform: "uppercase",
  textDecoration: "none", display: "inline-block",
};
const preStyle: React.CSSProperties = {
  margin: 0, padding: 10, background: "#000", border: `1px solid ${LINE}`,
  borderRadius: 6, color: MUTED, fontSize: 11, overflow: "auto", maxHeight: 320,
};

function Pill({ ok, label, small }: { ok: boolean; label: string; small?: boolean }) {
  const c = ok ? "#86efac" : "#fca5a5";
  return (
    <span style={{
      fontSize: small ? 9 : 10, letterSpacing: "0.14em", textTransform: "uppercase",
      padding: small ? "2px 7px" : "3px 10px", borderRadius: 999,
      border: `1px solid ${c}`, color: c,
    }}>{label}</span>
  );
}

function Issues({ label, items, tone }: { label: string; items: string[]; tone: "error" | "warn" }) {
  if (!items.length) return null;
  const c = tone === "error" ? "#fca5a5" : "#e8c07a";
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {items.map((m) => (
          <span key={m} style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 4,
            color: c, border: `1px solid ${c}`,
          }}>{m}</span>
        ))}
      </div>
    </div>
  );
}
