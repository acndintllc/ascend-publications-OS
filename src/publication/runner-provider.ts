/* PTL-028 Phase 17A — Runner provider abstraction.
   Pure module. Standardizes the result contract shared by all artifact
   runners (PDF, Kindle/KFX, future formats) and registers the providers
   the orchestrator can choose between. Existing runners
   (`reference-runner.server.ts`, `reference-runner-kfx.server.ts`,
   `runner-external-kindlegen.server.ts`) all conform to this contract. */

export type RunnerKind = "pdf" | "kindle";

export type RunnerFailureState =
  | "generation_failed"
  | "provider_unavailable"
  | "invalid_artifact"
  | "callback_failure"
  | "timeout";

export interface StandardRunnerResult {
  ok: boolean;
  provider: string;
  kind: RunnerKind;
  warnings: string[];
  errors: string[];
  /** Final HTTP status from the signed callback, if reached. */
  callback_status: number | null;
  /** Artifact storage path (in publication-assets bucket) once registered. */
  artifact_path?: string;
  signed_url?: string | null;
  failure?: RunnerFailureState;
  /** Free-form validation/log info echoed back to the registry. */
  validation?: Record<string, unknown>;
}

export interface RunnerProvider {
  id: string;
  kind: RunnerKind;
  label: string;
  /** Returns true if env / credentials are present to attempt this provider. */
  available(): boolean;
  /** Whether this is a fallback (stub) provider — never preferred. */
  fallback: boolean;
}

/* ─── Registry ──────────────────────────────────────────────────────── */

const REGISTRY: RunnerProvider[] = [];

export function registerProvider(p: RunnerProvider): void {
  if (!REGISTRY.find((x) => x.id === p.id)) REGISTRY.push(p);
}

export function listProviders(kind?: RunnerKind): RunnerProvider[] {
  return kind ? REGISTRY.filter((p) => p.kind === kind) : [...REGISTRY];
}

export function resolveProvider(kind: RunnerKind, preferredId?: string): RunnerProvider | null {
  if (preferredId) {
    const p = REGISTRY.find((x) => x.id === preferredId && x.kind === kind);
    if (p) return p;
  }
  const primary = REGISTRY.find((p) => p.kind === kind && !p.fallback && p.available());
  if (primary) return primary;
  return REGISTRY.find((p) => p.kind === kind && p.fallback) ?? null;
}

/* ─── Built-in registrations (declarative — runners live in .server.ts) */
/* Available-checks use only process.env so they are safe in both
   server and client bundles (no .server import). */
const env = (k: string): string | undefined =>
  typeof process !== "undefined" ? (process.env?.[k] as string | undefined) : undefined;

registerProvider({
  id: "reference-runner-in-worker",
  kind: "pdf",
  label: "Reference PDF runner (in-Worker, base-14)",
  available: () => !!env("ASCEND_RUNNER_SECRET"),
  fallback: true,
});

registerProvider({
  id: "external-kindlegen",
  kind: "kindle",
  label: "External KindleGen/KPR runner",
  available: () => !!env("ASCEND_RUNNER_SECRET") && !!env("ASCEND_KINDLEGEN_URL"),
  fallback: false,
});

registerProvider({
  id: "reference-kfx-runner-in-worker",
  kind: "kindle",
  label: "Reference KFX stub (wraps Kindle EPUB)",
  available: () => !!env("ASCEND_RUNNER_SECRET"),
  fallback: true,
});
