/* PTL-030 Phase 19B — Catalogue evaluator. Pure module.

   Evaluates the acceptance rules that can be decided from metadata alone.
   Rules that need the artifact bytes (cover colour space, pixel
   dimensions, interior image size, packaged file size) are reported in
   `notEvaluated` rather than silently passing — a readiness verdict must
   never imply it checked something it did not. */
import type { DistributionTarget, PublicationMetadata } from "../metadata";
import type { IsbnRow } from "../isbn";
import { isValidIsbn13 } from "../isbn";
import type { SerializedPayload } from "../serializers";
import { ACCEPTANCE_RULES, getRule } from "./catalogue";
import type { AcceptanceRule, Evidence, ReadinessFinding } from "./types";

export interface PreflightInput {
  metadata: PublicationMetadata | null;
  isbns: IsbnRow[];
  destinations: DistributionTarget[];
  /** Per-destination metadata issues already computed by the serializers. */
  serialized?: SerializedPayload[];
}

export interface PreflightResult {
  findings: ReadinessFinding[];
  /** Rule IDs in scope that this pass could not decide (needs artifact bytes). */
  notEvaluated: string[];
}

/** Rules decided from the artifact bytes, not metadata. Phase 19C. */
const NEEDS_ARTIFACT_BYTES = new Set([
  "kdp.cover.colorspace", "kdp.cover.min-short-edge", "kdp.cover.ideal-dimensions",
  "kdp.cover.format", "kdp.cover.dpi",
  "apple.cover.colorspace", "apple.cover.min-short-edge", "apple.cover.format",
  "apple.cover.dpi", "apple.interior-image.max-pixels",
  "kobo.format.epub-only", "kobo.cover.min-short-edge",
  "google.file.max-size",
]);

function finding(
  rule: AcceptanceRule,
  destination: DistributionTarget,
  message: string,
  opts: { field?: string; evidence?: Evidence } = {},
): ReadinessFinding {
  return {
    ruleId: rule.ruleId,
    severity: rule.severity,
    destination,
    field: opts.field,
    message,
    remediation: rule.remediation,
    evidence: opts.evidence,
    source: rule.source,
    requiresHumanConfirmation: rule.requiresHumanConfirmation,
  };
}

/** Tag names present in a description, lowercased, in document order. */
function htmlTagsIn(html: string): string[] {
  const out: string[] = [];
  const re = /<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1].toLowerCase());
  return out;
}

function wordList(rule: AcceptanceRule, key: string): string[] {
  const v = rule.params?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function containsTerm(haystack: string, term: string): boolean {
  return new RegExp(`(^|\\W)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i")
    .test(haystack);
}

export function runPreflight(input: PreflightInput): PreflightResult {
  const { metadata, isbns, destinations } = input;
  const findings: ReadinessFinding[] = [];
  const notEvaluated = new Set<string>();

  for (const rule of ACCEPTANCE_RULES) {
    const scoped = rule.destinations.filter((d) => destinations.includes(d));
    if (scoped.length === 0) continue;
    if (NEEDS_ARTIFACT_BYTES.has(rule.ruleId)) {
      notEvaluated.add(rule.ruleId);
      continue;
    }
    for (const dest of scoped) {
      findings.push(...evaluateRule(rule, dest, metadata, isbns));
    }
  }

  // Per-destination issues the serializers already computed. These are the
  // storefronts' own adapter checks; without this they were being discarded.
  // A catalogue rule that already fired for the same destination and field
  // wins — the author should see one finding per defect, not two.
  const covered = new Set(
    findings.filter((f) => f.field).map((f) => `${f.destination}:${f.field}`),
  );
  for (const payload of input.serialized ?? []) {
    const dest = payload.target as DistributionTarget;
    if (!destinations.includes(dest)) continue;
    for (const issue of payload.issues) {
      if (covered.has(`${dest}:${issue.field}`)) continue;
      findings.push({
        ruleId: `serializer.${payload.target}.${issue.field}`,
        severity: issue.level === "error" ? "blocker" : "warning",
        destination: dest,
        field: issue.field,
        message: issue.message,
      });
    }
  }

  return { findings, notEvaluated: Array.from(notEvaluated).sort() };
}

function evaluateRule(
  rule: AcceptanceRule,
  dest: DistributionTarget,
  metadata: PublicationMetadata | null,
  isbns: IsbnRow[],
): ReadinessFinding[] {
  const out: ReadinessFinding[] = [];

  switch (rule.ruleId) {
    case "kdp.description.length": {
      const max = Number(rule.params?.maxChars ?? 4000);
      const len = metadata?.description?.length ?? 0;
      if (len > max) {
        out.push(finding(rule, dest,
          `Description is ${len} characters, over the ${max}-character limit. HTML tags count toward the limit.`,
          { field: "description", evidence: { length: len, limit: max } }));
      }
      break;
    }

    case "kdp.description.html-whitelist": {
      const allowed = new Set(wordList(rule, "allowed"));
      const used = Array.from(new Set(htmlTagsIn(metadata?.description ?? "")));
      const bad = used.filter((t) => !allowed.has(t));
      if (bad.length > 0) {
        out.push(finding(rule, dest,
          `Description uses unsupported HTML: ${bad.map((t) => `<${t}>`).join(", ")}.`,
          { field: "description", evidence: { unsupported: bad, allowed: Array.from(allowed) } }));
      }
      break;
    }

    case "kdp.keywords.count": {
      const max = Number(rule.params?.maxKeywords ?? 7);
      const n = metadata?.keywords.length ?? 0;
      if (n > max) {
        out.push(finding(rule, dest, `${n} keywords supplied; only ${max} slots exist.`,
          { field: "keywords", evidence: { count: n, limit: max } }));
      }
      break;
    }

    case "kdp.keywords.slot-length": {
      const max = Number(rule.params?.maxCharsPerKeyword ?? 50);
      const over = (metadata?.keywords ?? []).filter((k) => k.length > max);
      for (const k of over) {
        out.push(finding(rule, dest,
          `Keyword "${k}" is ${k.length} characters, over the ${max}-character slot limit.`,
          { field: "keywords", evidence: { keyword: k, length: k.length, limit: max } }));
      }
      break;
    }

    case "kdp.keywords.prohibited-content": {
      const subjective = wordList(rule, "subjectiveClaims");
      const timed = wordList(rule, "timeSensitive");
      const cats = (metadata?.categories ?? []).map((c) => c.toLowerCase());
      for (const k of metadata?.keywords ?? []) {
        const hitSubjective = subjective.filter((t) => containsTerm(k, t));
        const hitTimed = timed.filter((t) => containsTerm(k, t));
        const hitCategory = cats.some((c) => c === k.toLowerCase());
        if (hitSubjective.length || hitTimed.length) {
          out.push(finding(rule, dest,
            `Keyword "${k}" contains prohibited content: ${[...hitSubjective, ...hitTimed].join(", ")}.`,
            { field: "keywords", evidence: { keyword: k, subjective: hitSubjective, timeSensitive: hitTimed } }));
        } else if (hitCategory) {
          out.push(finding(rule, dest,
            `Keyword "${k}" duplicates a category, which wastes a slot and is discouraged.`,
            { field: "keywords", evidence: { keyword: k } }));
        }
      }
      break;
    }

    case "kdp.categories.count":
    case "kobo.categories.count": {
      const max = Number(rule.params?.maxCategories ?? 3);
      const n = metadata?.categories.length ?? 0;
      if (n > max) {
        out.push(finding(rule, dest, `${n} categories supplied; the limit is ${max}.`,
          { field: "categories", evidence: { count: n, limit: max } }));
      }
      break;
    }

    case "kdp.title.combined-length": {
      const max = Number(rule.params?.maxCombinedChars ?? 200);
      const len = (metadata?.title ?? "").length + (metadata?.subtitle ?? "").length;
      if (len >= max) {
        out.push(finding(rule, dest,
          `Title and subtitle total ${len} characters; they must be fewer than ${max}.`,
          { field: "title", evidence: { combinedLength: len, limit: max } }));
      }
      break;
    }

    case "kdp.title.matches-cover": {
      // Undecidable from the files — surfaced so a human confirms it rather
      // than the verdict quietly implying it was checked.
      out.push(finding(rule, dest,
        "Confirm the title, subtitle, author and series on the cover artwork match the metadata exactly.",
        { field: "cover", evidence: { title: metadata?.title ?? null, subtitle: metadata?.subtitle ?? null } }));
      break;
    }

    case "isbn.checksum-valid": {
      for (const row of isbns) {
        if (!isValidIsbn13(row.isbn)) {
          out.push(finding(rule, dest, `ISBN "${row.isbn}" has an invalid ISBN-13 check digit.`,
            { field: "isbn", evidence: { isbn: row.isbn } }));
        }
      }
      break;
    }

    case "isbn.not-required-for-retail": {
      if (isbns.length === 0) {
        out.push(finding(rule, dest,
          "No ISBN assigned — not required here; this destination issues its own identifier.",
          { field: "isbn" }));
      }
      break;
    }

    default:
      break;
  }

  return out;
}

/** Human-readable provenance for a finding, for the certificate. */
export function findingProvenance(f: ReadinessFinding): string | null {
  const rule = getRule(f.ruleId);
  if (!rule) return null;
  return `${rule.source.level} · verified ${rule.source.verifiedOn} · ${rule.source.url}`;
}
