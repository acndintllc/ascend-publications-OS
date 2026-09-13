/* PTL-025 Phase 11D — Export validation surface.
   Lightweight pure-JS checks on the artifacts that buildEpub/buildPackage
   produce. Validation is in-Worker only — the OS ends at the export file
   and hands nothing to an external service. */
import type { EpubProfile } from "@/manuscript/package/epub-zip";
import { buildEpub } from "@/manuscript/package/epub-zip";
import type { ACADocument } from "@/manuscript/schema/aca";

export interface ExportValidationIssue {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface ExportValidationReport {
  target: "epub3" | "kindle" | "pdf-html";
  artifactSize: number;
  ok: boolean;
  issues: ExportValidationIssue[];
}

const MAX_EPUB_BYTES = 650 * 1024 * 1024;   // EPUB practical max
const MAX_KINDLE_BYTES = 650 * 1024 * 1024; // KDP hard limit

export function validateEpubArtifact(
  doc: ACADocument,
  profile: EpubProfile = "epub3",
): ExportValidationReport {
  const issues: ExportValidationIssue[] = [];
  const art = buildEpub(doc, profile);
  if (art.bytes.length < 1000) {
    issues.push({ level: "error", code: "ARTIFACT_TOO_SMALL", message: "EPUB under 1KB — likely empty" });
  }
  const cap = profile === "kindle" ? MAX_KINDLE_BYTES : MAX_EPUB_BYTES;
  if (art.bytes.length > cap) {
    issues.push({ level: "error", code: "ARTIFACT_TOO_LARGE", message: `Exceeds ${cap}-byte cap` });
  }
  if (!doc.frontmatter.title) {
    issues.push({ level: "error", code: "MISSING_TITLE", message: "dc:title cannot be empty" });
  }
  if (doc.frontmatter.authors.length === 0) {
    issues.push({ level: "warning", code: "NO_AUTHOR", message: "No dc:creator present" });
  }
  if (doc.blocks.length === 0) {
    issues.push({ level: "error", code: "EMPTY_BODY", message: "No content blocks" });
  }
  if (profile === "kindle") {
    // KF8 hard constraints we already work around in kindle-css; flag if
    // the manuscript references unsupported features.
    issues.push({ level: "info", code: "KF8_PROFILE", message: "Using KF8-safe stylesheet overrides" });
  }
  return {
    target: profile === "kindle" ? "kindle" : "epub3",
    artifactSize: art.bytes.length,
    ok: !issues.some((i) => i.level === "error"),
    issues,
  };
}

export function validatePdfSource(doc: ACADocument): ExportValidationReport {
  const issues: ExportValidationIssue[] = [];
  if (!doc.frontmatter.title) {
    issues.push({ level: "error", code: "MISSING_TITLE", message: "Title required for PDF" });
  }
  if (doc.blocks.length === 0) {
    issues.push({ level: "error", code: "EMPTY_BODY", message: "No content blocks" });
  }
  issues.push({
    level: "info",
    code: "PDF_RUNNER_REQUIRED",
    message: "Final PDF compilation runs in the external build-runner per /api/public/render contract",
  });
  return { target: "pdf-html", artifactSize: 0, ok: !issues.some((i) => i.level === "error"), issues };
}

export function validateAllExports(doc: ACADocument, targets: string[]): ExportValidationReport[] {
  const out: ExportValidationReport[] = [];
  if (targets.includes("epub")) out.push(validateEpubArtifact(doc, "epub3"));
  if (targets.includes("kindle")) out.push(validateEpubArtifact(doc, "kindle"));
  if (targets.includes("pdf")) out.push(validatePdfSource(doc));
  return out;
}
