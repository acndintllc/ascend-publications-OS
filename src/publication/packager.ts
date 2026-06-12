/* PTL-025 Phase 11–12 — Publication package builder.
   Pure-JS coordinator that produces a single zipped publication
   bundle containing manifest, metadata, serializers, EPUB(s),
   Kindle EPUB, print-ready HTML (PDF source), and validation
   reports. Real KFX/PDF compilation happens off-Worker per the
   external runner contract (see /api/public/render.kindle.ts);
   the bundle is the upstream input for that runner. */
import { zipSync, strToU8, type Zippable } from "fflate";
import type { ACADocument } from "@/manuscript/schema/aca";
import { buildEpub } from "@/manuscript/package/epub-zip";
import { renderChapterXHTML } from "@/manuscript/package/epub-xhtml";
import { manuscriptCSS } from "@/manuscript/package/epub-css";
import type { PublicationMetadata } from "./metadata";
import { adaptForAllTargets } from "./metadata";
import type { AssetRecord } from "./assets";
import type { ReadinessReport } from "./readiness";
import type { PublicationProfile } from "./profiles";
import { serializeAll, buildOnix } from "./serializers";

export interface PackageInputs {
  slug: string;
  doc: ACADocument;
  metadata: PublicationMetadata;
  profile: PublicationProfile;
  assets: AssetRecord[];
  readiness: ReadinessReport;
}

export interface PackageArtifact {
  filename: string;
  bytes: Uint8Array;
  mediaType: "application/zip";
}

/** Print-ready single-file HTML (PDF source). The external runner converts
 *  this to PDF via headless Chromium per the PTL-016 runner contract. */
function printableHtml(doc: ACADocument): string {
  const xhtml = renderChapterXHTML(doc);
  // Strip the XML/DOCTYPE prologue and merge into HTML5 shell with
  // the same flattened stylesheet that EPUB uses.
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(xhtml);
  const body = bodyMatch ? bodyMatch[1] : xhtml;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${doc.frontmatter.title}</title>
<style>${manuscriptCSS()}
@page { size: 6in 9in; margin: 0.75in; }
@media print { body { font-family: "Source Serif 4", Georgia, serif; } }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Validation-report stub (per-target) — surfaces blockers from readiness +
 *  serializer issues. Real EPUBCheck / KDP validators run off-Worker. */
function buildValidationReports(inputs: PackageInputs) {
  const adapters = adaptForAllTargets(inputs.metadata);
  const perTarget = adapters.map((a) => ({
    target: a.target,
    status: a.issues.some((i) => i.level === "error")
      ? "blocked"
      : a.issues.length > 0
      ? "warning"
      : "ready",
    issues: a.issues,
  }));
  return {
    slug: inputs.slug,
    generated_at: new Date().toISOString(),
    readiness_percent: inputs.readiness.percent,
    ready: inputs.readiness.ready,
    blockers: inputs.readiness.blockers,
    recommendations: inputs.readiness.recommendations,
    targets: perTarget,
  };
}

export function buildPackage(inputs: PackageInputs): PackageArtifact {
  const { slug, doc, metadata, profile, assets, readiness } = inputs;
  const targets = profile.behavior.export.targets;

  const files: Zippable = {};

  // ── manifest
  files["manifest.json"] = strToU8(JSON.stringify({
    slug,
    package_version: "1.0",
    generated_at: new Date().toISOString(),
    profile: profile.id,
    publication: {
      title: metadata.title,
      author: metadata.author,
      version: "0.1.0",
    },
    contents: {
      metadata: "metadata/",
      assets: "assets/",
      exports: "exports/",
      validation: "validation/",
      serializers: "distribution/",
    },
    readiness: { percent: readiness.percent, ready: readiness.ready },
  }, null, 2));

  // ── metadata
  files["metadata/publication.json"] = strToU8(JSON.stringify(metadata, null, 2));
  const onix = buildOnix(metadata, slug);
  files[`metadata/${onix.filename}`] = strToU8(onix.body);

  // ── assets (manifest only; binary assets stay in storage, referenced by URL)
  files["assets/manifest.json"] = strToU8(JSON.stringify(
    assets.filter((a) => a.is_active).map((a) => ({
      kind: a.kind, version: a.version, url: a.url, label: a.label, uploaded_at: a.uploaded_at,
    })), null, 2,
  ));

  // ── exports
  if (targets.includes("epub")) {
    const epub = buildEpub(doc, "epub3");
    files[`exports/${epub.filename}`] = epub.bytes;
  }
  if (targets.includes("kindle")) {
    const kindle = buildEpub(doc, "kindle");
    files[`exports/${kindle.filename}`] = kindle.bytes;
  }
  if (targets.includes("pdf")) {
    files[`exports/${slug}.print.html`] = strToU8(printableHtml(doc));
  }
  if (targets.includes("html-reader")) {
    files[`exports/${slug}.reader.xhtml`] = strToU8(renderChapterXHTML(doc));
  }

  // ── distribution serializers
  for (const payload of serializeAll(metadata, slug)) {
    files[`distribution/${payload.filename}`] = strToU8(payload.body);
  }

  // ── validation
  const report = buildValidationReports(inputs);
  files["validation/report.json"] = strToU8(JSON.stringify(report, null, 2));

  const bytes = zipSync(files);
  return {
    filename: `${slug}.publication-package.zip`,
    bytes,
    mediaType: "application/zip",
  };
}

/** Per-platform sub-package — used for the store-submission workflow. */
export function buildStorePackage(
  inputs: PackageInputs,
  target: import("./metadata").DistributionTarget,
): PackageArtifact {
  const { slug, doc, metadata, profile, assets } = inputs;
  const files: Zippable = {};

  const serializer = serializeAll(metadata, slug).find((s) => s.target === target);
  if (serializer) files[serializer.filename] = strToU8(serializer.body);

  const onix = buildOnix(metadata, slug);
  files[onix.filename] = strToU8(onix.body);

  const profileEpub = profile.behavior.export.epubProfile;
  if (target === "kdp") {
    files[`${slug}.kindle.epub`] = buildEpub(doc, "kindle").bytes;
  } else {
    files[`${slug}.epub`] = buildEpub(doc, profileEpub).bytes;
  }

  files["assets-manifest.json"] = strToU8(JSON.stringify(
    assets.filter((a) => a.is_active).map((a) => ({ kind: a.kind, url: a.url })), null, 2,
  ));
  files["metadata.json"] = strToU8(JSON.stringify(metadata, null, 2));

  return {
    filename: `${slug}.${target}.submission.zip`,
    bytes: zipSync(files),
    mediaType: "application/zip",
  };
}
