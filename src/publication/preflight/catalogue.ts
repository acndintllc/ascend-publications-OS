/* PTL-030 Phase 19A — Acceptance rule catalogue. Pure data.

   VERIFICATION METHOD (read this before trusting a verdict):
   Every `source.url` below is the destination's own documentation, and
   each threshold was confirmed against that page's content on
   `verifiedOn`. The confirmation was made through web search summaries of
   those pages — this environment's network policy blocks direct fetches
   of kdp.amazon.com, help.apple.com and support.google.com — so a rule
   marked "official" means the official page states it, not that a human
   re-read the page. Rules marked "community" are widely reported by
   practitioners but are NOT stated in the destination's own docs; they
   never gate a verdict on their own. Re-verify before each release:
   these are other companies' policies and they drift. */
import type { AcceptanceRule } from "./types";

const KDP_COVER = "https://kdp.amazon.com/en_US/help/topic/G6GTK3T3NUHKLEFX";
const KDP_COVER_CRITERIA = "https://kdp.amazon.com/en_US/help/topic/G200645690";
const KDP_DESCRIPTION = "https://kdp.amazon.com/en_US/help/topic/G201189630";
const KDP_KEYWORDS = "https://kdp.amazon.com/en_US/help/topic/G201298500";
const KDP_METADATA = "https://kdp.amazon.com/en_US/help/topic/G201097560";
const APPLE_COVER = "https://help.apple.com/itc/booksassetguide/en.lproj/itc1bda991ba.html";
const APPLE_INTERIOR = "https://help.apple.com/itc/booksassetguide/en.lproj/itca71ad3c33.html";
const KOBO_ISBN = "https://kobowritinglife.zendesk.com/hc/en-us/articles/360059386031-ISBNs-and-Kobo-Writing-Life";
const KOBO_COVER = "https://kobowritinglife.zendesk.com/hc/en-us/articles/360059385711-Cover-Image-Tips";
const GOOGLE_ISBN = "https://support.google.com/books/partner/answer/3431108";
const GOOGLE_FILES = "https://support.google.com/books/partner/answer/3424254";

const V = "2026-09-13";

export const ACCEPTANCE_RULES: AcceptanceRule[] = [
  /* ── Amazon KDP · cover ─────────────────────────────────────────── */
  {
    ruleId: "kdp.cover.colorspace",
    label: "Cover must be RGB",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "Cover images must use the RGB color profile. Kindle does not support CMYK.",
    remediation: "Re-export the cover with an RGB (sRGB) color profile.",
    source: { url: KDP_COVER, verifiedOn: V, level: "official" },
  },
  {
    ruleId: "kdp.cover.min-short-edge",
    label: "Cover shortest side too small",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "Covers with fewer than 500 pixels on the shortest side are not displayed on the website.",
    remediation: "Re-export the cover at 1600 × 2560 pixels.",
    source: { url: KDP_COVER, verifiedOn: V, level: "official" },
    params: { minShortEdgePx: 500 },
  },
  {
    ruleId: "kdp.cover.ideal-dimensions",
    label: "Cover below recommended resolution",
    destinations: ["kdp"],
    severity: "warning",
    requirement: "Recommended cover is 1600 wide × 2560 high; at least 2500 px high for high-definition devices.",
    remediation: "Re-export at 1600 × 2560. Do not upscale a smaller image — it lowers quality.",
    source: { url: KDP_COVER, verifiedOn: V, level: "official" },
    params: { idealWidthPx: 1600, idealHeightPx: 2560, minHeightPxHd: 2500 },
  },
  {
    ruleId: "kdp.cover.format",
    label: "Cover file format",
    destinations: ["kdp"],
    severity: "warning",
    requirement: "JPEG is the preferred cover format.",
    remediation: "Save the cover as JPEG (.jpg/.jpeg).",
    source: { url: KDP_COVER_CRITERIA, verifiedOn: V, level: "official" },
    params: { preferred: ["image/jpeg"] },
  },
  {
    ruleId: "kdp.cover.dpi",
    label: "Cover resolution below 300 DPI",
    destinations: ["kdp"],
    severity: "advisory",
    requirement: "300 DPI/PPI minimum is recommended.",
    remediation: "Re-export the cover at 300 DPI.",
    source: { url: KDP_COVER, verifiedOn: V, level: "official" },
    params: { minDpi: 300 },
  },

  /* ── Amazon KDP · description ───────────────────────────────────── */
  {
    ruleId: "kdp.description.length",
    label: "Description over 4000 characters",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "Descriptions are limited to 4000 characters. HTML tags count toward the limit — bolding \"test\" costs 11 characters, not 4.",
    remediation: "Shorten the description, counting markup.",
    source: { url: KDP_DESCRIPTION, verifiedOn: V, level: "official" },
    params: { maxChars: 4000, tagsCountTowardLimit: true },
  },
  {
    ruleId: "kdp.description.html-whitelist",
    label: "Unsupported HTML in description",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "Only KDP's supported description tags may be used. Unsupported markup renders literally or is rejected.",
    remediation: "Remove unsupported tags; keep to the supported set.",
    source: {
      url: KDP_DESCRIPTION, verifiedOn: V, level: "official",
      caveat: "KDP documents these tags by example rather than publishing a closed list; treat the set as the confirmed minimum, not an exhaustive whitelist.",
    },
    params: { allowed: ["b", "i", "u", "br", "p", "ul", "ol", "li", "h4", "h5", "h6"] },
  },

  /* ── Amazon KDP · keywords & categories ─────────────────────────── */
  {
    ruleId: "kdp.keywords.count",
    label: "More than 7 keywords",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "Up to seven keywords or short phrases. Two-to-three word phrases perform best.",
    remediation: "Reduce to seven keyword slots.",
    source: { url: KDP_KEYWORDS, verifiedOn: V, level: "official" },
    params: { maxKeywords: 7 },
  },
  {
    ruleId: "kdp.keywords.slot-length",
    label: "Keyword slot over 50 characters",
    destinations: ["kdp"],
    severity: "warning",
    requirement: "Each keyword field accepts up to 50 characters.",
    remediation: "Shorten the keyword to 50 characters or fewer.",
    source: {
      url: KDP_KEYWORDS, verifiedOn: V, level: "community",
      caveat: "KDP's own page says only \"keep an eye on the character limit\" without stating the number. 50 is the consistent practitioner figure. Severity is warning, not blocker, until confirmed officially.",
    },
    params: { maxCharsPerKeyword: 50 },
  },
  {
    ruleId: "kdp.keywords.prohibited-content",
    label: "Prohibited keyword content",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "Keywords must not contain: subjective quality claims (\"best novel ever\"), time-sensitive statements (\"new\", \"on sale\", \"available now\"), the name of an author not associated with the book, or terms already covered by the book's categories. Keywords that mislead or manipulate customers are not tolerated.",
    remediation: "Remove the flagged term. Misleading keywords can get a live listing suppressed, not just rejected at upload.",
    source: { url: KDP_KEYWORDS, verifiedOn: V, level: "official" },
    params: {
      subjectiveClaims: ["best", "bestseller", "best-seller", "greatest", "#1", "number one", "award winning"],
      timeSensitive: ["new", "on sale", "available now", "free", "latest", "just released"],
    },
  },
  {
    ruleId: "kdp.categories.count",
    label: "More than 3 categories",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "Choose up to three categories during title setup.",
    remediation: "Reduce to three categories.",
    source: { url: KDP_METADATA, verifiedOn: V, level: "official" },
    params: { maxCategories: 3 },
  },

  /* ── Amazon KDP · title ─────────────────────────────────────────── */
  {
    ruleId: "kdp.title.combined-length",
    label: "Title and subtitle over 200 characters",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "Title and subtitle together must be fewer than 200 characters.",
    remediation: "Shorten the title or subtitle.",
    source: { url: KDP_METADATA, verifiedOn: V, level: "official" },
    params: { maxCombinedChars: 200 },
  },
  {
    ruleId: "kdp.title.matches-cover",
    label: "Cover text must match metadata",
    destinations: ["kdp"],
    severity: "blocker",
    requirement: "The title, subtitle, author name and series information on the cover must match the corresponding metadata fields.",
    remediation: "Confirm the cover artwork matches the metadata exactly, or correct whichever is wrong.",
    source: { url: KDP_METADATA, verifiedOn: V, level: "official" },
    requiresHumanConfirmation: true,
  },

  /* ── Apple Books ────────────────────────────────────────────────── */
  {
    ruleId: "apple.cover.colorspace",
    label: "Cover must be RGB",
    destinations: ["apple-books"],
    severity: "blocker",
    requirement: "Cover art must use RGB color mode.",
    remediation: "Re-export the cover with an RGB color profile.",
    source: { url: APPLE_COVER, verifiedOn: V, level: "official" },
  },
  {
    ruleId: "apple.cover.min-short-edge",
    label: "Cover shorter axis under 1400px",
    destinations: ["apple-books"],
    severity: "blocker",
    requirement: "Cover art must be at least 1400 pixels along the shorter axis.",
    remediation: "Re-export the cover at 1600 × 2560 or larger. Do not upscale a smaller image — blurry or pixelated covers are rejected.",
    source: { url: APPLE_COVER, verifiedOn: V, level: "official" },
    params: { minShortEdgePx: 1400 },
  },
  {
    ruleId: "apple.cover.format",
    label: "Cover file format",
    destinations: ["apple-books"],
    severity: "blocker",
    requirement: "Cover art must be a high-quality JPEG (.jpg/.jpeg) or PNG (.png).",
    remediation: "Save the cover as JPEG or PNG.",
    source: { url: APPLE_COVER, verifiedOn: V, level: "official" },
    params: { allowed: ["image/jpeg", "image/png"] },
  },
  {
    ruleId: "apple.cover.dpi",
    label: "Cover resolution below 300 DPI",
    destinations: ["apple-books"],
    severity: "advisory",
    requirement: "A minimum of 300 dpi is the recommended rule of thumb.",
    remediation: "Re-export the cover at 300 DPI.",
    source: { url: APPLE_COVER, verifiedOn: V, level: "official" },
    params: { minDpi: 300 },
  },
  {
    ruleId: "apple.interior-image.max-pixels",
    label: "Interior image over 5.6 megapixels",
    destinations: ["apple-books"],
    severity: "blocker",
    requirement: "Images inside the EPUB cannot exceed 5.6 million pixels.",
    remediation: "Downsample the image. Apple recommends 1.5× the intended viewing size, up to 5.6 megapixels.",
    source: { url: APPLE_INTERIOR, verifiedOn: V, level: "official" },
    params: { maxPixels: 5_600_000 },
  },

  /* ── Kobo ───────────────────────────────────────────────────────── */
  {
    ruleId: "kobo.format.epub-only",
    label: "Kobo accepts EPUB only",
    destinations: ["kobo"],
    severity: "blocker",
    requirement: "Kobo accepts EPUB files only — not PDF, MOBI or DOCX. Reflowable EPUB is recommended for prose.",
    remediation: "Supply a reflowable EPUB.",
    source: { url: KOBO_COVER, verifiedOn: V, level: "official" },
    params: { allowed: ["application/epub+zip"] },
  },
  {
    ruleId: "kobo.cover.min-short-edge",
    label: "Cover below Kobo minimum",
    destinations: ["kobo"],
    severity: "warning",
    requirement: "Cover should be JPG or PNG, at least 1400 pixels wide; 2560 px is ideal.",
    remediation: "Re-export the cover at 1600 × 2560 to satisfy every destination at once.",
    source: {
      url: KOBO_COVER, verifiedOn: V, level: "community",
      caveat: "Sources conflict: 1400 px minimum width in one place, 2400 px short side in another. Encoded at the lower bound and downgraded to warning until resolved against Kobo's own page.",
    },
    params: { minShortEdgePx: 1400, idealShortEdgePx: 2560 },
  },
  {
    ruleId: "kobo.categories.count",
    label: "More than 3 BISAC categories",
    destinations: ["kobo"],
    severity: "warning",
    requirement: "Up to three BISAC categories.",
    remediation: "Reduce to three categories.",
    source: { url: KOBO_COVER, verifiedOn: V, level: "community" },
    params: { maxCategories: 3 },
  },

  /* ── Google Play Books ──────────────────────────────────────────── */
  {
    ruleId: "google.file.max-size",
    label: "File over 2 GB",
    destinations: ["google-play-books"],
    severity: "blocker",
    requirement: "Each uploaded file must be less than 2 GB.",
    remediation: "Reduce the file size, typically by downsampling interior images.",
    source: { url: GOOGLE_FILES, verifiedOn: V, level: "official" },
    params: { maxBytes: 2_000_000_000 },
  },

  /* ── ISBN · applies across destinations ─────────────────────────── */
  {
    ruleId: "isbn.not-required-for-retail",
    label: "ISBN is optional at every supported destination",
    destinations: ["kdp", "apple-books", "kobo", "google-play-books"],
    severity: "advisory",
    requirement: "None of the supported storefronts require an ISBN to publish. Each assigns its own identifier when none is supplied — Amazon an ASIN, Kobo its own number, Google a GGKEY prefix. Apple accepts an ISBN-13 but does not require one for direct publishing.",
    remediation: "Supply an ISBN only if you want a portable identifier you control, or a downstream partner requires one.",
    source: {
      url: GOOGLE_ISBN, verifiedOn: V, level: "official",
      caveat: "Google and Kobo state this in their own documentation. The Apple position is reported consistently by practitioners and in Apple Support Communities rather than stated in the Books Asset Guide.",
    },
  },
  {
    ruleId: "isbn.checksum-valid",
    label: "Invalid ISBN-13 checksum",
    destinations: ["kdp", "apple-books", "kobo", "google-play-books", "draft2digital"],
    severity: "blocker",
    requirement: "A supplied ISBN-13 must have a valid check digit.",
    remediation: "Correct the ISBN, or clear the field — it is optional everywhere.",
    source: { url: GOOGLE_ISBN, verifiedOn: V, level: "official" },
  },
];

export function rulesForDestination(destination: string): AcceptanceRule[] {
  return ACCEPTANCE_RULES.filter((r) => (r.destinations as string[]).includes(destination));
}

export function getRule(ruleId: string): AcceptanceRule | undefined {
  return ACCEPTANCE_RULES.find((r) => r.ruleId === ruleId);
}
