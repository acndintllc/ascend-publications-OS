import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listAllManuscripts } from "@/lib/manuscripts.functions";

type Row = Awaited<ReturnType<typeof listAllManuscripts>>[number];

export const Route = createFileRoute("/_authenticated/ascend/admin/manuscripts")({
  head: () => ({
    meta: [
      { title: "Manuscript Tracking — Ascend Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async (): Promise<{ rows: Row[]; error: string | null }> => {
    try {
      const rows = await listAllManuscripts();
      return { rows, error: null };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : String(e) };
    }
  },
  component: AdminManuscripts,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";
const RED = "#fca5a5";

function AdminManuscripts() {
  const { rows, error } = Route.useLoaderData();
  const staleCount = rows.filter((r) => r.stale).length;

  return (
    <main style={{ padding: "40px 24px", color: FG, maxWidth: 1200, marginInline: "auto" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL }}>
        Ascend / Admin
      </div>
      <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 36, margin: 0 }}>
        Manuscript Tracking
      </h1>
      <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
        Visibility across all user manuscripts. {staleCount} flagged as stale (no activity 14+ days after report).
      </p>
      {error && <div style={{ color: RED, marginTop: 16 }}>{error}</div>}

      <div style={{
        marginTop: 24, borderRadius: 12, border: `1px solid ${LINE}`, background: PANEL, overflowX: "auto",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#050505" }}>
              {["Title", "User", "First Submitted", "Latest v", "Status", "Last Activity", ""].map((h) => (
                <th key={h} style={{
                  textAlign: "left", padding: "12px 16px", color: MUTED,
                  fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                  borderBottom: `1px solid ${LINE}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: MUTED }}>
                No manuscript submissions yet.
              </td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                <td style={{ padding: "12px 16px", color: FG }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {r.title}
                    {r.stale && (
                      <span style={{
                        fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                        padding: "2px 8px", borderRadius: 999, border: `1px solid ${RED}`, color: RED,
                      }}>Stale</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", color: MUTED }}>{r.email ?? r.owner_id.slice(0, 8)}</td>
                <td style={{ padding: "12px 16px", color: MUTED }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "12px 16px", color: TEAL }}>v{r.current_version}</td>
                <td style={{ padding: "12px 16px", color: FG }}>{r.status.replace(/_/g, " ")}</td>
                <td style={{ padding: "12px 16px", color: MUTED }}>
                  {new Date(r.last_activity_at).toLocaleString()}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <Link to="/ascend/manuscripts/$id" params={{ id: r.id }} style={{
                    color: TEAL, fontSize: 12, textDecoration: "none",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
