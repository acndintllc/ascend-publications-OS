import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listSubmissionQueue, reviewSubmission } from "@/lib/publication.functions";

interface QueueRow {
  record: {
    slug: string; title: string; author: string; profile: string;
    owner_id: string | null; submission_status:
      "draft"|"submitted"|"needs_changes"|"approved"|"in_production"|"ready_for_distribution"|"published";
    submitted_at: string | null; review_notes: string | null; last_updated: string;
  };
  creatorEmail: string | null;
  readiness: {
    score: number; scoreWithRecommended: number; ready: boolean;
    missingRequired: string[]; missingRecommended: string[];
  };
  missingMeta: string[];
  hasCover: boolean;
}

export const Route = createFileRoute("/_authenticated/ascend/admin/queue")({
  head: () => ({
    meta: [
      { title: "Submission Queue — Ascend Publishing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async (): Promise<{ rows: QueueRow[]; error: string | null }> => {
    try {
      const rows = await listSubmissionQueue();
      return { rows, error: null };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : String(e) };
    }
  },
  component: AdminQueue,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

const STATUS_COLORS: Record<string, string> = {
  draft: MUTED,
  submitted: GOLD,
  needs_changes: "#fca5a5",
  approved: TEAL,
  in_production: "#a78bfa",
  ready_for_distribution: "#86efac",
  published: TEAL,
};

function AdminQueue() {
  const { isOwner } = Route.useRouteContext();
  const { rows, error } = Route.useLoaderData();
  const router = useRouter();
  const review = useServerFn(reviewSubmission);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  if (!isOwner) {
    return (
      <main style={{ padding: 60, color: FG, textAlign: "center" }}>
        <h1 style={{ color: GOLD }}>Owner-only</h1>
        <p style={{ color: MUTED }}>This is the ASCEND admin review queue.</p>
        <Link to="/dashboard" style={{ color: TEAL }}>← Back to dashboard</Link>
      </main>
    );
  }

  async function act(slug: string, action: QueueRow["record"]["submission_status"]) {
    const notes = action === "needs_changes"
      ? window.prompt("What needs changing? (visible to creator)") ?? undefined
      : undefined;
    if (action === "needs_changes" && !notes) return;
    setBusy(slug);
    setMsg(null);
    try {
      await review({ data: { slug, action, notes: notes ?? null } });
      setMsg(`${slug}: ${action}`);
      router.invalidate();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main style={{ padding: "40px 24px", color: FG }}>
      <div style={{ maxWidth: 1200, marginInline: "auto" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL }}>
          Ascend / Admin
        </div>
        <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", fontSize: 38, margin: 0, color: GOLD }}>
          Submission Queue
        </h1>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
          {rows.length} package{rows.length === 1 ? "" : "s"} awaiting review or in production.
        </p>

        {error && <div style={{ color: "#fca5a5", marginTop: 16 }}>{error}</div>}
        {msg && <div style={{ color: TEAL, fontSize: 12, marginTop: 12 }}>{msg}</div>}

        {rows.length === 0 ? (
          <div style={{ marginTop: 32, padding: 40, border: `1px dashed ${LINE}`, borderRadius: 12, textAlign: "center", color: MUTED }}>
            No submissions in the queue.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "grid", gap: 14 }}>
            {rows.map((r) => {
              const s = r.record.submission_status;
              const color = STATUS_COLORS[s] ?? MUTED;
              const missing: string[] = [
                ...(r.hasCover ? [] : ["cover"]),
                ...r.readiness.missingRequired.map((k) => `asset:${k}`),
                ...r.missingMeta.map((m) => `meta:${m}`),
              ];
              const readiness = Math.round(r.readiness.scoreWithRecommended * 100);
              return (
                <li key={r.record.slug} style={{
                  padding: 22, borderRadius: 12, border: `1px solid ${LINE}`, background: PANEL,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                          padding: "3px 10px", borderRadius: 999, border: `1px solid ${color}`, color,
                        }}>
                          {s.replace(/_/g, " ")}
                        </span>
                        <span style={{ fontSize: 11, color: MUTED }}>
                          Readiness {readiness}%
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8, color: FG }}>
                        {r.record.title}
                      </div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                        {r.record.author} · {r.creatorEmail ?? "unknown@—"} · <code>{r.record.slug}</code>
                      </div>
                      {r.record.submitted_at && (
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                          Submitted {new Date(r.record.submitted_at).toLocaleString()}
                        </div>
                      )}
                      {r.record.review_notes && (
                        <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 8 }}>
                          Last note: {r.record.review_notes}
                        </div>
                      )}
                      {missing.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {missing.map((m) => (
                            <span key={m} style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 4,
                              background: "rgba(252,165,165,0.08)", color: "#fca5a5",
                              border: "1px solid rgba(252,165,165,0.3)",
                            }}>missing {m}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                      <Link to="/ascend/publications/$slug" params={{ slug: r.record.slug }}
                        style={miniBtnGold}>Open Package →</Link>
                      <Link to="/ascend/reader/$slug" params={{ slug: r.record.slug }}
                        style={miniBtnGhost}>Read</Link>
                      <Link to="/ascend/validate/$slug" params={{ slug: r.record.slug }}
                        style={miniBtnGhost}>Audit</Link>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
                    {(["approved","needs_changes","in_production","ready_for_distribution","published"] as const).map((a) => (
                      <button key={a} disabled={busy === r.record.slug || s === a}
                        onClick={() => act(r.record.slug, a)}
                        style={s === a ? { ...actionBtn, opacity: 0.4 } : actionBtn}>
                        {a.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

const miniBtnGold: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: `1px solid ${GOLD}`,
  background: "transparent", color: GOLD, fontSize: 10,
  letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none",
  textAlign: "center",
};
const miniBtnGhost: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: `1px solid ${LINE}`,
  background: "transparent", color: TEAL, fontSize: 10,
  letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none",
  textAlign: "center",
};
const actionBtn: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 6, border: `1px solid ${LINE}`,
  background: "transparent", color: FG, fontSize: 10, cursor: "pointer",
  letterSpacing: "0.08em", textTransform: "uppercase",
};
