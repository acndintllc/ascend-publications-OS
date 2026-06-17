import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import {
  listPublications,
  registerUploadedPublication,
} from "@/lib/publication.functions";

type PubEntry = Awaited<ReturnType<typeof listPublications>>[number];

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Dashboard — Ascend Publishing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async (): Promise<{ pubs: PubEntry[]; error: string | null }> => {
    try {
      const pubs = await listPublications();
      return { pubs, error: null };
    } catch (e) {
      return { pubs: [], error: e instanceof Error ? e.message : String(e) };
    }
  },
  component: UserDashboard,
});

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

function UserDashboard() {
  const { user, isOwner } = Route.useRouteContext();
  const { pubs, error } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const register = useServerFn(registerUploadedPublication);

  const [title, setTitle] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) {
      setMsg("Title and a .md or .docx file are required.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const name = file.name.toLowerCase();
      const format: "md" | "docx" =
        name.endsWith(".docx") ? "docx" : "md";
      const contentBase64 = await fileToBase64(file);
      const res = await register({
        data: {
          title: title.trim(),
          manuscript: { filename: file.name, format, contentBase64 },
        },
      });
      setMsg(`Registered "${title}" (${res.slug}).`);
      setTitle("");
      setFile(null);
      router.invalidate();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

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
      <div style={{ maxWidth: 920, marginInline: "auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBlockEnd: 32 }}>
          <div>
            <h1 style={{ fontFamily: "Fraunces Variable, serif", fontSize: 32, margin: 0 }}>
              {isOwner ? "Owner Workspace" : "Your Dashboard"}
            </h1>
            <p style={{ color: "#888", fontSize: 13, marginBlock: "4px 0" }}>{user.email}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isOwner && (
              <Link
                to="/ascend/publications"
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #2a2a2a",
                  background: "#fff",
                  color: "#000",
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Owner Console →
              </Link>
            )}
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
          </div>
        </header>

        {/* Upload card */}
        <section
          style={{
            padding: 24,
            borderRadius: 12,
            border: "1px solid #1f1f1f",
            background: "#111",
            marginBlockEnd: 32,
          }}
        >
          <h2 style={{ fontSize: 18, margin: 0, marginBlockEnd: 12 }}>Upload a Manuscript</h2>
          <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="text"
              placeholder="Working title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#fff" }}
            />
            <input
              type="file"
              accept=".md,.markdown,.txt,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              style={{ color: "#a0a0a0", fontSize: 13 }}
            />
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                background: "#fff",
                color: "#000",
                fontWeight: 600,
                cursor: "pointer",
                opacity: busy ? 0.6 : 1,
                alignSelf: "flex-start",
              }}
            >
              {busy ? "Uploading…" : "Register manuscript"}
            </button>
            {msg && <div style={{ color: msg.startsWith("Registered") ? "#86efac" : "#fca5a5", fontSize: 12 }}>{msg}</div>}
          </form>
        </section>

        {/* Publications list */}
        <section>
          <h2 style={{ fontSize: 18, margin: 0, marginBlockEnd: 12 }}>
            {isOwner ? "All Publications" : "My Publications"}
          </h2>
          {error && <div style={{ color: "#fca5a5", fontSize: 13, marginBlockEnd: 12 }}>{error}</div>}
          {pubs.length === 0 ? (
            <p style={{ color: "#666", fontSize: 13 }}>
              You haven't registered any manuscripts yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {pubs.map((entry: PubEntry) => { const record = entry.record; return (
                <li
                  key={record.slug}
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    border: "1px solid #1f1f1f",
                    background: "#111",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{record.title}</div>
                    <div style={{ color: "#888", fontSize: 12 }}>
                      {record.author} · {record.status} · v{record.version}
                    </div>
                    <code style={{ fontSize: 11, color: "#555" }}>{record.slug}</code>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link
                      to="/ascend/reader/$slug"
                      params={{ slug: record.slug }}
                      style={{ fontSize: 12, color: "#a0a0a0", textDecoration: "underline" }}
                    >
                      read
                    </Link>
                    <Link
                      to="/ascend/validate/$slug"
                      params={{ slug: record.slug }}
                      style={{ fontSize: 12, color: "#a0a0a0", textDecoration: "underline" }}
                    >
                      validate
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!isOwner && (
          <p style={{ color: "#666", fontSize: 12, marginBlockStart: 32 }}>
            Owner-only admin pages (vendor settings, ISBN management, governance, KDP) are
            not available from this dashboard.
          </p>
        )}

        <p style={{ marginBlockStart: 24 }}>
          <Link to="/" style={{ color: "#888", fontSize: 12 }}>← Back to landing</Link>
        </p>
      </div>
    </main>
  );
}
