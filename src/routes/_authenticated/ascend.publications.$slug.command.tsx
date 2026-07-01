/* eslint-disable @typescript-eslint/no-explicit-any */
/* PTL-025 Phase 14E — Publication Command Center.
   Unified single-pane view: readiness, assets, exports, artifacts,
   ISBN registry, queue state, submissions, vendors, blockers. */
import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  auditPublicationFn,
  listPublicationAssets,
  listPublicationArtifacts,
  listDistributionQueue,
  listIsbns,
  listSubmissions,
  listVendors,
  assignIsbn,
  upsertVendor,
  createSubmission,
  updateSubmission,
  generatePublicationArtifacts,
  runReferencePdfRunner,
  runReferenceKfxRunner,
  runExternalKindlegenRunner,
  runKdpAdapterFn,
  runPublicationDryRunFn,
  buildPublicationSubmissionPackage,
  reportVendorSecretsFn,
  transitionIsbn,
  runKindleFailoverFn,
  kindleProviderHealthFn,
  evaluateGovernanceGateFn,
  runLiveKdpSubmissionFn,
  revalidateReadinessFn,
  generateKdpDistributionPackage,
  latestKdpPackageInfoFn,
} from "@/lib/publication.functions";
import { SUPPORTED_VENDOR_PLATFORMS } from "@/publication/vendors";
import { ISBN_FORMATS } from "@/publication/isbn";
import { SUBMISSION_STATES } from "@/publication/submissions";
import { nextIsbnStates } from "@/publication/isbn-workflow";

export const Route = createFileRoute("/_authenticated/ascend/publications/$slug/command")({
  head: ({ params }) => ({
    meta: [
      { title: `Command Center — ${params.slug} — ASCEND` },
      { name: "description", content: "Unified publication operations command center." },
    ],
  }),
  loader: async ({ params }) => {
    const [audit, assets, artifacts, queue, isbns, submissions, vendors, vendorSecrets, kdpPackage] = await Promise.all([
      auditPublicationFn({ data: { slug: params.slug } }),
      listPublicationAssets({ data: { slug: params.slug } }),
      listPublicationArtifacts({ data: { slug: params.slug } }),
      listDistributionQueue({ data: { slug: params.slug } }),
      listIsbns({ data: { slug: params.slug } }),
      listSubmissions({ data: { slug: params.slug } }),
      listVendors(),
      reportVendorSecretsFn(),
      latestKdpPackageInfoFn({ data: { slug: params.slug } }),
    ]);
    return { audit, assets, artifacts, queue, isbns, submissions, vendors, vendorSecrets, kdpPackage, slug: params.slug };
  },
  component: CommandCenter,
});


const card: React.CSSProperties = {
  border: "1px solid var(--am-color-ink-200)",
  borderRadius: "var(--am-radius-lg)",
  padding: "var(--am-space-5)",
  marginBlockEnd: "var(--am-space-5)",
  background: "var(--am-color-surface-1)",
};
const h: React.CSSProperties = {
  fontFamily: "var(--am-font-display)",
  fontSize: "var(--am-type-500)",
  marginBlockEnd: "var(--am-space-3)",
};
const sub: React.CSSProperties = {
  fontFamily: "var(--am-font-ui)",
  fontSize: "var(--am-type-300)",
  color: "var(--am-color-ink-700)",
  marginBlockEnd: "var(--am-space-3)",
};
const pill: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: "var(--am-type-100)",
  fontFamily: "var(--am-font-ui)",
  border: "1px solid var(--am-color-ink-300)",
  marginInlineEnd: 6,
};
const btn: React.CSSProperties = {
  padding: "var(--am-space-2) var(--am-space-4)",
  borderRadius: "var(--am-radius-pill)",
  border: "1px solid var(--am-color-ink-300)",
  background: "transparent",
  cursor: "pointer",
  fontFamily: "var(--am-font-ui)",
};

function CommandCenter() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ld = Route.useLoaderData() as any;
  const { audit, assets, artifacts, queue, isbns, submissions, vendors, vendorSecrets, kdpPackage, slug } = ld;
  const refresh = () => router.invalidate();

  const [busy, setBusy] = React.useState(false);
  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); refresh(); } catch (e) { alert(String(e)); } finally { setBusy(false); }
  };

  const readinessPct = audit.readiness?.percent ?? 0;
  const ready = audit.readiness?.ready ?? false;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--am-space-7)" }}>
      <div style={{ marginBlockEnd: "var(--am-space-5)" }}>
        <Link to="/ascend/publications" style={{ fontFamily: "var(--am-font-ui)" }}>← All publications</Link>
      </div>
      <h1 style={{ fontFamily: "var(--am-font-display)", fontSize: "var(--am-type-700)" }}>
        {slug} · Command Center
      </h1>
      <div style={sub}>
        <Link to="/ascend/publications/$slug" params={{ slug }}>Authoring</Link>
        {" · "}
        <Link to="/ascend/publications/$slug/distribute" params={{ slug }}>Distribute</Link>
      </div>

      {/* Readiness */}
      <section style={card}>
        <div style={h}>Readiness</div>
        <div style={{ fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-600)" }}>
          {readinessPct}% {ready ? "· READY" : "· not ready"}
        </div>
        <div style={{ marginBlockStart: "var(--am-space-3)" }}>
          {audit.readiness?.signals.map((s: any) => (
            <span key={s.id} style={{ ...pill, background: s.score === 1 ? "var(--am-color-surface-2)" : "transparent" }}>
              {s.label}: {Math.round(s.score * 100)}%
            </span>
          ))}
        </div>
        {audit.blockers.length > 0 && (
          <div style={{ marginBlockStart: "var(--am-space-4)" }}>
            <strong style={{ color: "var(--am-color-warn, #b00020)" }}>Blockers ({audit.blockers.length})</strong>
            <ul>{audit.blockers.map((b: any, i: number) => <li key={i} style={{ fontFamily: "var(--am-font-ui)" }}>{b}</li>)}</ul>
          </div>
        )}
        {audit.warnings.length > 0 && (
          <details style={{ marginBlockStart: "var(--am-space-3)" }}>
            <summary>Recommendations ({audit.warnings.length})</summary>
            <ul>{audit.warnings.map((w: any, i: number) => <li key={i}>{w}</li>)}</ul>
          </details>
        )}
      </section>

      {/* Facts */}
      <section style={card}>
        <div style={h}>Facts</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--am-space-4)", fontFamily: "var(--am-font-ui)" }}>
          {Object.entries(audit.facts).map(([k, v]) => (
            <div key={k}>
              <div style={{ color: "var(--am-color-ink-700)", fontSize: "var(--am-type-100)" }}>{k}</div>
              <div style={{ fontSize: "var(--am-type-400)" }}>{Array.isArray(v) ? v.join(", ") || "—" : String(v)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ISBN registry */}
      <section style={card}>
        <div style={h}>ISBN Registry</div>
        <IsbnForm slug={slug} busy={busy} onAdd={(d) => wrap(() => assignIsbn({ data: d }))} />
        <table style={{ width: "100%", borderCollapse: "collapse", marginBlockStart: "var(--am-space-3)" }}>
          <thead><tr><th align="left">ISBN</th><th align="left">Format</th><th align="left">Edition</th><th align="left">Status</th><th align="left">Assigned</th><th align="left">Transition</th></tr></thead>
          <tbody>
            {isbns.length === 0 && <tr><td colSpan={6} style={{ padding: 8, color: "var(--am-color-ink-700)" }}>No ISBNs assigned.</td></tr>}
            {isbns.map((r: any) => {
              const nexts = nextIsbnStates(r.status);
              return (
                <tr key={r.id}>
                  <td>{r.isbn}</td><td>{r.format}</td><td>{r.edition}</td><td>{r.status}</td>
                  <td>{new Date(r.assigned_at).toISOString().slice(0,10)}</td>
                  <td>
                    {nexts.length === 0 ? "—" : nexts.map((n) => (
                      <button key={n} style={{ ...btn, padding: "2px 8px", marginInlineEnd: 4 }} disabled={busy}
                        onClick={() => wrap(() => transitionIsbn({ data: { id: r.id, slug, next: n } }))}>
                        → {n}
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>


      {/* Vendors */}
      <section style={card}>
        <div style={h}>Vendors</div>
        <VendorForm busy={busy} onSave={(d) => wrap(() => upsertVendor({ data: d }))} />
        <table style={{ width: "100%", borderCollapse: "collapse", marginBlockStart: "var(--am-space-3)" }}>
          <thead><tr><th align="left">Platform</th><th align="left">Label</th><th align="left">Account</th><th align="left">Credential Ref</th><th align="left">Enabled</th></tr></thead>
          <tbody>
            {vendors.length === 0 && <tr><td colSpan={5} style={{ padding: 8 }}>No vendors configured.</td></tr>}
            {vendors.map((v: any) => (
              <tr key={v.id}><td>{v.platform}</td><td>{v.label}</td><td>{v.account_id ?? "—"}</td><td>{v.credential_ref ?? "—"}</td><td>{v.enabled ? "✓" : "—"}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginBlockStart: "var(--am-space-4)" }}>
          <strong style={{ fontFamily: "var(--am-font-ui)" }}>Credential Secrets</strong>
          <ul style={{ fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-200)" }}>
            {vendorSecrets.length === 0 && <li style={{ color: "var(--am-color-ink-700)" }}>No vendors to validate.</li>}
            {vendorSecrets.map((s: any) => (
              <li key={s.vendor_id}>
                <code>{s.rotation_target}</code> — {s.platform}/{s.label}: {s.configured ? "✓ configured" : "✗ MISSING"}
                {!s.conventional && <> · expected <code>{s.expected_credential_ref}</code></>}
              </li>
            ))}
          </ul>
        </div>
      </section>


      {/* Submissions */}
      <section style={card}>
        <div style={h}>Storefront Submissions</div>
        <SubmissionForm slug={slug} busy={busy} vendors={vendors} onCreate={(d) => wrap(() => createSubmission({ data: d }))} />
        <table style={{ width: "100%", borderCollapse: "collapse", marginBlockStart: "var(--am-space-3)" }}>
          <thead><tr><th align="left">Platform</th><th align="left">Status</th><th align="left">ISBN</th><th align="left">Submitted</th><th></th></tr></thead>
          <tbody>
            {submissions.length === 0 && <tr><td colSpan={5} style={{ padding: 8 }}>No submissions.</td></tr>}
            {submissions.map((s: any) => (
              <tr key={s.id}>
                <td>{s.platform}</td>
                <td>
                  <select value={s.status} onChange={(e) =>
                    wrap(() => updateSubmission({ data: { id: s.id, slug, status: e.target.value as typeof SUBMISSION_STATES[number] } }))
                  }>
                    {SUBMISSION_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                </td>
                <td>{s.isbn ?? "—"}</td>
                <td>{s.submitted_at ? new Date(s.submitted_at).toISOString().slice(0,10) : "—"}</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Artifacts + Queue */}
      <section style={card}>
        <div style={h}>Artifacts & Queue</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn} disabled={busy} onClick={() => wrap(() => generatePublicationArtifacts({ data: { slug } }))}>
            Generate artifacts
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const r = await runReferencePdfRunner({ data: { slug, mode: "ok" } });
            alert(`PDF runner: ${r.ok ? "OK" : "FAIL"} (status ${r.callback_status})\n${r.signed_url ?? ""}`);
          })}>
            Run reference PDF runner
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const r = await runReferenceKfxRunner({ data: { slug, mode: "ok" } });
            alert(`KFX runner: ${r.ok ? "OK" : "FAIL"} (status ${r.callback_status})\n${r.signed_url ?? ""}`);
          })}>
            Run reference KFX runner
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const modes = ["invalid_signature", "missing_artifact", "failed_generation"] as const;
            const results: string[] = [];
            for (const m of modes) {
              const r = await runReferencePdfRunner({ data: { slug, mode: m } });
              results.push(`pdf/${m}: status ${r.callback_status} ok=${r.ok}`);
            }
            for (const m of modes) {
              const r = await runReferenceKfxRunner({ data: { slug, mode: m } });
              results.push(`kfx/${m}: status ${r.callback_status} ok=${r.ok}`);
            }
            alert("Failure paths:\n" + results.join("\n"));
          })}>
            Run failure simulations
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const targets = SUPPORTED_VENDOR_PLATFORMS;
            const results: string[] = [];
            for (const t of targets) {
              const pkg = await buildPublicationSubmissionPackage({ data: { slug, platform: t } });
              results.push(`${t}: ${pkg.ready ? "READY" : "BLOCKED"} (${pkg.issues.filter((i: any) => i.level === "error").length} errors)`);
            }
            alert("Submission packages:\n" + results.join("\n"));
          })}>
            Validate submission packages
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const r = await runExternalKindlegenRunner({ data: { slug } });
            alert(`External KindleGen: ${r.ok ? "OK" : "FAIL"} (${r.failure ?? "—"})\n${r.errors.join("\n") || r.signed_url || ""}`);
          })}>
            Run external KindleGen
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const r = await runKdpAdapterFn({ data: { slug } });
            alert(`KDP adapter (${r.mode}) → ${r.state}\nresponse: ${r.response.status} — ${r.response.message}\nerrors: ${r.issues.filter((i: any) => i.level === "error").length}`);
          })}>
            Run KDP dry-run
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const r = await runPublicationDryRunFn({ data: { slug } });
            const lines = [
              `Verdict: ${r.verdict} (${r.readinessScore}%)`,
              `Artifacts: epub=${r.artifactSummary.epub} kindle=${r.artifactSummary.kindle} pdf=${r.artifactSummary.pdf} (${r.artifactSummary.activeCount} active)`,
              `KDP state: ${r.kdp.state} · package ready: ${r.kdp.package.ready}`,
              r.blockers.length ? `Blockers:\n - ${r.blockers.slice(0, 8).join("\n - ")}` : "Blockers: none",
              r.warnings.length ? `Warnings: ${r.warnings.length}` : "",
            ].filter(Boolean);
            alert(lines.join("\n"));
          })}>
            Run full publication dry-run
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const h = await kindleProviderHealthFn();
            const r = await runKindleFailoverFn({ data: { slug } });
            alert([
              `Kindle providers — primary: ${h.primary?.id} (available=${h.primary?.available}); fallback: ${h.fallback?.id}`,
              `Attempts: ${r.attempted.length} · failover used: ${r.failoverUsed}`,
              `Final: ${r.final.provider} ok=${r.final.ok}${r.final.failure ? ` failure=${r.final.failure}` : ""}`,
            ].join("\n"));
          })}>
            Run Kindle (primary → fallback)
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const r = await runKindleFailoverFn({ data: { slug, forceFallback: true } });
            alert(`Forced fallback: provider=${r.final.provider} ok=${r.final.ok} failover_used=${r.failoverUsed}`);
          })}>
            Force fallback (proof)
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const g = await evaluateGovernanceGateFn({ data: { slug, platform: "kdp" } });
            alert([
              `Governance gate (kdp): ${g.approved ? "APPROVED" : "BLOCKED"}`,
              ...Object.entries(g.checks).map(([k, v]) => ` - ${k}: ${v ? "✓" : "✗"}`),
              g.blockers.length ? `Blockers:\n - ${g.blockers.join("\n - ")}` : "",
            ].filter(Boolean).join("\n"));
          })}>
            Evaluate governance gate (KDP)
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            if (!confirm("Execute LIVE KDP submission? This will mark the submission row as submitted/rejected and persist a receipt.")) return;
            const approver = prompt("Approver name (for audit log):") ?? undefined;
            const r = await runLiveKdpSubmissionFn({ data: { slug, liveEnabled: true, approver } });
            alert([
              `Mode: ${r.mode}`,
              r.receipt ? `Receipt: ${r.receipt.receipt_id} · accepted=${r.receipt.accepted}` : "(no receipt)",
              r.message,
            ].join("\n"));
          })}>
            Execute live KDP submission
          </button>
          <button style={btn} disabled={busy} onClick={() => wrap(async () => {
            const r = await revalidateReadinessFn({ data: { slug, trigger: "manual" } });
            alert(`Readiness: ${r.score}% (ready=${r.ready}) · blockers=${r.blockers.length} · warnings=${r.warnings.length}`);
          })}>
            Revalidate readiness
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--am-space-5)", marginBlockStart: "var(--am-space-4)" }}>
          <div>
            <strong>Active artifacts ({artifacts.rows.filter((r: any) => r.is_active).length})</strong>
            <ul style={{ fontFamily: "var(--am-font-ui)" }}>
              {artifacts.rows.filter((r: any) => r.is_active).map((a: any) => (
                <li key={a.id}>
                  {a.kind}{a.target ? `/${a.target}` : ""} v{a.version} · {(a.byte_size/1024).toFixed(1)}KB
                  {artifacts.signed[a.id] && <> · <a href={artifacts.signed[a.id]} target="_blank" rel="noreferrer">download</a></>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Distribution queue ({queue.length})</strong>
            <ul style={{ fontFamily: "var(--am-font-ui)" }}>
              {queue.map((q: any) => <li key={q.id}>{q.target} · {q.state}{q.artifact_url ? " · ✓ artifact" : ""}</li>)}
            </ul>
          </div>
        </div>
        <div style={{ marginBlockStart: "var(--am-space-3)", fontFamily: "var(--am-font-ui)", fontSize: "var(--am-type-200)", color: "var(--am-color-ink-700)" }}>
          Assets registered: {assets.length} ({assets.filter((a: any) => a.is_active).length} active)
        </div>
      </section>
    </main>
  );
}

function IsbnForm(props: { slug: string; busy: boolean; onAdd: (d: { slug: string; isbn: string; format: string; edition?: string }) => void }) {
  const [isbn, setIsbn] = React.useState("");
  const [format, setFormat] = React.useState<string>("ebook");
  const [edition, setEdition] = React.useState("1");
  return (
    <form onSubmit={(e) => { e.preventDefault(); props.onAdd({ slug: props.slug, isbn, format, edition }); setIsbn(""); }}
      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input placeholder="ISBN-13" value={isbn} onChange={(e) => setIsbn(e.target.value)} required />
      <select value={format} onChange={(e) => setFormat(e.target.value)}>
        {ISBN_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <input style={{ width: 60 }} value={edition} onChange={(e) => setEdition(e.target.value)} />
      <button style={btn} disabled={props.busy}>Assign ISBN</button>
    </form>
  );
}

function VendorForm(props: { busy: boolean; onSave: (d: { platform: string; label: string; account_id?: string; credential_ref?: string }) => void }) {
  const [platform, setPlatform] = React.useState<string>(SUPPORTED_VENDOR_PLATFORMS[0]);
  const [label, setLabel] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [cred, setCred] = React.useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault();
      props.onSave({ platform, label, account_id: account || undefined, credential_ref: cred || undefined });
      setLabel(""); setAccount(""); setCred("");
    }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
        {SUPPORTED_VENDOR_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} required />
      <input placeholder="Account ID" value={account} onChange={(e) => setAccount(e.target.value)} />
      <input placeholder="Credential ref (secret name)" value={cred} onChange={(e) => setCred(e.target.value)} />
      <button style={btn} disabled={props.busy}>Save vendor</button>
    </form>
  );
}

function SubmissionForm(props: {
  slug: string; busy: boolean;
  vendors: Array<{ id: string; platform: string; label: string }>;
  onCreate: (d: { slug: string; platform: string; vendor_id?: string | null; isbn?: string | null }) => void;
}) {
  const [platform, setPlatform] = React.useState<string>(SUPPORTED_VENDOR_PLATFORMS[0]);
  const [vendorId, setVendorId] = React.useState<string>("");
  const [isbn, setIsbn] = React.useState<string>("");
  const matching = props.vendors.filter((v) => v.platform === platform);
  return (
    <form onSubmit={(e) => { e.preventDefault();
      props.onCreate({ slug: props.slug, platform, vendor_id: vendorId || null, isbn: isbn || null });
      setIsbn("");
    }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={platform} onChange={(e) => { setPlatform(e.target.value); setVendorId(""); }}>
        {SUPPORTED_VENDOR_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
        <option value="">— vendor (optional) —</option>
        {matching.map((v: any) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      <input placeholder="ISBN (optional)" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
      <button style={btn} disabled={props.busy}>Create submission</button>
    </form>
  );
}
