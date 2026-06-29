import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { submitManuscript } from "@/lib/manuscripts.functions";

export const Route = createFileRoute("/_authenticated/ascend/manuscripts/new")({
  head: () => ({
    meta: [
      { title: "Submit Manuscript — Ascend Publishing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NewManuscript,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function NewManuscript() {
  const navigate = useNavigate();
  const submit = useServerFn(submitManuscript);

  const [title, setTitle] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !file) {
      setErr("Title and a manuscript file are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const name = file.name.toLowerCase();
      const format: "md" | "docx" | "pdf" =
        name.endsWith(".docx") ? "docx" : name.endsWith(".pdf") ? "pdf" : "md";
      const contentBase64 = await fileToBase64(file);
      const res = await submit({
        data: { title: title.trim(), filename: file.name, format, contentBase64 },
      });
      navigate({ to: "/ascend/manuscripts/$id", params: { id: res.manuscriptId } });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Submission failed");
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: "40px 24px", color: FG, maxWidth: 720, marginInline: "auto" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL }}>
        Ascend / Submit Manuscript
      </div>
      <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 32, margin: 0 }}>
        Submit a manuscript
      </h1>
      <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
        Upload your file. We'll validate it and return your audit report.
      </p>

      <form onSubmit={handleSubmit} style={{
        marginTop: 28, padding: 28, borderRadius: 14, border: `1px solid ${LINE}`,
        background: PANEL, display: "grid", gap: 16,
      }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
            Working Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              padding: "12px 14px", borderRadius: 8, border: `1px solid ${LINE}`,
              background: "#000", color: FG, fontSize: 14,
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
            Manuscript File (.md, .docx, .pdf)
          </span>
          <input
            type="file"
            accept=".md,.markdown,.txt,.docx,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            style={{
              padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`,
              background: "#000", color: FG, fontSize: 13,
            }}
          />
        </label>
        {err && <div style={{ color: "#fca5a5", fontSize: 13 }}>{err}</div>}
        <div>
          <button type="submit" disabled={busy} style={{
            padding: "12px 22px", borderRadius: 8, border: "none", background: GOLD,
            color: "#111", fontWeight: 700, cursor: "pointer", fontSize: 12,
            letterSpacing: "0.08em", textTransform: "uppercase", opacity: busy ? 0.6 : 1,
          }}>
            {busy ? "Validating…" : "Submit & Validate"}
          </button>
        </div>
      </form>
    </main>
  );
}
