import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getManuscriptDetail, resubmitManuscript } from "@/lib/manuscripts.functions";

type Detail = Awaited<ReturnType<typeof getManuscriptDetail>>;

export const Route = createFileRoute("/_authenticated/ascend/manuscripts/$id")({
  head: () => ({
    meta: [
      { title: "Manuscript Detail — Ascend Publishing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async ({ params }): Promise<{ detail: Detail | null; error: string | null }> => {
    try {
      const detail = await getManuscriptDetail({ data: { manuscriptId: params.id } });
      return { detail, error: null };
    } catch (e) {
      return { detail: null, error: e instanceof Error ? e.message : String(e) };
    }
  },
  component: ManuscriptDetail,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";
const RED = "#fca5a5";

interface Issue { severity: string; code: string; message: string }
interface Report {
  issues?: Issue[];
  unresolvedCitations?: string[];
  orphanVeraAnchors?: number[];
  rhythm?: Array<{ index: number; title: string; words: number; paragraphs: number }>;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function ManuscriptDetail() {
  const { detail, error } = Route.useLoaderData();
  const router = useRouter();
  const resubmit = useServerFn(resubmitManuscript);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  if (error || !detail) {
    return (
      <main style={{ padding: 40, color: FG }}>
        <div style={{ color: RED }}>{error ?? "Not found"}</div>
        <Link to="/ascend/manuscripts" style={{ color: TEAL }}>← Back</Link>
      </main>
    );
  }

  const parent = detail.manuscript as {
    id: string; title: string; current_version: number; status: string; last_activity_at: string;
  };
  const versions = detail.versions as Array<{
    id: string; version: number; filename: string; format: string;
    report: Report; status: string; created_at: string;
  }>;
  const latest = versions[0];

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setMsg("Pick a file first"); return; }
    setBusy(true); setMsg(null);
    try {
      const name = file.name.toLowerCase();
      const format: "md" | "docx" | "pdf" =
        name.endsWith(".docx") ? "docx" : name.endsWith(".pdf") ? "pdf" : "md";
      const contentBase64 = await fileToBase64(file);
      await resubmit({ data: { manuscriptId: parent.id, filename: file.name, format, contentBase64 } });
      setFile(null);
      router.invalidate();
    } catch (e2) {
      setMsg(e2 instanceof Error ? e2.message : "Resubmit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: "40px 24px", color: FG, maxWidth: 960, marginInline: "auto" }}>
      <Link to="/ascend/manuscripts" style={{ color: TEAL, fontSize: 12, textDecoration: "none" }}>
        ← My Manuscripts
      </Link>
      <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 32, margin: "8px 0 4px" }}>
        {parent.title}
      </h1>
      <div style={{ color: MUTED, fontSize: 13 }}>
        v{parent.current_version} · {parent.status.replace(/_/g, " ")} · last activity {new Date(parent.last_activity_at).toLocaleString()}
      </div>

      {latest && (
        <section style={{
          marginTop: 28, padding: 24, borderRadius: 12, border: `1px solid ${LINE}`, background: PANEL,
        }}>
          <h2 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", fontSize: 20, margin: 0, marginBottom: 12, color: FG }}>
            Latest Report — v{latest.version}
          </h2>
          <ReportView report={latest.report} />
        </section>
      )}

      <section style={{
        marginTop: 24, padding: 24, borderRadius: 12, border: `1px solid ${LINE}`, background: PANEL,
      }}>
        <h2 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", fontSize: 20, margin: 0, marginBottom: 4, color: FG }}>
          Resubmit a Revision
        </h2>
        <p style={{ color: MUTED, fontSize: 13, margin: 0, marginBottom: 14 }}>
          Upload a new file — this will become v{parent.current_version + 1}.
        </p>
        <form onSubmit={handleResubmit} style={{ display: "grid", gap: 12 }}>
          <input
            type="file"
            accept=".md,.markdown,.txt,.docx,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{
              padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`,
              background: "#000", color: FG, fontSize: 13,
            }}
          />
          {msg && <div style={{ color: RED, fontSize: 13 }}>{msg}</div>}
          <div>
            <button type="submit" disabled={busy || !file} style={{
              padding: "11px 20px", borderRadius: 8, border: "none", background: GOLD,
              color: "#111", fontWeight: 700, cursor: "pointer", fontSize: 12,
              letterSpacing: "0.08em", textTransform: "uppercase",
              opacity: busy || !file ? 0.6 : 1,
            }}>
              {busy ? "Validating…" : "Resubmit"}
            </button>
          </div>
        </form>
      </section>

      {versions.length > 1 && (
        <section style={{ marginTop: 24 }}>
          <button onClick={() => setShowHistory((s) => !s)} style={{
            background: "transparent", border: `1px solid ${LINE}`, color: TEAL,
            padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12,
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {showHistory ? "Hide" : "Show"} version history ({versions.length})
          </button>
          {showHistory && (
            <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 10 }}>
              {versions.map((v) => (
                <li key={v.id} style={{
                  padding: 16, borderRadius: 10, border: `1px solid ${LINE}`, background: PANEL,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <strong style={{ color: GOLD }}>v{v.version}</strong>
                    <span style={{ color: MUTED, fontSize: 12 }}>
                      {v.filename} · {new Date(v.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <ReportView report={v.report} compact />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function ReportView({ report, compact }: { report: Report; compact?: boolean }) {
  const issues = report.issues ?? [];
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Pill color={RED} label={`${errors.length} errors`} />
        <Pill color={GOLD} label={`${warnings.length} warnings`} />
        <Pill color={TEAL} label={`${infos.length} info`} />
        {report.unresolvedCitations && report.unresolvedCitations.length > 0 && (
          <Pill color={RED} label={`${report.unresolvedCitations.length} unresolved citations`} />
        )}
      </div>
      {!compact && issues.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {issues.map((i, idx) => (
            <li key={idx} style={{
              padding: "8px 12px", borderRadius: 6,
              border: `1px solid ${i.severity === "error" ? RED : i.severity === "warning" ? GOLD : LINE}`,
              fontSize: 13, color: FG,
            }}>
              <span style={{
                fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                color: i.severity === "error" ? RED : i.severity === "warning" ? GOLD : TEAL,
                marginRight: 8,
              }}>{i.severity}</span>
              <code style={{ color: MUTED, marginRight: 8 }}>{i.code}</code>
              {i.message}
            </li>
          ))}
        </ul>
      )}
      {!compact && report.rhythm && report.rhythm.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", color: TEAL, fontSize: 12 }}>
            Chapter rhythm ({report.rhythm.length} chapters)
          </summary>
          <ul style={{ marginTop: 8, paddingLeft: 16, color: MUTED, fontSize: 12 }}>
            {report.rhythm.map((c) => (
              <li key={c.index}>{c.title} — {c.words} words, {c.paragraphs} paragraphs</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
      padding: "4px 10px", borderRadius: 999, border: `1px solid ${color}`, color,
    }}>{label}</span>
  );
}
