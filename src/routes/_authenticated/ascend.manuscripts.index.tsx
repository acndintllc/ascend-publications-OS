import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listMyManuscripts } from "@/lib/manuscripts.functions";

type Row = Awaited<ReturnType<typeof listMyManuscripts>>[number];

export const Route = createFileRoute("/_authenticated/ascend/manuscripts/")({
  head: () => ({
    meta: [
      { title: "My Manuscripts — Ascend Publishing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async (): Promise<{ rows: Row[]; error: string | null }> => {
    try {
      const rows = await listMyManuscripts();
      return { rows, error: null };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : String(e) };
    }
  },
  component: ManuscriptsIndex,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

const STATUS_LABEL: Record<string, string> = {
  validation_running: "Validation Running",
  report_ready: "Report Ready",
  revision_submitted: "Revision Submitted",
};
const STATUS_COLOR: Record<string, string> = {
  validation_running: GOLD,
  report_ready: TEAL,
  revision_submitted: "#a78bfa",
};

function ManuscriptsIndex() {
  const { rows, error } = Route.useLoaderData();
  return (
    <main style={{ padding: "40px 24px", color: FG, maxWidth: 1040, marginInline: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL }}>
            Ascend / My Manuscripts
          </div>
          <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 36, margin: 0 }}>
            My Manuscripts
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
            Validate, review your report, and resubmit revisions. Manuscripts never disappear from this list.
          </p>
        </div>
        <Link to="/ascend/manuscripts/new" style={btnGold}>
          + Submit Manuscript
        </Link>
      </div>

      {error && <div style={{ color: "#fca5a5", marginTop: 16 }}>{error}</div>}

      <section style={{ marginTop: 28 }}>
        {rows.length === 0 ? (
          <div style={{
            padding: 32, borderRadius: 12, border: `1px dashed ${LINE}`,
            color: MUTED, fontSize: 14, textAlign: "center",
          }}>
            No manuscripts yet. Submit your first one to get a validation report.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {rows.map((r) => {
              const color = STATUS_COLOR[r.status] ?? MUTED;
              return (
                <li key={r.id} style={{
                  padding: 18, borderRadius: 10, border: `1px solid ${LINE}`, background: PANEL,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: FG }}>{r.title}</span>
                      <span style={{
                        fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                        padding: "2px 8px", borderRadius: 999, border: `1px solid ${color}`, color,
                      }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      <span style={{ fontSize: 11, color: MUTED }}>v{r.current_version}</span>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                      Last activity {new Date(r.last_activity_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                    <Link to="/ascend/manuscripts/$id" params={{ id: r.id }} style={linkBtn}>
                      View Report →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

const btnGold: React.CSSProperties = {
  padding: "11px 20px", borderRadius: 8, border: "none", background: GOLD,
  color: "#111", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em",
  textTransform: "uppercase", textDecoration: "none", display: "inline-block",
};
const linkBtn: React.CSSProperties = {
  fontSize: 12, color: TEAL, textDecoration: "none",
  letterSpacing: "0.08em", textTransform: "uppercase",
};
