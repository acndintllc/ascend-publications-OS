import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { submitCreatorPackage } from "@/lib/publication.functions";

export const Route = createFileRoute("/_authenticated/ascend/submit")({
  head: () => ({
    meta: [
      { title: "Submit a Package — Ascend Publishing" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SubmitPage,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px solid ${LINE}`,
  background: "#000",
  color: FG,
  fontSize: 13,
  fontFamily: "inherit",
  width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: MUTED,
  display: "block",
  marginBottom: 4,
};

const STEPS = ["Manuscript", "Metadata", "Cover", "Optional", "Review"] as const;

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

interface OptionalAsset {
  kind: string;
  file: File;
}

const OPTIONAL_KINDS = [
  { value: "epub-cover", label: "EPUB Cover" },
  { value: "paperback-cover", label: "Paperback Cover" },
  { value: "hardcover-cover", label: "Hardcover Cover" },
  { value: "author-image", label: "Author Image" },
  { value: "marketing-graphic", label: "Marketing Graphic" },
  { value: "interior-illustration", label: "Interior Image" },
];

function SubmitPage() {
  const router = useRouter();
  const submit = useServerFn(submitCreatorPackage);

  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ slug: string } | null>(null);

  // step 1
  const [manuscript, setManuscript] = React.useState<File | null>(null);
  // step 2
  const [title, setTitle] = React.useState("");
  const [subtitle, setSubtitle] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [keywords, setKeywords] = React.useState("");
  const [categories, setCategories] = React.useState("");
  const [rights, setRights] = React.useState("");
  const [publisher, setPublisher] = React.useState("ASCEND Publishing");
  const [isbn, setIsbn] = React.useState("");
  const [series, setSeries] = React.useState("");
  const [volume, setVolume] = React.useState("");
  const [readingLevel, setReadingLevel] = React.useState("");
  // step 3
  const [cover, setCover] = React.useState<File | null>(null);
  // step 4
  const [optional, setOptional] = React.useState<OptionalAsset[]>([]);
  const [bibFile, setBibFile] = React.useState<File | null>(null);
  const [veraFile, setVeraFile] = React.useState<File | null>(null);

  const canAdvance = React.useMemo(() => {
    if (step === 0) return !!manuscript;
    if (step === 1) return title.trim() && author.trim() && description.trim();
    if (step === 2) return !!cover;
    return true;
  }, [step, manuscript, title, author, description, cover]);

  async function handleSubmit(finalize: boolean) {
    if (!manuscript || !cover) {
      setErr("Manuscript and cover are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const mFormat: "md" | "docx" | "pdf" =
        /\.docx$/i.test(manuscript.name) ? "docx"
        : /\.pdf$/i.test(manuscript.name) ? "pdf" : "md";
      const coverB64 = await fileToBase64(cover);
      const mB64 = await fileToBase64(manuscript);
      const opt = await Promise.all(
        optional.map(async (o) => ({
          kind: o.kind,
          filename: o.file.name,
          contentType: o.file.type || "application/octet-stream",
          contentBase64: await fileToBase64(o.file),
        })),
      );
      const bibText = bibFile ? await bibFile.text() : undefined;
      const veraJson = veraFile ? await veraFile.text() : undefined;
      const res = await submit({
        data: {
          metadata: {
            title: title.trim(),
            subtitle: subtitle.trim() || null,
            author: author.trim(),
            description: description.trim(),
            keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
            categories: categories.split(",").map((s) => s.trim()).filter(Boolean),
            publisher: publisher.trim() || "ASCEND Publishing",
            rights: rights.trim() || null,
            isbn: isbn.trim() || null,
            series: series.trim() || null,
            volume: volume.trim() ? Number(volume) : null,
            reading_level: readingLevel.trim() || null,
            language: "en",
          },
          manuscript: { filename: manuscript.name, format: mFormat, contentBase64: mB64 },
          cover: {
            kind: "front-cover",
            filename: cover.name,
            contentType: cover.type || "image/jpeg",
            contentBase64: coverB64,
            label: "Front Cover",
          },
          optionalAssets: opt,
          bibText, veraJson,
          submit: finalize,
        },
      });
      setDone({ slug: res.slug });
      router.invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main style={{ padding: "60px 24px", color: FG, maxWidth: 720, marginInline: "auto" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL }}>
          Submitted
        </div>
        <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 36 }}>
          Package received
        </h1>
        <p style={{ color: MUTED }}>
          Your package <code style={{ color: TEAL }}>{done.slug}</code> is in the ASCEND review queue.
          You'll see status updates in your library.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Link to="/dashboard" style={btnGold}>Back to Library</Link>
          <Link to="/ascend/submit" style={btnGhost} reloadDocument>
            Submit another
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "40px 24px", color: FG, maxWidth: 880, marginInline: "auto" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL, marginBottom: 6 }}>
        Creator Submission Package
      </div>
      <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 36, margin: 0 }}>
        Submit your work to ASCEND
      </h1>
      <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
        One package: manuscript + metadata + cover. Add optional assets to strengthen distribution.
      </p>

      {/* Stepper */}
      <ol style={{ display: "flex", gap: 8, listStyle: "none", padding: 0, marginTop: 28, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => (
          <li key={s} style={{
            padding: "8px 14px", borderRadius: 999,
            border: `1px solid ${i === step ? GOLD : LINE}`,
            color: i === step ? GOLD : i < step ? TEAL : MUTED,
            fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
            background: i === step ? "rgba(232,192,122,0.08)" : "transparent",
          }}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <section style={{ marginTop: 28, padding: 28, borderRadius: 14, border: `1px solid ${LINE}`, background: PANEL }}>
        {step === 0 && (
          <div>
            <h2 style={h2Style}>1. Upload your manuscript</h2>
            <p style={{ color: MUTED, fontSize: 13 }}>Supported: .docx, .md, .pdf</p>
            {!manuscript ? (
              <input type="file" accept=".md,.markdown,.txt,.docx,.pdf"
                onChange={(e) => setManuscript(e.target.files?.[0] ?? null)} style={inputStyle} />
            ) : (
              <div style={{
                marginTop: 4, padding: 12, border: `1px solid ${LINE}`, borderRadius: 6,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              }}>
                <span style={{ color: TEAL, fontSize: 12 }}>
                  ✓ {manuscript.name} ({Math.round(manuscript.size / 1024)} KB)
                </span>
                <button type="button" onClick={() => setManuscript(null)}
                  aria-label="Remove uploaded manuscript"
                  style={{ ...btnGhost, padding: "8px 14px" }}>
                  🗑 Remove
                </button>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "grid", gap: 14 }}>
            <h2 style={h2Style}>2. Metadata</h2>
            <Row>
              <Field label="Title *"><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Field label="Subtitle"><input style={inputStyle} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field>
            </Row>
            <Field label="Author legal / display name *">
              <input style={inputStyle} value={author} onChange={(e) => setAuthor(e.target.value)} />
            </Field>
            <Field label="Description *">
              <textarea style={{ ...inputStyle, minHeight: 120, fontFamily: "inherit" }}
                value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Row>
              <Field label="Keywords (comma-separated)">
                <input style={inputStyle} value={keywords} onChange={(e) => setKeywords(e.target.value)}
                  placeholder="thriller, mystery, noir" />
              </Field>
              <Field label="Categories (comma-separated)">
                <input style={inputStyle} value={categories} onChange={(e) => setCategories(e.target.value)}
                  placeholder="Fiction / Mystery" />
              </Field>
            </Row>
            <Row>
              <Field label="Publisher / Imprint">
                <input style={inputStyle} value={publisher} onChange={(e) => setPublisher(e.target.value)} />
              </Field>
              <Field label="Rights statement">
                <input style={inputStyle} value={rights} onChange={(e) => setRights(e.target.value)}
                  placeholder="© 2026 Author. All rights reserved." />
              </Field>
            </Row>
            <Row>
              <Field label="ISBN (optional)"><input style={inputStyle} value={isbn} onChange={(e) => setIsbn(e.target.value)} /></Field>
              <Field label="Series (optional)"><input style={inputStyle} value={series} onChange={(e) => setSeries(e.target.value)} /></Field>
            </Row>
            <Row>
              <Field label="Volume (optional)">
                <input style={inputStyle} type="number" min={1} value={volume} onChange={(e) => setVolume(e.target.value)} />
              </Field>
              <Field label="Reading level (optional)">
                <input style={inputStyle} value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)}
                  placeholder="Adult / YA / Middle Grade" />
              </Field>
            </Row>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={h2Style}>3. Front Cover (required)</h2>
            <p style={{ color: MUTED, fontSize: 13 }}>
              JPG or PNG. This is the canonical front cover used everywhere downstream.
            </p>
            <input type="file" accept="image/*"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)} style={inputStyle} />
            {cover && (
              <div style={{ color: TEAL, fontSize: 12, marginTop: 10 }}>✓ {cover.name}</div>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 18 }}>
            <h2 style={h2Style}>4. Optional assets</h2>
            <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
              Add as many as you like. All optional — but the more you include, the faster distribution moves.
            </p>
            <OptionalAssetPicker onAdd={(a) => setOptional((prev) => [...prev, a])} />
            {optional.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {optional.map((o, i) => (
                  <li key={i} style={{
                    padding: 10, border: `1px solid ${LINE}`, borderRadius: 6,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: 12 }}>
                      <span style={{ color: TEAL, marginRight: 8 }}>{o.kind}</span>{o.file.name}
                    </span>
                    <button onClick={() => setOptional((p) => p.filter((_, j) => j !== i))}
                      style={btnGhost}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14, display: "grid", gap: 10 }}>
              <Field label="citations.bib (optional)">
                <input type="file" accept=".bib,text/plain" style={inputStyle}
                  onChange={(e) => setBibFile(e.target.files?.[0] ?? null)} />
              </Field>
              <Field label="vera.json (optional)">
                <input type="file" accept=".json,application/json" style={inputStyle}
                  onChange={(e) => setVeraFile(e.target.files?.[0] ?? null)} />
              </Field>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gap: 14 }}>
            <h2 style={h2Style}>5. Review &amp; submit</h2>
            <Checklist label="Manuscript" ok={!!manuscript} detail={manuscript?.name} />
            <Checklist label="Title" ok={!!title.trim()} detail={title} />
            <Checklist label="Author" ok={!!author.trim()} detail={author} />
            <Checklist label="Description" ok={!!description.trim()} detail={`${description.length} chars`} />
            <Checklist label="Front cover" ok={!!cover} detail={cover?.name} />
            <Checklist label="Keywords" ok={!!keywords.trim()} detail={keywords} optional />
            <Checklist label="Categories" ok={!!categories.trim()} detail={categories} optional />
            <Checklist label="Optional assets" ok={optional.length > 0}
              detail={`${optional.length} attached`} optional />
            {err && <div style={{ color: "#fca5a5", fontSize: 13 }}>{err}</div>}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button disabled={busy} onClick={() => handleSubmit(false)} style={btnGhost}>
                {busy ? "Saving…" : "Save as draft"}
              </button>
              <button disabled={busy} onClick={() => handleSubmit(true)} style={btnGold}>
                {busy ? "Submitting…" : "Submit to ASCEND →"}
              </button>
            </div>
          </div>
        )}
      </section>

      {err && step !== 4 && (
        <div style={{ color: "#fca5a5", fontSize: 13, marginTop: 12 }}>{err}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
        <button disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))} style={btnGhost}>
          ← Back
        </button>
        {step < STEPS.length - 1 ? (
          <button disabled={!canAdvance || busy}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} style={btnGold}>
            Next →
          </button>
        ) : <span />}
      </div>
    </main>
  );
}

const btnGold: React.CSSProperties = {
  padding: "11px 22px", borderRadius: 8, border: "none",
  background: GOLD, color: "#111", fontWeight: 700, cursor: "pointer",
  fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
  textDecoration: "none", display: "inline-block",
};
const btnGhost: React.CSSProperties = {
  padding: "10px 20px", borderRadius: 8, border: `1px solid ${LINE}`,
  background: "transparent", color: FG, cursor: "pointer",
  fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
  textDecoration: "none", display: "inline-block",
};
const h2Style: React.CSSProperties = {
  fontFamily: "Fraunces Variable, Fraunces, serif",
  fontSize: 22, margin: 0, marginBottom: 12, color: FG,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>{children}</div>;
}

function Checklist({ label, ok, detail, optional }: {
  label: string; ok: boolean; detail?: string; optional?: boolean;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "10px 14px",
      border: `1px solid ${LINE}`, borderRadius: 6,
      background: ok ? "rgba(92,189,185,0.06)" : "transparent",
    }}>
      <span style={{ fontSize: 13 }}>
        <span style={{ color: ok ? TEAL : optional ? MUTED : "#fca5a5", marginRight: 10 }}>
          {ok ? "✓" : optional ? "○" : "!"}
        </span>
        {label}{optional ? " (optional)" : ""}
      </span>
      {detail && <span style={{ color: MUTED, fontSize: 12 }}>{detail.slice(0, 60)}</span>}
    </div>
  );
}

function OptionalAssetPicker({ onAdd }: { onAdd: (a: OptionalAsset) => void }) {
  const [kind, setKind] = React.useState(OPTIONAL_KINDS[0].value);
  const [file, setFile] = React.useState<File | null>(null);
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "180px 1fr auto", alignItems: "end" }}>
      <Field label="Kind">
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
          {OPTIONAL_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </Field>
      <Field label="File">
        <input type="file" style={inputStyle}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <button type="button" disabled={!file} style={btnGhost}
        onClick={() => { if (file) { onAdd({ kind, file }); setFile(null); } }}>
        Add
      </button>
    </div>
  );
}
