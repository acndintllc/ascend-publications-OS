/* /ascend/publications/$slug — PTL-021 Phase 9B authoring detail view.
   Edits land via server functions (no auth gate yet — see Phase 9D).
   Functionality first; styling deferred. */
import * as React from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import {
  getPublication,
  updatePublicationRecord,
  updatePublicationMetadata,
  updatePublicationVera,
  transitionPublicationStatus,
  listPublicationAssets,
  uploadPublicationAsset,
  deactivatePublicationAsset,
  listPublicationEvents,
} from "@/lib/publication.functions";
import { PROFILES, getProfile, type VeraBlockKind } from "@/publication/profiles";
import {
  PUBLICATION_STATUSES,
  STATUS_TRANSITIONS,
  type PublicationStatus,
} from "@/publication/status";
import { VERA_BLOCKS } from "@/publication/vera-blocks";
import { adaptForAllTargets, publicationMetadataSchema } from "@/publication/metadata";
import { planExports } from "@/publication/export";
import { getManuscript } from "@/manuscript/library";
import { enrich } from "@/manuscript/pipeline";
import { ASSET_KINDS, ASSET_LABELS, scoreAssets, type AssetKind, type AssetRecord } from "@/publication/assets";
import { EVENT_LABELS } from "@/publication/events";


export const Route = createFileRoute("/_authenticated/ascend/publications/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `Edit ${params.slug} — ASCEND Operations` }],
  }),
  loader: async ({ params }) => {
    try {
      const [detail, assets, events] = await Promise.all([
        getPublication({ data: { slug: params.slug } }),
        listPublicationAssets({ data: { slug: params.slug } }),
        listPublicationEvents({ data: { slug: params.slug, limit: 50 } }),
      ]);
      return { detail, assets, events, slug: params.slug };
    } catch {
      throw notFound();
    }
  },

  notFoundComponent: () => (
    <main style={{ padding: "var(--am-silence-md)", fontFamily: "var(--am-font-ui)" }}>
      <p>Publication not found.</p>
      <Link to="/ascend/publications">← Operations</Link>
    </main>
  ),
  errorComponent: ({ error, reset }) => (
    <main style={{ padding: "var(--am-silence-md)", fontFamily: "var(--am-font-ui)" }}>
      <p>Error: {error.message}</p>
      <button onClick={reset}>Retry</button>
    </main>
  ),
  component: PublicationDetailRoute,
});

type DetailData = Awaited<ReturnType<typeof getPublication>>;

const fieldRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "180px 1fr",
  gap: "var(--am-space-4)",
  alignItems: "start",
  marginBlockEnd: "var(--am-space-4)",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--am-space-2) var(--am-space-3)",
  border: "1px solid var(--am-color-ink-300)",
  borderRadius: "var(--am-radius-sm)",
  fontFamily: "var(--am-font-ui)",
  fontSize: "var(--am-type-200)",
  background: "var(--am-color-ink-0)",
};
const sectionStyle: React.CSSProperties = {
  marginBlockEnd: "var(--am-silence-md)",
  padding: "var(--am-space-5)",
  border: "1px solid var(--am-color-ink-200)",
  borderRadius: "var(--am-radius-sm)",
};
const labelStyle: React.CSSProperties = {
  fontFamily: "var(--am-font-ui)",
  fontSize: "var(--am-type-200)",
  color: "var(--am-color-ink-700)",
  paddingTop: 6,
};

function splitCsv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function PublicationDetailRoute() {
  const { detail, slug, assets: initialAssets, events: initialEvents } = Route.useLoaderData() as {
    detail: DetailData;
    slug: string;
    assets: AssetRecord[];
    events: Awaited<ReturnType<typeof listPublicationEvents>>;
  };

  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  const r = detail.record;
  const m = detail.metadata;
  const v = detail.vera;
  const profile = getProfile(r.profile);

  // Local form state
  const [record, setRecord] = React.useState({
    title: r.title,
    subtitle: r.subtitle ?? "",
    series: r.series ?? "",
    volume: r.volume?.toString() ?? "",
    version: r.version,
    profile: r.profile,
    author: r.author,
    audience: r.audience ?? "",
    language: r.language,
    publication_date: r.publication_date ?? "",
  });
  const [metadata, setMetadata] = React.useState({
    description: m?.description ?? "",
    keywords: (m?.keywords ?? []).join(", "),
    categories: (m?.categories ?? []).join(", "),
    contributors: (m?.contributors ?? []).join(", "),
    reading_level: m?.reading_level ?? "",
    isbn: m?.isbn ?? "",
    publisher: m?.publisher ?? "ASCEND Media",
    rights: m?.rights ?? "",
  });
  const profileForVera = getProfile(record.profile);
  const profileAllowed = profileForVera?.behavior.vera.blocksAllowed ?? [];
  const [veraKinds, setVeraKinds] = React.useState<string[]>(v?.enabled_kinds ?? []);
  const [veraVoice, setVeraVoice] = React.useState(v?.default_voice ?? profile?.behavior.vera.defaultVoice ?? "VERA");

  const showError = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const flashOk = (m: string) => {
    setFlash(m);
    setError(null);
    setTimeout(() => setFlash(null), 2500);
  };

  const saveRecord = async () => {
    setPending("record");
    try {
      await updatePublicationRecord({
        data: {
          slug,
          title: record.title,
          subtitle: record.subtitle || null,
          series: record.series || null,
          volume: record.volume ? Number(record.volume) : null,
          version: record.version,
          profile: record.profile,
          author: record.author,
          audience: record.audience || null,
          language: record.language,
          publication_date: record.publication_date || null,
        },
      });
      flashOk("Record saved.");
      router.invalidate();
    } catch (e) {
      showError(e);
    } finally {
      setPending(null);
    }
  };

  const saveMetadata = async () => {
    setPending("metadata");
    try {
      await updatePublicationMetadata({
        data: {
          slug,
          description: metadata.description,
          keywords: splitCsv(metadata.keywords),
          categories: splitCsv(metadata.categories),
          contributors: splitCsv(metadata.contributors),
          reading_level: metadata.reading_level || null,
          isbn: metadata.isbn || null,
          publisher: metadata.publisher,
          rights: metadata.rights || null,
        },
      });
      flashOk("Metadata saved.");
      router.invalidate();
    } catch (e) {
      showError(e);
    } finally {
      setPending(null);
    }
  };

  const saveVera = async () => {
    setPending("vera");
    try {
      await updatePublicationVera({
        data: { slug, enabled_kinds: veraKinds, default_voice: veraVoice },
      });
      flashOk("VERA config saved.");
      router.invalidate();
    } catch (e) {
      showError(e);
    } finally {
      setPending(null);
    }
  };

  const transition = async (next: PublicationStatus) => {
    setPending(`status:${next}`);
    try {
      await transitionPublicationStatus({ data: { slug, next } });
      flashOk(`Transitioned to ${next}.`);
      router.invalidate();
    } catch (e) {
      showError(e);
    } finally {
      setPending(null);
    }
  };

  // Validation surface
  const lib = getManuscript(slug);
  const enriched = lib ? enrich(lib.doc, { bib: lib.bib, vera: lib.veraSidecar }) : undefined;
  const parsed = publicationMetadataSchema.safeParse({
    title: record.title,
    subtitle: record.subtitle || undefined,
    description: metadata.description || record.title,
    keywords: splitCsv(metadata.keywords),
    categories: splitCsv(metadata.categories),
    author: record.author,
    contributors: splitCsv(metadata.contributors),
    language: record.language,
    audience: record.audience || undefined,
    publicationDate: record.publication_date || undefined,
    isbn: metadata.isbn || undefined,
    publisher: metadata.publisher,
    rights: metadata.rights || undefined,
  });
  const adapters = parsed.success ? adaptForAllTargets(parsed.data) : [];
  const planRecord = {
    slug,
    title: r.title,
    subtitle: r.subtitle ?? undefined,
    status: r.status,
    version: r.version,
    profile: r.profile,
    lastUpdated: r.last_updated,
    author: r.author,
  };
  const exportPlan = enriched ? planExports(planRecord, enriched) : undefined;
  const allowedTransitions = STATUS_TRANSITIONS[r.status] ?? [];

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--am-chapter-bg)",
        color: "var(--am-chapter-ink)",
        paddingBlock: "var(--am-silence-lg)",
        paddingInline: "var(--am-space-6)",
      }}
    >
      <div style={{ maxWidth: 960, marginInline: "auto" }}>
        <nav
          style={{
            fontFamily: "var(--am-font-ui)",
            fontSize: "var(--am-type-200)",
            display: "flex",
            gap: "var(--am-space-4)",
            marginBlockEnd: "var(--am-space-5)",
            color: "var(--am-color-ink-500)",
          }}
        >
          <Link to="/ascend/publications">← Operations</Link>
          <Link to="/ascend/reader/$slug" params={{ slug }}>open reader →</Link>
          <Link to="/ascend/validate/$slug" params={{ slug }}>audit →</Link>
        </nav>
        <h1
          style={{
            fontFamily: "var(--am-font-display)",
            fontSize: "var(--am-type-700)",
            margin: 0,
            marginBlockEnd: "var(--am-space-3)",
          }}
        >
          {r.title}
        </h1>
        <div style={{ fontFamily: "var(--am-font-ui)", color: "var(--am-color-ink-500)", marginBlockEnd: "var(--am-silence-sm)" }}>
          {slug} · v{r.version} · {r.status} · {profile?.label ?? r.profile}
        </div>

        {flash && (
          <div style={{ marginBlockEnd: "var(--am-space-4)", color: "#059669", fontFamily: "var(--am-font-ui)" }}>
            ✓ {flash}
          </div>
        )}
        {error && (
          <div style={{ marginBlockEnd: "var(--am-space-4)", color: "#b91c1c", fontFamily: "var(--am-font-ui)" }}>
            ✗ {error}
          </div>
        )}

        {/* Status transitions */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "var(--am-font-display)", marginTop: 0 }}>Lifecycle</h2>
          <p style={{ fontFamily: "var(--am-font-ui)", color: "var(--am-color-ink-500)" }}>
            Current: <strong>{r.status}</strong>. Allowed next:
          </p>
          <div style={{ display: "flex", gap: "var(--am-space-3)", flexWrap: "wrap" }}>
            {allowedTransitions.length === 0 && <em>— terminal —</em>}
            {allowedTransitions.map((next) => (
              <button
                key={next}
                onClick={() => transition(next)}
                disabled={pending === `status:${next}`}
                style={{
                  ...inputStyle,
                  width: "auto",
                  cursor: "pointer",
                  background: "var(--am-color-ink-900)",
                  color: "var(--am-color-ink-0)",
                  borderColor: "var(--am-color-ink-900)",
                }}
              >
                → {next}
              </button>
            ))}
          </div>
          <details style={{ marginBlockStart: "var(--am-space-4)", fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-100)" }}>
            <summary>All statuses</summary>
            <code>{PUBLICATION_STATUSES.join(" → ")}</code>
          </details>
        </section>

        {/* Record */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "var(--am-font-display)", marginTop: 0 }}>Publication Record</h2>
          {([
            ["title", "Title", "text"],
            ["subtitle", "Subtitle", "text"],
            ["author", "Author", "text"],
            ["series", "Series", "text"],
            ["volume", "Volume", "number"],
            ["version", "Version", "text"],
            ["language", "Language", "text"],
            ["audience", "Audience", "text"],
            ["publication_date", "Publication Date", "date"],
          ] as const).map(([key, label, type]) => (
            <div style={fieldRow} key={key}>
              <label style={labelStyle}>{label}</label>
              <input
                type={type}
                style={inputStyle}
                value={record[key]}
                onChange={(e) => setRecord({ ...record, [key]: e.target.value })}
              />
            </div>
          ))}
          <div style={fieldRow}>
            <label style={labelStyle}>Profile</label>
            <select
              style={inputStyle}
              value={record.profile}
              onChange={(e) => setRecord({ ...record, profile: e.target.value })}
            >
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>{p.label} — {p.lines.join(", ")}</option>
              ))}
            </select>
          </div>
          <button
            onClick={saveRecord}
            disabled={pending === "record"}
            style={{ ...inputStyle, width: "auto", cursor: "pointer", background: "var(--am-color-accent-500)", color: "var(--am-color-ink-0)", borderColor: "var(--am-color-accent-500)" }}
          >
            {pending === "record" ? "Saving…" : "Save record"}
          </button>
        </section>

        {/* Metadata */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "var(--am-font-display)", marginTop: 0 }}>Distribution Metadata</h2>
          <div style={fieldRow}>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 90 }}
              value={metadata.description}
              onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
            />
          </div>
          {([
            ["keywords", "Keywords (CSV)"],
            ["categories", "Categories (CSV)"],
            ["contributors", "Contributors (CSV)"],
            ["reading_level", "Reading Level"],
            ["isbn", "ISBN"],
            ["publisher", "Publisher"],
            ["rights", "Rights"],
          ] as const).map(([key, label]) => (
            <div style={fieldRow} key={key}>
              <label style={labelStyle}>{label}</label>
              <input
                style={inputStyle}
                value={metadata[key]}
                onChange={(e) => setMetadata({ ...metadata, [key]: e.target.value })}
              />
            </div>
          ))}
          <button
            onClick={saveMetadata}
            disabled={pending === "metadata"}
            style={{ ...inputStyle, width: "auto", cursor: "pointer", background: "var(--am-color-accent-500)", color: "var(--am-color-ink-0)", borderColor: "var(--am-color-accent-500)" }}
          >
            {pending === "metadata" ? "Saving…" : "Save metadata"}
          </button>

          <div style={{ marginBlockStart: "var(--am-space-5)", fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-100)" }}>
            <strong>Storefront readiness</strong>
            <ul>
              {adapters.map((a) => (
                <li key={a.target}>
                  <strong>{a.target}</strong>:{" "}
                  {a.issues.length === 0
                    ? "ready"
                    : a.issues.map((i) => `${i.level}:${i.field}`).join(", ")}
                </li>
              ))}
              {!parsed.success && <li>Metadata invalid: {parsed.error.issues.map((i) => i.message).join("; ")}</li>}
            </ul>
          </div>
        </section>

        {/* VERA config */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "var(--am-font-display)", marginTop: 0 }}>VERA Configuration</h2>
          <p style={{ fontFamily: "var(--am-font-ui)", color: "var(--am-color-ink-500)" }}>
            Profile <strong>{profileForVera?.label ?? record.profile}</strong> allows:{" "}
            <code>{profileAllowed.join(", ") || "—"}</code>
          </p>
          <div style={fieldRow}>
            <label style={labelStyle}>Default voice</label>
            <input
              style={inputStyle}
              value={veraVoice}
              onChange={(e) => setVeraVoice(e.target.value)}
            />
          </div>
          <div style={{ marginBlockEnd: "var(--am-space-4)" }}>
            {(Object.keys(VERA_BLOCKS) as VeraBlockKind[]).map((kind) => {
              const allowed = profileAllowed.includes(kind);
              const enabled = veraKinds.includes(kind);
              return (
                <label
                  key={kind}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--am-space-3)",
                    fontFamily: "var(--am-font-ui)",
                    fontSize: "var(--am-type-200)",
                    color: allowed ? "var(--am-color-ink-700)" : "var(--am-color-ink-400)",
                    marginBlockEnd: "var(--am-space-2)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={!allowed}
                    onChange={(e) => {
                      if (e.target.checked) setVeraKinds([...veraKinds, kind]);
                      else setVeraKinds(veraKinds.filter((k) => k !== kind));
                    }}
                  />
                  <strong>{VERA_BLOCKS[kind].label}</strong>
                  <span style={{ color: "var(--am-color-ink-500)" }}>
                    {VERA_BLOCKS[kind].prompt}
                    {!allowed && " · not allowed by profile"}
                  </span>
                </label>
              );
            })}
          </div>
          <button
            onClick={saveVera}
            disabled={pending === "vera"}
            style={{ ...inputStyle, width: "auto", cursor: "pointer", background: "var(--am-color-accent-500)", color: "var(--am-color-ink-0)", borderColor: "var(--am-color-accent-500)" }}
          >
            {pending === "vera" ? "Saving…" : "Save VERA config"}
          </button>
        </section>

        {/* Validation + export */}
        <section style={sectionStyle}>
          <h2 style={{ fontFamily: "var(--am-font-display)", marginTop: 0 }}>Validation &amp; Export</h2>
          {enriched ? (
            <>
              <div style={{ fontFamily: "var(--am-font-ui)" }}>
                Issues: {enriched.report.issues.length === 0 ? "clean" : enriched.report.issues.length}
              </div>
              {exportPlan && (
                <ul style={{ fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-100)" }}>
                  {exportPlan.checks.map((c) => (
                    <li key={c.target}>
                      <strong>{c.target}</strong>: {c.ready ? "ready" : "blocked"}
                      {c.blockers.length > 0 && ` — ${c.blockers.join("; ")}`}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p style={{ fontFamily: "var(--am-font-ui)", color: "var(--am-color-ink-500)" }}>
              Source manuscript not bundled — validation unavailable.
            </p>
          )}
        </section>

        <AssetsSection
          slug={slug}
          profileId={record.profile}
          initial={initialAssets}
          onChange={() => router.invalidate()}
        />

        <EventsSection initial={initialEvents} />
      </div>
    </main>
  );
}

/* ─── Assets section ─────────────────────────────────────────────── */

function AssetsSection({
  slug, profileId, initial, onChange,
}: {
  slug: string;
  profileId: string;
  initial: AssetRecord[];
  onChange: () => void;
}) {
  const [assets, setAssets] = React.useState<AssetRecord[]>(initial);
  const [kind, setKind] = React.useState<AssetKind>("front-cover");
  const [url, setUrl] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => setAssets(initial), [initial]);

  const readiness = scoreAssets(profileId, assets);
  const activeByKind = new Map<string, AssetRecord>();
  for (const a of assets) if (a.is_active) activeByKind.set(a.kind, a);

  const upload = async () => {
    if (!url) return setErr("URL required");
    setBusy("upload");
    setErr(null);
    try {
      const res = await uploadPublicationAsset({
        data: { slug, kind, url, label: label || null },
      });
      setAssets((prev) => [res.asset, ...prev.map((a) => a.id === res.replaced?.id ? { ...a, is_active: false } : a)]);
      setUrl(""); setLabel("");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };

  const deactivate = async (id: string) => {
    setBusy(`deact:${id}`);
    try {
      await deactivatePublicationAsset({ data: { slug, id } });
      setAssets((prev) => prev.map((a) => a.id === id ? { ...a, is_active: false } : a));
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontFamily: "var(--am-font-display)", marginTop: 0 }}>Assets</h2>
      <div style={{ fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-200)", marginBlockEnd: "var(--am-space-4)" }}>
        Readiness: <strong>{Math.round(readiness.score * 100)}%</strong> required
        {" · "}
        <strong>{Math.round(readiness.scoreWithRecommended * 100)}%</strong> with recommended
        {readiness.missingRequired.length > 0 && (
          <div style={{ color: "#b91c1c" }}>
            Missing required: {readiness.missingRequired.map((k) => ASSET_LABELS[k]).join(", ")}
          </div>
        )}
        {readiness.missingRecommended.length > 0 && (
          <div style={{ color: "var(--am-color-ink-500)" }}>
            Missing recommended: {readiness.missingRecommended.map((k) => ASSET_LABELS[k]).join(", ")}
          </div>
        )}
      </div>

      <div style={{ ...fieldRow, gridTemplateColumns: "160px 1fr 1fr auto" }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)} style={inputStyle}>
          {ASSET_KINDS.map((k) => (
            <option key={k} value={k}>{ASSET_LABELS[k]}</option>
          ))}
        </select>
        <input style={inputStyle} placeholder="https://… image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input style={inputStyle} placeholder="label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button
          onClick={upload}
          disabled={busy === "upload"}
          style={{ ...inputStyle, width: "auto", cursor: "pointer", background: "var(--am-color-accent-500)", color: "var(--am-color-ink-0)", borderColor: "var(--am-color-accent-500)" }}
        >
          {busy === "upload" ? "Saving…" : (activeByKind.has(kind) ? "Replace" : "Upload")}
        </button>
      </div>

      {err && <div style={{ color: "#b91c1c", fontFamily: "var(--am-font-ui)", marginBlockEnd: "var(--am-space-3)" }}>✗ {err}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-100)" }}>
        <thead>
          <tr>
            {["Kind", "Version", "Active", "URL", "Uploaded", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: 6, borderBlockEnd: "1px solid var(--am-color-ink-200)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 12, color: "var(--am-color-ink-500)" }}>No assets yet.</td></tr>
          )}
          {assets.map((a) => (
            <tr key={a.id} style={{ opacity: a.is_active ? 1 : 0.55 }}>
              <td style={{ padding: 6 }}>{ASSET_LABELS[a.kind as AssetKind] ?? a.kind}{a.label && <div style={{ color: "var(--am-color-ink-500)" }}>{a.label}</div>}</td>
              <td style={{ padding: 6 }}>v{a.version}</td>
              <td style={{ padding: 6 }}>{a.is_active ? "✓" : "—"}</td>
              <td style={{ padding: 6, wordBreak: "break-all" }}><a href={a.url} target="_blank" rel="noreferrer">{a.url}</a></td>
              <td style={{ padding: 6 }}>{new Date(a.uploaded_at).toLocaleString()}</td>
              <td style={{ padding: 6 }}>
                {a.is_active && (
                  <button onClick={() => deactivate(a.id)} disabled={busy === `deact:${a.id}`} style={{ cursor: "pointer" }}>
                    deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ─── Events section ─────────────────────────────────────────────── */

function EventsSection({ initial }: { initial: Awaited<ReturnType<typeof listPublicationEvents>> }) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ fontFamily: "var(--am-font-display)", marginTop: 0 }}>Workflow Events</h2>
      {initial.length === 0 ? (
        <p style={{ fontFamily: "var(--am-font-ui)", color: "var(--am-color-ink-500)" }}>No events yet.</p>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-100)" }}>
          {initial.map((e) => (
            <li key={e.id} style={{ padding: "var(--am-space-2) 0", borderBlockEnd: "1px solid var(--am-color-ink-200)" }}>
              <div>
                <strong>{EVENT_LABELS[e.event_type as keyof typeof EVENT_LABELS] ?? e.event_type}</strong>
                <span style={{ color: "var(--am-color-ink-500)", marginInlineStart: 8 }}>
                  {new Date(e.created_at).toLocaleString()}
                  {e.actor ? ` · ${e.actor}` : ""}
                </span>
              </div>
              {e.payload && Object.keys(e.payload).length > 0 && (
                <pre style={{ margin: "4px 0 0", fontSize: 11, color: "var(--am-color-ink-500)", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(e.payload, null, 0)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

