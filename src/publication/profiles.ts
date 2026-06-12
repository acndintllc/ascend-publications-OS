/* PTL-020 Phase 8C — Publication Profiles
   Reusable behavior bundles. Each profile defines how typography,
   chapters, citations, callouts, VERA, and exports behave for an
   entire publication line (e.g. "Ghost Series", "AI Reports"). */
import type { PublicationStatus } from "./status";

export type ProfileFamily =
  | "novel"
  | "research"
  | "documentary"
  | "educational"
  | "childrens";

export interface ProfileBehavior {
  typography: {
    displayFamily: "fraunces" | "source-serif-4" | "inter-tight";
    bodyFamily: "source-serif-4" | "inter-tight";
    uiFamily: "inter-tight";
    /** Cinematic = display ramp shifted up one step. */
    chapterOpenerScale: "intimate" | "standard" | "cinematic";
    enableDropCap: boolean;
  };
  chapter: {
    numberingStyle: "arabic" | "roman" | "named" | "none";
    sceneBreakGlyph: "asterism" | "rule" | "void" | "none";
    chapterRhythmEm: number;
  };
  citation: {
    style: "scholarly" | "endnote" | "footnote" | "inline" | "none";
    requireBibliography: boolean;
  };
  callout: {
    variantsAllowed: string[];      // e.g. ["note","warning","aside"]
    requireLabel: boolean;
  };
  vera: {
    blocksAllowed: VeraBlockKind[]; // see vera-blocks.ts
    defaultVoice: "VERA" | "VERA-EDU" | "VERA-RESEARCH" | "VERA-KIDS";
    requireSourceWhenFactual: boolean;
  };
  export: {
    targets: Array<"epub" | "kindle" | "pdf" | "html-reader">;
    pdfMode: "print" | "digital";
    epubProfile: "epub3" | "kindle";
  };
  /** Statuses this profile is allowed to occupy (some profiles never publish
   *  through retail channels — e.g. internal documentary scripts). */
  allowedStatuses: PublicationStatus[];
}

export type VeraBlockKind =
  | "vera-note"
  | "vera-explain"
  | "vera-insight"
  | "vera-question"
  | "vera-research-prompt"
  | "vera-learning-prompt"
  | "vera-language-bridge";

export interface PublicationProfile {
  id: string;
  family: ProfileFamily;
  label: string;
  lines: string[];           // e.g. ["Ghost Series","DON Protocol"]
  behavior: ProfileBehavior;
}

const ALL_STATUSES: PublicationStatus[] = [
  "draft","editing","review","formatting","ready","published","archived",
];

export const PROFILES: PublicationProfile[] = [
  {
    id: "novel",
    family: "novel",
    label: "Novel",
    lines: ["Ghost Series", "DON Protocol", "Realignment Cycle"],
    behavior: {
      typography: {
        displayFamily: "fraunces",
        bodyFamily: "source-serif-4",
        uiFamily: "inter-tight",
        chapterOpenerScale: "cinematic",
        enableDropCap: true,
      },
      chapter: { numberingStyle: "named", sceneBreakGlyph: "asterism", chapterRhythmEm: 6 },
      citation: { style: "none", requireBibliography: false },
      callout: { variantsAllowed: [], requireLabel: false },
      vera: { blocksAllowed: ["vera-note", "vera-insight"], defaultVoice: "VERA", requireSourceWhenFactual: false },
      export: { targets: ["epub", "kindle", "pdf", "html-reader"], pdfMode: "print", epubProfile: "epub3" },
      allowedStatuses: ALL_STATUSES,
    },
  },
  {
    id: "research",
    family: "research",
    label: "Research",
    lines: ["Research Over Emotion", "Signal Economy", "AI Reports"],
    behavior: {
      typography: {
        displayFamily: "fraunces",
        bodyFamily: "source-serif-4",
        uiFamily: "inter-tight",
        chapterOpenerScale: "standard",
        enableDropCap: false,
      },
      chapter: { numberingStyle: "arabic", sceneBreakGlyph: "rule", chapterRhythmEm: 5 },
      citation: { style: "scholarly", requireBibliography: true },
      callout: { variantsAllowed: ["note", "warning", "method", "finding"], requireLabel: true },
      vera: {
        blocksAllowed: ["vera-note", "vera-insight", "vera-research-prompt", "vera-question"],
        defaultVoice: "VERA-RESEARCH",
        requireSourceWhenFactual: true,
      },
      export: { targets: ["epub", "pdf", "html-reader"], pdfMode: "digital", epubProfile: "epub3" },
      allowedStatuses: ALL_STATUSES,
    },
  },
  {
    id: "documentary",
    family: "documentary",
    label: "Documentary",
    lines: ["History vs The Story", "Documentary Scripts"],
    behavior: {
      typography: {
        displayFamily: "fraunces",
        bodyFamily: "source-serif-4",
        uiFamily: "inter-tight",
        chapterOpenerScale: "cinematic",
        enableDropCap: false,
      },
      chapter: { numberingStyle: "named", sceneBreakGlyph: "void", chapterRhythmEm: 7 },
      citation: { style: "endnote", requireBibliography: true },
      callout: { variantsAllowed: ["scene", "voiceover", "archive"], requireLabel: true },
      vera: {
        blocksAllowed: ["vera-note", "vera-explain", "vera-insight"],
        defaultVoice: "VERA",
        requireSourceWhenFactual: true,
      },
      export: { targets: ["pdf", "html-reader"], pdfMode: "digital", epubProfile: "epub3" },
      allowedStatuses: ["draft", "editing", "review", "formatting", "ready", "archived"],
    },
  },
  {
    id: "educational",
    family: "educational",
    label: "Educational",
    lines: ["AI Rulebook", "Educational Guides"],
    behavior: {
      typography: {
        displayFamily: "fraunces",
        bodyFamily: "source-serif-4",
        uiFamily: "inter-tight",
        chapterOpenerScale: "standard",
        enableDropCap: false,
      },
      chapter: { numberingStyle: "arabic", sceneBreakGlyph: "rule", chapterRhythmEm: 4 },
      citation: { style: "footnote", requireBibliography: true },
      callout: { variantsAllowed: ["note", "tip", "warning", "exercise", "summary"], requireLabel: true },
      vera: {
        blocksAllowed: [
          "vera-explain", "vera-learning-prompt", "vera-question", "vera-insight", "vera-note",
        ],
        defaultVoice: "VERA-EDU",
        requireSourceWhenFactual: true,
      },
      export: { targets: ["epub", "kindle", "pdf", "html-reader"], pdfMode: "digital", epubProfile: "epub3" },
      allowedStatuses: ALL_STATUSES,
    },
  },
  {
    id: "childrens",
    family: "childrens",
    label: "Children's",
    lines: ["VERA Encyclopedia", "Interactive Storytelling", "Bilingual Bridge"],
    behavior: {
      typography: {
        displayFamily: "fraunces",
        bodyFamily: "source-serif-4",
        uiFamily: "inter-tight",
        chapterOpenerScale: "intimate",
        enableDropCap: true,
      },
      chapter: { numberingStyle: "named", sceneBreakGlyph: "asterism", chapterRhythmEm: 4 },
      citation: { style: "none", requireBibliography: false },
      callout: { variantsAllowed: ["did-you-know", "try-it"], requireLabel: true },
      vera: {
        blocksAllowed: [
          "vera-explain", "vera-question", "vera-learning-prompt", "vera-language-bridge", "vera-insight",
        ],
        defaultVoice: "VERA-KIDS",
        requireSourceWhenFactual: false,
      },
      export: { targets: ["epub", "kindle", "html-reader"], pdfMode: "digital", epubProfile: "epub3" },
      allowedStatuses: ALL_STATUSES,
    },
  },
];

export function getProfile(id: string): PublicationProfile | undefined {
  return PROFILES.find((p) => p.id === id);
}

export function profilesByFamily(family: ProfileFamily): PublicationProfile[] {
  return PROFILES.filter((p) => p.family === family);
}
