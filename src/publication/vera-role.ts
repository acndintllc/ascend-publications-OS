/* VERA Role Engine — project-level interpretation policy.
   Every publication has exactly one VERA role. The role determines how
   the Publishing OS renders and exports any reference to VERA.

   Roles:
   - none           VERA is not used. Ignore all VERA-specific processing.
   - interpretation VERA is the interpretation layer. Render approved
                    VERA components when invoked. (default — research,
                    educational, business, reports, manuals, white papers.)
   - narrator       VERA is the storyteller. Preserve text as authored.
   - character      VERA is an in-world character. Preserve text as authored.

   Registry is open: add new roles here without breaking existing rows.
   `vera_role` is stored as a free-form text column; unknown values fall
   back to "interpretation" for safety. */

export type VeraRole = "none" | "interpretation" | "narrator" | "character";

export interface VeraRoleSpec {
  id: VeraRole;
  label: string;
  description: string;
  /** Whether the renderer should emit VERA component styling for
   *  body-attached VERA annotations. When false, the annotation is
   *  suppressed and the manuscript is preserved as authored. */
  rendersInterpretationBlocks: boolean;
  /** Default profile families this role is appropriate for. */
  defaultFor: string[];
}

export const VERA_ROLES: Record<VeraRole, VeraRoleSpec> = {
  none: {
    id: "none",
    label: "None",
    description:
      "VERA is not used. References to VERA are treated as ordinary text.",
    rendersInterpretationBlocks: false,
    defaultFor: [],
  },
  interpretation: {
    id: "interpretation",
    label: "Interpretation",
    description:
      "VERA is the interpretation layer. Approved VERA components render when intentionally invoked.",
    rendersInterpretationBlocks: true,
    defaultFor: ["research", "educational"],
  },
  narrator: {
    id: "narrator",
    label: "Narrator",
    description:
      "VERA is the narrative voice. Preserve manuscript exactly as authored — no interpretation styling.",
    rendersInterpretationBlocks: false,
    defaultFor: ["documentary"],
  },
  character: {
    id: "character",
    label: "Character",
    description:
      "VERA is an in-world character. Treat exactly like any other character — no interpretation styling.",
    rendersInterpretationBlocks: false,
    defaultFor: ["novel", "childrens"],
  },
};

export const VERA_ROLE_IDS: VeraRole[] = ["none", "interpretation", "narrator", "character"];

export function isVeraRole(v: unknown): v is VeraRole {
  return typeof v === "string" && v in VERA_ROLES;
}

export function normalizeVeraRole(v: unknown): VeraRole {
  return isVeraRole(v) ? v : "interpretation";
}

/** Default role for a profile family. */
export function defaultRoleForFamily(family: string): VeraRole {
  if (family === "novel" || family === "childrens") return "character";
  if (family === "documentary") return "narrator";
  return "interpretation";
}
