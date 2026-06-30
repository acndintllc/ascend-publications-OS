import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminNav } from "@/components/ascend/admin-nav";
import { listSubmissionQueue } from "@/lib/publication.functions";
import { listAllManuscripts } from "@/lib/manuscripts.functions";

export const Route = createFileRoute("/_authenticated/ascend/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Ascend Publishing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async () => {
    const [queue, manuscripts] = await Promise.all([
      listSubmissionQueue().catch(() => []),
      listAllManuscripts().catch(() => []),
    ]);
    return { queue, manuscripts };
  },
  component: AdminDashboard,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

function AdminDashboard() {
  const { queue, manuscripts } = Route.useLoaderData();
  const pendingPackages = (queue as Array<{ record: { submission_status: string } }>)
    .filter((r) => r.record.submission_status === "submitted").length;
  const totalPackages = queue.length;
  const staleManuscripts = (manuscripts as Array<{ stale: boolean }>).filter((m) => m.stale).length;
  const totalManuscripts = manuscripts.length;

  return (
    <>
      <AdminNav />
      <main style={{ padding: "40px 24px", color: FG, maxWidth: 1100, marginInline: "auto" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL }}>
          Ascend / Admin
        </div>
        <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 36, margin: "4px 0 0" }}>
          Admin Dashboard
        </h1>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
          Operational overview across all creator submissions.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 28 }}>
          <Card title="Package Queue" big={`${pendingPackages}`} sub={`${totalPackages} total · ${pendingPackages} awaiting review`} to="/ascend/admin/queue" />
          <Card title="Manuscript Tracking" big={`${totalManuscripts}`} sub={`${staleManuscripts} flagged stale`} to="/ascend/admin/manuscripts" />
        </div>

        <section style={card}>
          <h2 style={h2}>Quick Links</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <li><Link to="/ascend/admin/queue" style={link}>→ Review submission queue</Link></li>
            <li><Link to="/ascend/admin/manuscripts" style={link}>→ Manuscript tracking & versions</Link></li>
            <li><Link to="/ascend/publications" style={link}>→ Owner publications workspace</Link></li>
            <li><Link to="/dashboard" style={link}>← Return to user dashboard</Link></li>
          </ul>
        </section>
      </main>
    </>
  );
}

function Card({ title, big, sub, to }: { title: string; big: string; sub: string; to: string }) {
  return (
    <Link to={to} style={{
      display: "block", textDecoration: "none", padding: 22, borderRadius: 12,
      border: `1px solid ${LINE}`, background: PANEL, color: FG,
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: MUTED }}>{title}</div>
      <div style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 44, lineHeight: 1, marginTop: 8 }}>{big}</div>
      <div style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>{sub}</div>
    </Link>
  );
}

const card: React.CSSProperties = {
  marginTop: 28, padding: 22, borderRadius: 12, border: `1px solid ${LINE}`, background: PANEL,
};
const h2: React.CSSProperties = {
  fontFamily: "Fraunces Variable, Fraunces, serif", fontSize: 20, margin: "0 0 12px", color: FG,
};
const link: React.CSSProperties = {
  color: TEAL, textDecoration: "none", fontSize: 13,
};
