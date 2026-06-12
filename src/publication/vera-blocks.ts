/* PTL-020 Phase 8D — VERA Publishing Blocks
   Block registry + factory functions. Renderer integration is deferred;
   ACA already supports a `vera` annotation on body blocks (see
   src/manuscript/schema/aca.ts). These descriptors let publishers
   declare semantically-rich VERA insertions per profile. */
import type { VeraBlockKind } from "./profiles";

export interface VeraBlockSpec {
  kind: VeraBlockKind;
  label: string;
  /** Where this block tends to appear in publication surfaces. */
  surfaces: Array<"educational" | "childrens" | "research" | "documentary" | "novel">;
  /** Author-facing prompt to populate the block. */
  prompt: string;
  /** Whether the block must reference a verifiable source. */
  requiresSource: boolean;
  /** Whether the block expects a learner response (interactive). */
  interactive: boolean;
}

export const VERA_BLOCKS: Record<VeraBlockKind, VeraBlockSpec> = {
  "vera-note": {
    kind: "vera-note",
    label: "VERA Note",
    surfaces: ["novel", "research", "documentary", "educational"],
    prompt: "Margin-style annotation in VERA's voice.",
    requiresSource: false,
    interactive: false,
  },
  "vera-explain": {
    kind: "vera-explain",
    label: "VERA Explain",
    surfaces: ["educational", "childrens", "documentary"],
    prompt: "Plain-language breakdown of the concept just introduced.",
    requiresSource: false,
    interactive: false,
  },
  "vera-insight": {
    kind: "vera-insight",
    label: "VERA Insight",
    surfaces: ["research", "documentary", "novel", "educational"],
    prompt: "Synthetic observation linking this passage to a broader pattern.",
    requiresSource: true,
    interactive: false,
  },
  "vera-question": {
    kind: "vera-question",
    label: "VERA Question",
    surfaces: ["educational", "childrens", "research"],
    prompt: "Single open question for the reader.",
    requiresSource: false,
    interactive: true,
  },
  "vera-research-prompt": {
    kind: "vera-research-prompt",
    label: "VERA Research Prompt",
    surfaces: ["research", "educational"],
    prompt: "Investigative task the reader can carry out independently.",
    requiresSource: true,
    interactive: true,
  },
  "vera-learning-prompt": {
    kind: "vera-learning-prompt",
    label: "VERA Learning Prompt",
    surfaces: ["educational", "childrens"],
    prompt: "Practice or reflection exercise tied to a learning objective.",
    requiresSource: false,
    interactive: true,
  },
  "vera-language-bridge": {
    kind: "vera-language-bridge",
    label: "VERA Language Bridge",
    surfaces: ["childrens"],
    prompt: "Bilingual gloss linking source and target languages.",
    requiresSource: false,
    interactive: false,
  },
};

export interface VeraBlockInstance {
  kind: VeraBlockKind;
  voice: string;
  body: string;
  source?: string;
  targetLanguage?: string;  // vera-language-bridge
  sourceLanguage?: string;  // vera-language-bridge
  objectiveId?: string;     // vera-learning-prompt
}

export function listBlocksForFamily(
  family: "educational" | "childrens" | "research" | "documentary" | "novel",
): VeraBlockSpec[] {
  return Object.values(VERA_BLOCKS).filter((b) => b.surfaces.includes(family));
}
