import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

function UserDashboard() {
  const { user, isOwner } = Route.useRouteContext();
  const { pubs, error } = Route.useLoaderData();
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
      const format: "md" | "docx" = name.endsWith(".docx") ? "docx" : "md";
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
    <main style={{ padding: "40px 24px", color: FG }}>
      <div style={{ maxWidth: 960, marginInline: "auto" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: TEAL,
            marginBottom: 8,
          }}
        >
          {isOwner ? "Ascend / Owner Workspace" : "Ascend / Your Workspace"}
        </div>
        <h1
          style={{
            fontFamily: "Fraunces Variable, Fraunces, serif",
            fontSize: 38,
            margin: 0,
            color: GOLD,
            letterSpacing: "0.01em",
          }}
        >
          {isOwner ? "Owner Console" : "Your Manuscripts"}
        </h1>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
          Signed in as {user.email}
        </p>

        {isOwner && (
          <div style={{ marginTop: 16 }}>
            <Link
              to="/ascend/publications"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: `1px solid ${GOLD}`,
                background: "transparent",
                color: GOLD,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Open Owner Console →
            </Link>
          </div>
        )}

        {/* Upload card */}
        <section
          style={{
            marginTop: 36,
            padding: 28,
            borderRadius: 14,
            border: `1px solid ${LINE}`,
            background: PANEL,
          }}
        >
          <h2
            style={{
              fontFamily: "Fraunces Variable, Fraunces, serif",
              fontSize: 22,
              margin: 0,
              marginBottom: 4,
              color: FG,
            }}
          >
            Upload a Manuscript
          </h2>
          <p style={{ color: MUTED, fontSize: 13, margin: 0, marginBottom: 18 }}>
            Drop in a Markdown or Word document and we'll register it for publication.
          </p>
          <form onSubmit={handleUpload} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
                Working Title
              </span>
              <input
                type="text"
                placeholder="e.g. The Cartographer's Confession"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: `1px solid ${LINE}`,
                  background: "#000000",
                  color: FG,
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
                Manuscript File
              </span>
              <input
                type="file"
                accept=".md,.markdown,.txt,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${LINE}`,
                  background: "#000000",
                  color: FG,
                  fontSize: 13,
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
              <button
                type="submit"
                disabled={busy}
                style={{
                  padding: "12px 22px",
                  borderRadius: 8,
                  border: "none",
                  background: GOLD,
                  color: "#111",
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: busy ? 0.6 : 1,
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {busy ? "Uploading…" : "Register Manuscript"}
              </button>
              {msg && (
                <span style={{ color: msg.startsWith("Registered") ? "#86efac" : "#fca5a5", fontSize: 12 }}>
                  {msg}
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Publications list */}
        <section style={{ marginTop: 36 }}>
          <h2
            style={{
              fontFamily: "Fraunces Variable, Fraunces, serif",
              fontSize: 22,
              margin: 0,
              marginBottom: 14,
              color: FG,
            }}
          >
            {isOwner ? "All Publications" : "My Publications"}
          </h2>
          {error && (
            <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}
          {pubs.length === 0 ? (
            <div
              style={{
                padding: 28,
                borderRadius: 12,
                border: `1px dashed ${LINE}`,
                color: MUTED,
                fontSize: 14,
                textAlign: "center",
              }}
            >
              No manuscripts yet. Upload one above to get started.
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {pubs.map((entry: PubEntry) => {
                const record = entry.record;
                return (
                  <li
                    key={record.slug}
                    style={{
                      padding: 18,
                      borderRadius: 10,
                      border: `1px solid ${LINE}`,
                      background: PANEL,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: FG, fontSize: 15 }}>{record.title}</div>
                      <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                        {record.author} · {record.status} · v{record.version}
                      </div>
                      <code style={{ fontSize: 11, color: MUTED }}>{record.slug}</code>
                    </div>
                    <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                      <Link
                        to="/ascend/reader/$slug"
                        params={{ slug: record.slug }}
                        style={{ fontSize: 12, color: TEAL, textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase" }}
                      >
                        Read →
                      </Link>
                      <Link
                        to="/ascend/validate/$slug"
                        params={{ slug: record.slug }}
                        style={{ fontSize: 12, color: TEAL, textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase" }}
                      >
                        Validate →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
