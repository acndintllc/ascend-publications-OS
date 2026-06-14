/* /ascend/publications — PTL-021 Phase 9B operations dashboard.
   Loads from the persistent publication_records / publication_metadata
   / publication_vera_config tables via server functions. Seeds from
   the build-time manuscript library on every load (idempotent). */
import * as React from "react";
import { BrandMark } from "@/components/ascend/brand-mark";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  listPublications,
  seedFromLibrary,
  listAllPublicationAssets,
} from "@/lib/publication.functions";
import { scoreAssets, type AssetRecord } from "@/publication/assets";

import { planExports, type ExportPlan } from "@/publication/export";
import {
  adaptForAllTargets,
  type AdapterResult,
  type PublicationMetadata,
  publicationMetadataSchema,
} from "@/publication/metadata";
import { getProfile, type PublicationProfile } from "@/publication/profiles";
import type { PublicationStatus } from "@/publication/status";
import { getManuscript } from "@/manuscript/library";
import { enrich } from "@/manuscript/pipeline";

interface Row {
  slug: string;
  title: string;
  subtitle: string | null;
  author: string;
  status: PublicationStatus;
  version: string;
  profileId: string;
  profile: PublicationProfile | undefined;
  metadata: PublicationMetadata | null;
  plan: ExportPlan | undefined;
  adapters: AdapterResult<PublicationMetadata>[];
  issueCount: number;
  veraKinds: string[];
  assetsReady: boolean;
  assetsScorePct: number;
  assetsMissing: string[];
}


export const Route = createFileRoute("/ascend/publications")({
  head: () => ({
    meta: [
      { title: "ASCEND Publications — Operations" },
      { name: "description", content: "Publication lifecycle, metadata, profiles, and export readiness." },
    ],
  }),
  loader: async () => {
    await seedFromLibrary();
    const [rows, allAssets] = await Promise.all([
      listPublications(),
      listAllPublicationAssets(),
    ]);
    const assetsBySlug = new Map<string, AssetRecord[]>();
    for (const a of allAssets) {
      const arr = assetsBySlug.get(a.slug) ?? [];
      arr.push(a);
      assetsBySlug.set(a.slug, arr);
    }
    const out: Row[] = rows.map((entry) => {
      const r = entry.record;
      const lib = getManuscript(r.slug);
      const enriched = lib
        ? enrich(lib.doc, { bib: lib.bib, vera: lib.veraSidecar })
        : undefined;
      const recordForPlan = {
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle ?? undefined,
        series: r.series ?? undefined,
        volume: r.volume ?? undefined,
        status: r.status,
        version: r.version,
        profile: r.profile,
        lastUpdated: r.last_updated,
        author: r.author,
      };
      const plan = enriched ? planExports(recordForPlan, enriched) : undefined;
      const meta = entry.metadata;
      const parsed = meta
        ? publicationMetadataSchema.safeParse({
            title: r.title,
            subtitle: r.subtitle ?? undefined,
            description: meta.description || r.title,
            keywords: meta.keywords,
            categories: meta.categories,
            author: r.author,
            contributors: meta.contributors,
            language: r.language,
            audience: r.audience ?? undefined,
            publicationDate: r.publication_date ?? undefined,
            isbn: meta.isbn ?? undefined,
            publisher: meta.publisher,
            rights: meta.rights ?? undefined,
          })
        : undefined;
      const metadata = parsed?.success ? parsed.data : null;
      const readiness = scoreAssets(r.profile, assetsBySlug.get(r.slug) ?? []);
      return {
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        author: r.author,
        status: r.status,
        version: r.version,
        profileId: r.profile,
        profile: getProfile(r.profile),
        metadata,
        plan,
        adapters: metadata ? adaptForAllTargets(metadata) : [],
        issueCount: enriched?.report.issues.length ?? 0,
        veraKinds: entry.vera?.enabled_kinds ?? [],
        assetsReady: readiness.ready,
        assetsScorePct: Math.round(readiness.score * 100),
        assetsMissing: readiness.missingRequired,
      };
    });
    return { rows: out };
  },

  component: PublicationsRoute,
});

const cell: React.CSSProperties = {
  padding: "var(--am-space-3)",
  borderBlockEnd: "1px solid var(--am-color-ink-200)",
  fontFamily: "var(--am-font-ui)",
  fontSize: "var(--am-type-200)",
  verticalAlign: "top",
};

function PublicationsRoute() {
  const { rows } = Route.useLoaderData() as { rows: Row[] };
  const router = useRouter();
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
      <div style={{ maxWidth: 1200, marginInline: "auto" }}>
        <div style={{ marginBlockEnd: "var(--am-space-5)" }}>
          <BrandMark size={40} tagline />
        </div>
        <div
          style={{
            fontFamily: "var(--am-font-ui)",
            letterSpacing: "var(--am-tracking-widest)",
            textTransform: "uppercase",
            fontSize: "var(--am-sourcenote-size)",
            color: "var(--am-color-ink-500)",
            marginBlockEnd: "var(--am-space-5)",
          }}
        >
          ASCEND / Publications · persistent
        </div>
        <h1
          style={{
            fontFamily: "var(--am-font-display)",
            fontSize: "var(--am-type-800)",
            margin: 0,
            marginBlockEnd: "var(--am-silence-sm)",
          }}
        >
          Publication Operations
        </h1>
        <nav
          style={{
            fontFamily: "var(--am-font-ui)",
            fontSize: "var(--am-type-200)",
            display: "flex",
            gap: "var(--am-space-5)",
            marginBlockEnd: "var(--am-silence-md)",
            alignItems: "center",
          }}
        >
          <Link to="/ascend/library">→ Library</Link>
          <Link to="/ascend/live">→ Live preview</Link>
          <button
            type="button"
            onClick={() => router.invalidate()}
            style={{
              marginInlineStart: "auto",
              padding: "var(--am-space-2) var(--am-space-4)",
              borderRadius: "var(--am-radius-pill)",
              border: "1px solid var(--am-color-ink-300)",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: "inherit",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </nav>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Title", "Profile", "Status", "Version", "Issues", "Export readiness", "Distribution", "VERA", "Assets"].map((h) => (
                <th key={h} style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const okTargets = row.plan?.checks.filter((c) => c.ready).map((c) => c.target) ?? [];
              const blockedTargets = row.plan?.checks.filter((c) => !c.ready).map((c) => c.target) ?? [];
              const adapterErrors = row.adapters.flatMap((a) =>
                a.issues.filter((i) => i.level === "error").map(() => a.target),
              );
              return (
                <tr key={row.slug}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>
                      <Link to="/ascend/publications/$slug" params={{ slug: row.slug }}>
                        {row.title}
                      </Link>
                    </div>
                    {row.subtitle && (
                      <div style={{ color: "var(--am-color-ink-500)" }}>{row.subtitle}</div>
                    )}
                    <div style={{ color: "var(--am-color-ink-500)", marginBlockStart: 4 }}>
                      {row.author}
                    </div>
                    <div style={{ marginBlockStart: 4, display: "flex", gap: 12 }}>
                      <Link to="/ascend/reader/$slug" params={{ slug: row.slug }}>read →</Link>
                      <Link to="/ascend/publications/$slug/distribute" params={{ slug: row.slug }}>distribute →</Link>
                    </div>
                  </td>
                  <td style={cell}>
                    {row.profile?.label ?? row.profileId}
                    {row.profile?.lines.length ? (
                      <div style={{ color: "var(--am-color-ink-500)" }}>{row.profile.lines.join(" · ")}</div>
                    ) : null}
                  </td>
                  <td style={cell}>{row.status}</td>
                  <td style={cell}>{row.version}</td>
                  <td style={cell}>
                    {row.issueCount === 0 ? "clean" : `${row.issueCount}`}{" "}
                    <Link to="/ascend/validate/$slug" params={{ slug: row.slug }}>
                      audit →
                    </Link>
                  </td>
                  <td style={cell}>
                    <div style={{ color: okTargets.length ? "inherit" : "var(--am-color-ink-500)" }}>
                      ✓ {okTargets.join(", ") || "—"}
                    </div>
                    {blockedTargets.length > 0 && (
                      <div style={{ color: "var(--am-color-ink-500)" }}>
                        ✗ {blockedTargets.join(", ")}
                      </div>
                    )}
                  </td>
                  <td style={cell}>
                    {adapterErrors.length === 0
                      ? row.metadata
                        ? "metadata complete"
                        : "—"
                      : `missing: ${Array.from(new Set(adapterErrors)).join(", ")}`}
                  </td>
                  <td style={cell}>
                    {row.veraKinds.length === 0 ? "—" : `${row.veraKinds.length} kinds`}
                  </td>
                  <td style={cell}>
                    <div style={{ color: row.assetsReady ? "inherit" : "#b91c1c" }}>
                      {row.assetsScorePct}% {row.assetsReady ? "✓" : ""}
                    </div>
                    {row.assetsMissing.length > 0 && (
                      <div style={{ color: "var(--am-color-ink-500)" }}>
                        missing: {row.assetsMissing.join(", ")}
                      </div>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>

        <section
          style={{
            marginBlockStart: "var(--am-silence-md)",
            fontFamily: "var(--am-font-ui)",
            fontSize: "var(--am-type-200)",
            color: "var(--am-color-ink-500)",
          }}
        >
          <p>
            Data persists in Lovable Cloud. New manuscripts in <code>/manuscripts</code>
            are auto-seeded on first dashboard load. Click a title to edit metadata,
            transition status, or change VERA configuration.
          </p>
        </section>
      </div>
    </main>
  );
}
