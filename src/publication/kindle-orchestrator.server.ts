/* PTL-029 Phase 18B — Kindle provider orchestrator with automatic failover.
   Uses the existing runner-provider registry to choose the preferred
   external KindleGen provider, falling back to the in-Worker KFX stub.
   Preserves existing runner contracts; introduces no new lifecycle states. */
import { resolveProvider, type StandardRunnerResult } from "./runner-provider";
import { recordEvent } from "./persistence.server";

export interface KindleFailoverInput {
  slug: string;
  origin: string;
  sourceQueueId?: string | null;
  actor?: string;
  /** Skip primary and go straight to fallback (for fallback proof). */
  forceFallback?: boolean;
}

export interface KindleFailoverResult {
  preferred: { id: string; available: boolean } | null;
  attempted: StandardRunnerResult[];
  final: StandardRunnerResult;
  failoverUsed: boolean;
}

export async function runKindleWithFailover(input: KindleFailoverInput): Promise<KindleFailoverResult> {
  const primary = resolveProvider("kindle", input.forceFallback ? undefined : "external-kindlegen");
  const fallback = resolveProvider("kindle", "reference-kfx-runner-in-worker");
  const attempted: StandardRunnerResult[] = [];
  let final: StandardRunnerResult | null = null;
  let failoverUsed = false;

  const tryPrimary = !input.forceFallback && primary && !primary.fallback && primary.available();
  const preferred = primary ? { id: primary.id, available: primary.available() } : null;

  if (tryPrimary) {
    const { runExternalKindlegen } = await import("./runner-external-kindlegen.server");
    const r = await runExternalKindlegen({
      slug: input.slug, origin: input.origin,
      sourceQueueId: input.sourceQueueId ?? null, actor: input.actor ?? "failover-primary",
    });
    attempted.push(r);
    if (r.ok) final = r;
    else failoverUsed = true;
  } else {
    failoverUsed = true;
  }

  if (!final) {
    // Fallback: reference KFX stub
    const { runReferenceKfx } = await import("./reference-runner-kfx.server");
    const r = await runReferenceKfx({
      slug: input.slug, origin: input.origin,
      sourceQueueId: input.sourceQueueId ?? null,
      mode: "ok", actor: input.actor ?? "failover-fallback",
    });
    const std: StandardRunnerResult = {
      ok: r.ok,
      provider: fallback?.id ?? "reference-kfx-runner-in-worker",
      kind: "kindle",
      warnings: [],
      errors: r.ok ? [] : [`fallback callback status ${r.callback_status}`],
      callback_status: r.callback_status,
      artifact_path: r.artifact_path,
      signed_url: r.signed_url ?? null,
      failure: r.ok ? undefined : "callback_failure",
      validation: { mode: r.mode },
    };
    attempted.push(std);
    final = std;
  }

  await recordEvent({
    slug: input.slug,
    event_type: "export.requested",
    payload: {
      action: "kindle.failover",
      preferred_provider: preferred?.id ?? null,
      attempts: attempted.length,
      failover_used: failoverUsed,
      final_provider: final.provider,
      final_ok: final.ok,
      final_failure: final.failure ?? null,
    },
    actor: input.actor ?? null,
  });

  return { preferred, attempted, final, failoverUsed };
}

/** Lightweight health-check: does each provider claim to be available? */
export function kindleProviderHealth() {
  const ext = resolveProvider("kindle", "external-kindlegen");
  const stub = resolveProvider("kindle", "reference-kfx-runner-in-worker");
  return {
    primary: ext ? { id: ext.id, available: ext.available(), fallback: ext.fallback } : null,
    fallback: stub ? { id: stub.id, available: stub.available(), fallback: stub.fallback } : null,
    secret_runner: !!process.env.ASCEND_RUNNER_SECRET,
    secret_kindlegen_url: !!process.env.ASCEND_KINDLEGEN_URL,
  };
}
