/* PTL-022 Phase 9E — Publication asset taxonomy + readiness scoring.
   Pure module. Kinds, profile requirements, and a readiness summary
   the dashboard / authoring UI can render. */

export const ASSET_KINDS = [
  "front-cover",
  "back-cover",
  "epub-cover",
  "paperback-cover",
  "hardcover-cover",
  "author-image",
  "series-banner",
  "marketing-graphic",
  "interior-illustration",
  "supporting-media",
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_LABELS: Record<AssetKind, string> = {
  "front-cover": "Front Cover",
  "back-cover": "Back Cover",
  "epub-cover": "EPUB Cover",
  "paperback-cover": "Paperback Cover",
  "hardcover-cover": "Hardcover Cover",
  "author-image": "Author Image",
  "series-banner": "Series Banner",
  "marketing-graphic": "Marketing Graphic",
  "interior-illustration": "Interior Illustration",
  "supporting-media": "Supporting Media",
};

/** Required asset kinds per publication profile. Drives readiness scoring.
   KDP minimum: only a front cover is strictly required. Everything else
   (author image, interior illustrations, back cover, epub-specific cover,
   marketing graphics) is recommended — missing recommended assets surface
   as warnings in the filter report, not blockers. */
export const PROFILE_ASSET_REQUIREMENTS: Record<string, AssetKind[]> = {
  novel:       ["front-cover"],
  research:    ["front-cover"],
  documentary: ["front-cover"],
  educational: ["front-cover"],
  childrens:   ["front-cover"],
};

/** Recommended (non-blocking) asset kinds per profile. */
export const PROFILE_ASSET_RECOMMENDED: Record<string, AssetKind[]> = {
  novel:       ["epub-cover", "author-image", "back-cover", "paperback-cover", "marketing-graphic"],
  research:    ["epub-cover", "author-image", "marketing-graphic", "supporting-media"],
  documentary: ["author-image", "marketing-graphic", "supporting-media"],
  educational: ["epub-cover", "author-image", "interior-illustration", "marketing-graphic", "supporting-media"],
  childrens:   ["epub-cover", "interior-illustration", "author-image", "marketing-graphic"],
};

export interface AssetRecord {
  id: string;
  slug: string;
  kind: string;
  url: string;
  label: string | null;
  version: number;
  is_active: boolean;
  replaces_id: string | null;
  uploaded_at: string;
  created_at: string;
  notes: string | null;
}

export interface AssetReadiness {
  profile: string;
  required: AssetKind[];
  recommended: AssetKind[];
  presentRequired: AssetKind[];
  missingRequired: AssetKind[];
  presentRecommended: AssetKind[];
  missingRecommended: AssetKind[];
  /** 0..1 — required-only completeness */
  score: number;
  /** 0..1 — required + recommended */
  scoreWithRecommended: number;
  ready: boolean;
}

/** Compute readiness from active assets only. */
export function scoreAssets(profileId: string, assets: AssetRecord[]): AssetReadiness {
  const required = PROFILE_ASSET_REQUIREMENTS[profileId] ?? [];
  const recommended = PROFILE_ASSET_RECOMMENDED[profileId] ?? [];
  const activeKinds = new Set(
    assets.filter((a) => a.is_active).map((a) => a.kind as AssetKind),
  );
  const presentRequired = required.filter((k) => activeKinds.has(k));
  const missingRequired = required.filter((k) => !activeKinds.has(k));
  const presentRecommended = recommended.filter((k) => activeKinds.has(k));
  const missingRecommended = recommended.filter((k) => !activeKinds.has(k));
  const score = required.length === 0 ? 1 : presentRequired.length / required.length;
  const totalAll = required.length + recommended.length;
  const presentAll = presentRequired.length + presentRecommended.length;
  const scoreWithRecommended = totalAll === 0 ? 1 : presentAll / totalAll;
  return {
    profile: profileId,
    required,
    recommended,
    presentRequired,
    missingRequired,
    presentRecommended,
    missingRecommended,
    score,
    scoreWithRecommended,
    ready: missingRequired.length === 0,
  };
}
