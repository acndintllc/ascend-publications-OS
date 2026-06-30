/* /ascend/validate/$slug — manuscript validation report.
   Rendered with shadcn UI primitives so the report reads as a styled
   dashboard (cards, table, severity badges) instead of raw text. */
import * as React from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getManuscript } from "@/manuscript/library";
import type { ChapterRhythm, ValidationIssue, ValidationReport } from "@/manuscript/validate";
import type { ACADocument } from "@/manuscript/schema/aca";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/ascend/validate/$slug")({
  loader: async ({ params }) => {
    const entry = getManuscript(params.slug);
    if (entry) return { doc: entry.doc, report: entry.report, slug: entry.slug };
    const { loadManuscriptValidation } = await import("@/lib/publication.functions");
    const res = await loadManuscriptValidation({ data: { slug: params.slug } });
    if (!res) throw notFound();
    return { doc: res.doc, report: res.report, slug: res.slug };
  },

  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Validate · ${loaderData.doc.frontmatter.title} — ASCEND`
          : "ASCEND Validate",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  notFoundComponent: () => (
    <main style={{ padding: 40, color: "#a0a0a0", textAlign: "center" }}>
      <p>Manuscript not found.</p>
      <Link to="/ascend/library" style={{ color: "#5cbdb9" }}>← Library</Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main style={{ padding: 40, color: "#fca5a5" }}>
      <p>Validation crashed: {error.message}</p>
    </main>
  ),
  component: ValidateRoute,
});

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const PANEL = "#0a0a0a";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

const SEV_STYLE: Record<ValidationIssue["severity"], React.CSSProperties> = {
  error: { background: "#3a0d0d", color: "#fca5a5", borderColor: "#7f1d1d" },
  warning: { background: "#3a290d", color: "#e8c07a", borderColor: "#7f5a1d" },
  info: { background: "#0d263a", color: "#7dd3fc", borderColor: "#1d5a7f" },
};

function ValidateRoute() {
  const { doc, report, slug } = Route.useLoaderData() as {
    doc: ACADocument;
    report: ValidationReport;
    slug: string;
  };

  const counts = report.issues.reduce(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  const words = doc.enrichment?.stats.words ?? 0;
  const minutes = doc.enrichment?.stats.readingMinutes ?? 0;

  return (
    <main style={{ padding: "40px 24px", color: FG, maxWidth: 1100, marginInline: "auto" }}>
      <nav style={{ display: "flex", gap: 14, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
        <Link to="/dashboard" style={{ color: MUTED, textDecoration: "none" }}>← Dashboard</Link>
        <Link to="/ascend/reader/$slug" params={{ slug }} style={{ color: TEAL, textDecoration: "none" }}>Open in Reader →</Link>
      </nav>

      <div style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: TEAL }}>
        Validation Report
      </div>
      <h1 style={{ fontFamily: "Fraunces Variable, Fraunces, serif", color: GOLD, fontSize: 38, margin: "4px 0 0" }}>
        {doc.frontmatter.title}
      </h1>
      <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
        <code style={{ color: MUTED }}>{slug}</code>
      </p>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 24 }}>
        <Stat label="Words" value={words.toLocaleString()} />
        <Stat label="Reading time" value={`~${minutes} min`} />
        <Stat label="Chapters" value={`${report.rhythm.length}`} />
        <Stat label="Issues" value={`${report.issues.length}`} accent={report.issues.length > 0} />
      </div>

      {/* Issues card */}
      <Card style={{ background: PANEL, borderColor: LINE, color: FG, marginTop: 28 }}>
        <CardHeader>
          <CardTitle style={{ color: FG, fontFamily: "Fraunces Variable, Fraunces, serif" }}>
            Issues ({report.issues.length})
          </CardTitle>
          <CardDescription style={{ color: MUTED }}>
            {(["error", "warning", "info"] as const).map((s) => `${counts[s] ?? 0} ${s}`).join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.issues.length === 0 ? (
            <p style={{ color: "#86efac", margin: 0, fontSize: 13 }}>No issues — clean validation.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {report.issues.map((i, ix) => (
                <div key={ix} style={{
                  display: "flex", gap: 12, alignItems: "flex-start", padding: 12,
                  border: `1px solid ${LINE}`, borderRadius: 8, background: "#000",
                }}>
                  <Badge
                    variant="outline"
                    style={{
                      ...SEV_STYLE[i.severity],
                      letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 10,
                      flexShrink: 0,
                    }}
                  >
                    {i.severity}
                  </Badge>
                  <code style={{
                    color: MUTED, fontFamily: "ui-monospace, monospace",
                    fontSize: 12, flexShrink: 0, paddingTop: 2,
                  }}>
                    {i.code}
                  </code>
                  <span style={{ color: FG, fontSize: 13, paddingTop: 1 }}>{i.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rhythm card */}
      <Card style={{ background: PANEL, borderColor: LINE, color: FG, marginTop: 20 }}>
        <CardHeader>
          <CardTitle style={{ color: FG, fontFamily: "Fraunces Variable, Fraunces, serif" }}>
            Chapter Rhythm ({report.rhythm.length})
          </CardTitle>
          <CardDescription style={{ color: MUTED }}>
            Word count, paragraphs, sections, dialogue, and pullquotes per chapter.
          </CardDescription>
        </CardHeader>
        <CardContent style={{ overflowX: "auto" }}>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: LINE }}>
                <TableHead style={th}>#</TableHead>
                <TableHead style={th}>Title</TableHead>
                <TableHead style={{ ...th, textAlign: "right" }}>Words</TableHead>
                <TableHead style={{ ...th, textAlign: "right" }}>¶</TableHead>
                <TableHead style={{ ...th, textAlign: "right" }}>Sections</TableHead>
                <TableHead style={{ ...th, textAlign: "right" }}>Dialogue</TableHead>
                <TableHead style={{ ...th, textAlign: "right" }}>Pull</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rhythm.map((c: ChapterRhythm) => (
                <TableRow key={c.index} style={{ borderColor: LINE }}>
                  <TableCell style={{ ...td, fontFamily: "ui-monospace, monospace", color: MUTED }}>
                    {c.index + 1}
                  </TableCell>
                  <TableCell style={{ ...td, color: FG }}>{c.title}</TableCell>
                  <TableCell style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                    {c.words.toLocaleString()}
                  </TableCell>
                  <TableCell style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                    {c.paragraphs}
                  </TableCell>
                  <TableCell style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                    {c.sections}
                  </TableCell>
                  <TableCell style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                    {c.dialogue}
                  </TableCell>
                  <TableCell style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                    {c.pullquotes}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      padding: 18, borderRadius: 12, border: `1px solid ${LINE}`, background: PANEL,
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: MUTED }}>
        {label}
      </div>
      <div style={{
        fontFamily: "Fraunces Variable, Fraunces, serif",
        fontSize: 32, lineHeight: 1, marginTop: 8,
        color: accent ? "#fca5a5" : GOLD,
      }}>
        {value}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  color: MUTED, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
};
const td: React.CSSProperties = {
  color: FG, fontSize: 13,
};
