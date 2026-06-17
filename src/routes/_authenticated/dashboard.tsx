import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Dashboard — Ascend Publishing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UserDashboard,
});

function UserDashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0a0a0a",
        color: "#fff",
        padding: "48px 24px",
        fontFamily: "Inter Tight Variable, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, marginInline: "auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBlockEnd: 32 }}>
          <div>
            <h1 style={{ fontFamily: "Fraunces Variable, serif", fontSize: 32, margin: 0 }}>Your Dashboard</h1>
            <p style={{ color: "#888", fontSize: 13, marginBlock: "4px 0" }}>{user.email}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #2a2a2a",
              background: "transparent",
              color: "#a0a0a0",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Sign out
          </button>
        </header>

        <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <Card title="My Publications" desc="Publications you've registered." disabled />
          <Card title="Upload Manuscript" desc="Start a new project from a .md or .docx file." disabled />
          <Card title="My Assets" desc="Covers and supporting files for your manuscripts." disabled />
          <Card title="My Downloads" desc="Generated artifacts ready to publish." disabled />
          <Card title="Account Settings" desc="Email, password, and profile." disabled />
        </section>

        <p style={{ color: "#666", fontSize: 12, marginBlockStart: 32 }}>
          Creator tools are launching soon. Owner-only admin pages (vendor settings,
          ISBN management, governance, KDP) are not available from this dashboard.
        </p>

        <p style={{ marginBlockStart: 24 }}>
          <Link to="/" style={{ color: "#888", fontSize: 12 }}>← Back to landing</Link>
        </p>
      </div>
    </main>
  );
}

function Card({ title, desc, disabled }: { title: string; desc: string; disabled?: boolean }) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 12,
        border: "1px solid #1f1f1f",
        background: "#111",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBlockEnd: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#999" }}>{desc}</div>
      {disabled && <div style={{ fontSize: 11, color: "#666", marginBlockStart: 10 }}>Coming soon</div>}
    </div>
  );
}
