/* /ascend/live — drag-and-drop live preview (PTL-019 Phase 7B).

   Authors drop a manuscript.md (or .docx), plus optional citations.bib
   and vera.json, and the reader renders instantly with the same
   pipeline used at build time — no redeploy. */
import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Chapter } from "@/components/ascend/primitives";
import { BrandMark } from "@/components/ascend/brand-mark";
import { RenderManuscript } from "@/manuscript/render/aca-renderer";
import {
  ingestBib,
  ingestDocx,
  ingestMarkdown,
  ingestVera,
  type EnrichResult,
} from "@/manuscript/pipeline";
import { registerUploadedPublication } from "@/lib/publication.functions";
import type { BibEntry } from "@/manuscript/schema/aca";
import type { VeraSidecar } from "@/manuscript/enrich/vera";


export const Route = createFileRoute("/_authenticated/ascend/live")({
  head: () => ({
    meta: [
      { title: "ASCEND Live Preview — Drop a Manuscript" },
      {
        name: "description",
        content:
          "Drop a manuscript.md or .docx (plus optional citations.bib and vera.json) and preview it through the full ASCEND pipeline.",
      },
    ],
  }),
  component: LiveRoute,
});

interface Sources {
  bib?: BibEntry[];
  vera?: VeraSidecar;
}

interface RawSource {
  format: "md" | "docx";
  filename: string;
  contentBase64: string;
  bibText?: string;
  veraJson?: string;
}

type Status =
  | { kind: "empty" }
  | { kind: "ready"; result: EnrichResult; sourceName: string; raw: RawSource }
  | { kind: "error"; message: string };

async function readManuscript(file: File, sources: Sources): Promise<EnrichResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const buf = new Uint8Array(await file.arrayBuffer());
    return ingestDocx(buf, sources);
  }
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
    const text = await file.text();
    return ingestMarkdown(text, sources);
  }
  throw new Error(`Unsupported manuscript type: ${file.name}`);
}

function classifyFile(file: File): "manuscript" | "bib" | "vera" | "unknown" {
  const n = file.name.toLowerCase();
  if (n.endsWith(".docx") || n.endsWith(".md") || n.endsWith(".markdown") || n.endsWith(".txt"))
    return "manuscript";
  if (n.endsWith(".bib")) return "bib";
  if (n.endsWith(".json") || n.endsWith("vera.json")) return "vera";
  return "unknown";
}

function LiveRoute() {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>({ kind: "empty" });
  const [dragOver, setDragOver] = React.useState(false);
  const [registering, setRegistering] = React.useState(false);
  const [registered, setRegistered] = React.useState<{ slug: string; created: boolean } | null>(null);
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setRegistered(null);
    setRegisterError(null);
  }, [status.kind === "ready" ? status.sourceName : null]);

  const handleRegister = React.useCallback(async () => {
    if (status.kind !== "ready") return;
    setRegistering(true);
    setRegisterError(null);
    try {
      const fm = status.result.doc.frontmatter;
      const res = await registerUploadedPublication({
        data: {
          title: fm.title,
          subtitle: fm.subtitle ?? null,
          author: fm.authors[0] ?? "Unknown",
          contributors: fm.authors.slice(1),
          manuscript: {
            filename: status.raw.filename,
            format: status.raw.format,
            contentBase64: status.raw.contentBase64,
          },
          bibText: status.raw.bibText,
          veraJson: status.raw.veraJson,
        },
      });
      setRegistered(res);
      void router.invalidate();
    } catch (e) {
      setRegisterError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegistering(false);
    }
  }, [status, router]);



  const ingest = React.useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    let manuscript: File | undefined;
    let bibText: string | undefined;
    let veraJson: string | undefined;
    const sources: Sources = {};
    try {
      for (const f of arr) {
        const kind = classifyFile(f);
        if (kind === "manuscript") manuscript = f;
        else if (kind === "bib") {
          bibText = await f.text();
          sources.bib = ingestBib(bibText);
        } else if (kind === "vera") {
          veraJson = await f.text();
          sources.vera = ingestVera(veraJson);
        }
      }
      if (!manuscript) {
        throw new Error(
          "Drop a manuscript.md or manuscript.docx (optionally with citations.bib and vera.json).",
        );
      }
      const result = await readManuscript(manuscript, sources);
      const bytes = new Uint8Array(await manuscript.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const contentBase64 = btoa(bin);
      const format: "md" | "docx" = manuscript.name.toLowerCase().endsWith(".docx") ? "docx" : "md";
      const raw: RawSource = {
        format, filename: manuscript.name, contentBase64, bibText, veraJson,
      };
      setStatus({ kind: "ready", result, sourceName: manuscript.name, raw });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const onDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) void ingest(e.dataTransfer.files);
    },
    [ingest],
  );

  const onPick = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) void ingest(e.target.files);
    },
    [ingest],
  );

  return (
    <div style={{ minHeight: "100dvh", background: "var(--am-chapter-bg)" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--am-space-3)",
          padding: "var(--am-space-5) var(--am-space-6)",
          background: "var(--am-color-ink-0)",
          borderBottom: "var(--am-border-thin) solid var(--am-color-ink-200)",
          fontFamily: "var(--am-font-ui)",
          fontSize: "var(--am-type-200)",
        }}
      >
        <BrandMark size={72} tone="dark" />
        <span style={{ color: "var(--am-color-ink-400)" }}>·</span>
        <Link
          to="/ascend/library"
          style={{
            letterSpacing: "var(--am-tracking-widest)",
            textTransform: "uppercase",
            color: "var(--am-color-ink-500)",
            textDecoration: "none",
          }}
        >
          ← Library
        </Link>
        <span style={{ color: "var(--am-color-ink-400)" }}>/</span>
        <span
          style={{
            letterSpacing: "var(--am-tracking-widest)",
            textTransform: "uppercase",
            color: "var(--am-color-ink-700)",
          }}
        >
          Live Preview
        </span>
        {status.kind === "ready" ? (
          <>
            <span style={{ color: "var(--am-color-ink-400)" }}>·</span>
            <span style={{ color: "var(--am-color-ink-700)" }}>{status.sourceName}</span>
            <button
              onClick={() => {
                setStatus({ kind: "empty" });
                if (inputRef.current) inputRef.current.value = "";
              }}
              style={{
                marginInlineStart: "var(--am-space-3)",
                padding: "var(--am-space-2) var(--am-space-4)",
                borderRadius: "var(--am-radius-pill)",
                border: "var(--am-border-thin) solid var(--am-color-ink-200)",
                background: "transparent",
                color: "var(--am-color-ink-700)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
              }}
            >
              Clear
            </button>
            {registered ? (
              <>
                <Link
                  to="/ascend/publications/$slug"
                  params={{ slug: registered.slug }}
                  style={{
                    marginInlineStart: "var(--am-space-2)",
                    padding: "var(--am-space-2) var(--am-space-4)",
                    borderRadius: "var(--am-radius-pill)",
                    border: "var(--am-border-thin) solid var(--am-color-accent-500)",
                    background: "var(--am-color-accent-500)",
                    color: "var(--am-color-ink-0)",
                    textDecoration: "none",
                  }}
                >
                  Open publication →
                </Link>
                <Link
                  to="/ascend/publications/$slug/command"
                  params={{ slug: registered.slug }}
                  style={{
                    marginInlineStart: "var(--am-space-2)",
                    padding: "var(--am-space-2) var(--am-space-4)",
                    borderRadius: "var(--am-radius-pill)",
                    border: "var(--am-border-thin) solid var(--am-color-ink-300)",
                    background: "transparent",
                    color: "var(--am-color-ink-700)",
                    textDecoration: "none",
                  }}
                >
                  Command Center
                </Link>
                <span style={{ color: "var(--am-color-ink-500)", fontSize: "var(--am-type-100)" }}>
                  {registered.created ? "Registered" : "Already registered"}
                </span>
              </>
            ) : (
              <button
                onClick={handleRegister}
                disabled={registering}
                style={{
                  marginInlineStart: "var(--am-space-2)",
                  padding: "var(--am-space-2) var(--am-space-4)",
                  borderRadius: "var(--am-radius-pill)",
                  border: "var(--am-border-thin) solid var(--am-color-accent-500)",
                  background: "var(--am-color-accent-500)",
                  color: "var(--am-color-ink-0)",
                  cursor: registering ? "wait" : "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  opacity: registering ? 0.7 : 1,
                }}
              >
                {registering ? "Registering…" : "Register as publication"}
              </button>
            )}
            {registerError ? (
              <span style={{ color: "var(--am-color-danger-700, #8a0019)", fontSize: "var(--am-type-100)" }}>
                {registerError}
              </span>
            ) : null}
          </>
        ) : null}

        {status.kind === "ready" && status.result.report.issues.length ? (
          <span
            style={{
              marginInlineStart: "auto",
              color: "var(--am-color-warn-700, #8a5a00)",
              fontSize: "var(--am-type-100)",
            }}
          >
            {status.result.report.issues.length} validation issue
            {status.result.report.issues.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </nav>

      {status.kind === "ready" ? (
        <Chapter>
          <RenderManuscript doc={status.result.doc} />
        </Chapter>
      ) : (
        <main
          style={{
            maxWidth: "var(--am-chapter-measure)",
            marginInline: "auto",
            paddingBlock: "var(--am-silence-lg)",
            paddingInline: "var(--am-space-6)",
          }}
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            style={{
              border: `2px dashed ${dragOver ? "var(--am-color-accent-500)" : "var(--am-color-ink-300)"}`,
              borderRadius: "var(--am-radius-md, 12px)",
              padding: "var(--am-silence-md) var(--am-space-6)",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver
                ? "color-mix(in oklab, var(--am-color-accent-500) 8%, transparent)"
                : "var(--am-color-ink-0)",
              transition: "background 120ms ease, border-color 120ms ease",
            }}
          >
            <div
              style={{
                fontFamily: "var(--am-font-display)",
                fontSize: "var(--am-type-600)",
                lineHeight: "var(--am-leading-tight)",
                marginBlockEnd: "var(--am-space-4)",
              }}
            >
              Drop a manuscript
            </div>
            <p
              style={{
                fontFamily: "var(--am-font-ui)",
                color: "var(--am-color-ink-600)",
                margin: 0,
                marginBlockEnd: "var(--am-space-4)",
              }}
            >
              Accepts <code>manuscript.md</code> or <code>manuscript.docx</code>. Optional:{" "}
              <code>citations.bib</code>, <code>vera.json</code>. Files are processed in your
              browser — nothing is uploaded.
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".md,.markdown,.txt,.docx,.bib,.json"
              onChange={onPick}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              style={{
                padding: "var(--am-space-3) var(--am-space-5)",
                borderRadius: "var(--am-radius-pill)",
                border: "var(--am-border-thin) solid var(--am-color-accent-500)",
                background: "var(--am-color-accent-500)",
                color: "var(--am-color-ink-0)",
                cursor: "pointer",
                fontFamily: "var(--am-font-ui)",
                fontSize: "var(--am-type-200)",
                letterSpacing: "var(--am-tracking-wide)",
              }}
            >
              Choose files
            </button>
          </div>

          {status.kind === "error" ? (
            <p
              role="alert"
              style={{
                marginBlockStart: "var(--am-space-5)",
                padding: "var(--am-space-4) var(--am-space-5)",
                borderRadius: "var(--am-radius-md, 8px)",
                border: "var(--am-border-thin) solid var(--am-color-danger-500, #b00020)",
                color: "var(--am-color-danger-700, #8a0019)",
                fontFamily: "var(--am-font-ui)",
              }}
            >
              {status.message}
            </p>
          ) : null}
        </main>
      )}
    </div>
  );
}
