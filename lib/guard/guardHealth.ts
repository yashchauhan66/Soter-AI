/**
 * Guard tier health — makes a silent ML fail-open LOUD.
 *
 * THE BUG THIS FIXES
 *   lib/guard/mlAugment.ts is deliberately fail-open: if the model is missing, the
 *   weights are an unpulled LFS stub, the signed manifest is absent, or the
 *   supply-chain gate rejects the artifact, the guard keeps serving with rules
 *   only and returns ALLOW as if nothing happened. That is the right runtime
 *   behaviour — a broken classifier must not take the product down — but until now
 *   it was also SILENT. An operator who set SOTERAI_ML_AUGMENT=enforce had no way
 *   to tell the difference between "ML tier is enforcing" and "ML tier never
 *   loaded once", so a deploy could quietly ship a rules-only guard that reports
 *   itself as ML-protected. Silent degradation of a security control is the
 *   failure mode, not the fallback itself.
 *
 * WHAT THIS MODULE ADDS
 *   1. A probe (probeMlTier) that answers "is the tier the operator configured
 *      actually able to run?" by pushing a canary through the REAL production
 *      path — the same augmentWithMl + cached backend a request uses, not a
 *      re-implementation that could pass while production fails.
 *   2. Runtime counters (recordMlAugmentOutcome) so a tier that loaded at boot and
 *      started throwing later is still reported as degraded. The rule is
 *      deliberately simple and honest: if the most recent outcome was a fail-open,
 *      the tier is degraded.
 *   3. A deploy gate. SOTERAI_ML_REQUIRE_HEALTHY=on turns "configured but not
 *      running" into a failure that a pipeline can act on: `npm run ml:health`
 *      exits non-zero, and /api/health answers 503 so an orchestrator marks the
 *      instance unhealthy instead of serving a downgraded guard.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   Judge model QUALITY. The canary asserts that the tier can score text, not that
 *   it scores it correctly — otherwise ordinary accuracy drift would refuse a
 *   deploy. Recall/FPR belong in the offline benchmarks
 *   (scripts/guard-benchmark/), not in a liveness check.
 */

import type { GuardResult } from "./types";
// TYPE-ONLY import: mlAugment imports recordMlAugmentOutcome from this module, so a
// value import here would create a runtime cycle. The probe pulls the functions in
// dynamically instead, which keeps the dependency one-directional at module scope.
import type { MlAugmentMode } from "./mlAugment";

/** What the ML tier is actually doing, as opposed to what it was configured to do. */
export type MlTierStatus =
  /** Operator did not enable it. Not a problem — the honest baseline. */
  | "disabled"
  /** Configured and proven able to score text. */
  | "healthy"
  /** Configured but NOT running: the silent fail-open this module exists to expose. */
  | "degraded";

export interface MlRuntimeCounters {
  /** augmentWithMl invocations since process start (mode != off only). */
  calls: number;
  /** Invocations where the model actually produced an inference. */
  ran: number;
  /** Invocations that fell back to rules-only because something failed. */
  failedOpen: number;
  lastError?: string;
  lastErrorAt?: string;
  lastRanAt?: string;
}

export interface MlTierHealth {
  /** What SOTERAI_ML_AUGMENT asked for. */
  configuredMode: MlAugmentMode;
  status: MlTierStatus;
  /** True only when the tier is configured to enforce AND is actually able to. */
  enforcing: boolean;
  /** Operator-facing explanation when degraded. May name paths — do not expose publicly. */
  reason?: string;
  /** Label the canary received. Diagnostic only; never gates health. */
  canaryLabel?: string;
  /**
   * Whether the tier would have escalated the (benign) canary. Diagnostic only —
   * health is about liveness, not accuracy — but a `true` here is a live
   * false positive on neutral prose and worth an operator's attention.
   */
  canaryWouldEscalate?: boolean;
  probeLatencyMs?: number;
  modelPath?: string;
  checkedAt: string;
  runtime: MlRuntimeCounters;
}

export interface GuardHealth {
  status: "ok" | "degraded";
  /** True when SOTERAI_ML_REQUIRE_HEALTHY makes a degraded ML tier a deploy failure. */
  requireHealthyMl: boolean;
  ml: MlTierHealth;
}

// ── Runtime counters ────────────────────────────────────────────────────────
// Process-local on purpose: a health signal must not depend on the database being
// reachable, and it must be free enough to record on every guarded request.

const counters: MlRuntimeCounters = { calls: 0, ran: 0, failedOpen: 0 };

/**
 * Ordering of the last success vs the last failure. A monotonic sequence, not the
 * ISO timestamps: two outcomes can share a millisecond, and "which happened last"
 * has to be exact when it decides whether a security tier is reported as degraded.
 */
interface OutcomeOrder {
  ranSeq: number;
  errorSeq: number;
}
let sequence = 0;
let order: OutcomeOrder = { ranSeq: 0, errorSeq: 0 };

/**
 * Called by mlAugment on every augment attempt. `ran: false` means the request was
 * served by rules alone — which is exactly the event that used to be invisible.
 */
export function recordMlAugmentOutcome(outcome: { ran: boolean; error?: string }): void {
  counters.calls += 1;
  sequence += 1;
  if (outcome.ran) {
    counters.ran += 1;
    counters.lastRanAt = new Date().toISOString();
    order = { ...order, ranSeq: sequence };
    return;
  }
  counters.failedOpen += 1;
  counters.lastErrorAt = new Date().toISOString();
  order = { ...order, errorSeq: sequence };
  // Truncated: this string reaches operator-facing surfaces and may echo a path
  // or a provider message.
  if (outcome.error) counters.lastError = outcome.error.slice(0, 300);
}

export function getMlRuntimeCounters(): MlRuntimeCounters {
  return { ...counters };
}

/**
 * True when the most recent outcome AS OF `observed` was a fail-open, i.e. the tier
 * is failing on live traffic. Callers pass a snapshot taken before their own canary
 * runs, so a passing probe can never overwrite production evidence — that masking
 * would recreate, one level up, the silent degradation this module exists to end.
 */
function lastOutcomeWasFailure(observed: OutcomeOrder): boolean {
  return observed.errorSeq > 0 && observed.errorSeq > observed.ranSeq;
}

/** Test seam: clears counters and the cached probe. */
export function __resetGuardHealthForTests(): void {
  counters.calls = 0;
  counters.ran = 0;
  counters.failedOpen = 0;
  delete counters.lastError;
  delete counters.lastErrorAt;
  delete counters.lastRanAt;
  sequence = 0;
  order = { ranSeq: 0, errorSeq: 0 };
  cachedProbe = null;
}

// ── Probe ───────────────────────────────────────────────────────────────────

/**
 * Neutral text. A liveness probe must prove the tier can SCORE, not that it agrees
 * with us about a particular attack — otherwise ordinary accuracy drift would start
 * failing deploys. The label it returns is reported as diagnostics only.
 *
 * DO NOT SWAP THIS STRING TO SILENCE THE "would be ESCALATED" WARNING.
 *   Both shipped artifacts call this sentence PROMPT_INJECTION and would escalate
 *   it: v7 at confidence 0.9573, v12 at 0.8283. Reaching for a sentence the current
 *   model happens to score SAFE would tune the probe to the model and throw away a
 *   true signal, and the signal is not a quirk of this one string — on the 30
 *   neutral / meta-instructional benign sentences in
 *   scripts/guard-benchmark/_audit-mlbias-2026-08-02.ts the ML tier escalates 13/30
 *   under v7 and 12/30 under v12 ("Keep your answer under 200 words.", "Answer in
 *   JSON with the keys title and summary.", "Give me a shorter version of the
 *   previous paragraph."). So the warning is reporting real over-defense on
 *   instruction-shaped English, and it is NOT a v12 regression — v12 is one row
 *   better and scores this canary lower than v7 does.
 *
 *   The warning is deliberately annotation-only: it never changes status or the
 *   exit code, because the gate's job is liveness. Closing the underlying gap needs
 *   meta-instructional benign hard negatives in a retrain, the same shape of fix as
 *   the v6 informational-benign round — not a different canary.
 */
const CANARY_TEXT = "Health probe: confirm the classifier is loaded and can score this sentence.";

/** Probes are cached briefly so /api/health cannot be used to hammer the model. */
const PROBE_TTL_MS = Number(process.env.SOTERAI_ML_HEALTH_TTL_MS ?? 60_000);

let cachedProbe: { at: number; health: MlTierHealth } | null = null;

/** A clean ALLOW, so anything the probe observes is attributable to the ML tier. */
function probeBase(): GuardResult {
  return {
    allowed: true,
    action: "ALLOW",
    riskScore: 0,
    riskTypes: ["LOW_RISK"],
    reason: "health probe",
    findings: [],
    metadata: {},
  };
}

export function resolveRequireHealthyMl(): boolean {
  const raw = (process.env.SOTERAI_ML_REQUIRE_HEALTHY ?? "off").toLowerCase();
  return raw === "on" || raw === "true" || raw === "1" || raw === "yes";
}

/**
 * Push a canary through the real guard path and report what the ML tier actually
 * did. Cached for PROBE_TTL_MS; pass `{ force: true }` in a deploy check.
 */
export async function probeMlTier(options?: { force?: boolean }): Promise<MlTierHealth> {
  if (!options?.force && cachedProbe && Date.now() - cachedProbe.at < PROBE_TTL_MS) {
    // Counters keep moving between probes, so refresh them even on a cache hit.
    return { ...cachedProbe.health, runtime: getMlRuntimeCounters() };
  }

  const { augmentWithMl, resolveMlAugmentMode } = await import("./mlAugment");
  const configuredMode = resolveMlAugmentMode();
  const checkedAt = new Date().toISOString();
  const modelPath = process.env.ML_ONNX_MODEL_PATH;

  if (configuredMode === "off") {
    const health: MlTierHealth = {
      configuredMode,
      status: "disabled",
      enforcing: false,
      reason: "SOTERAI_ML_AUGMENT is off; the guard is running on deterministic rules only.",
      checkedAt,
      runtime: getMlRuntimeCounters(),
    };
    cachedProbe = { at: Date.now(), health };
    return health;
  }

  // The canary goes through the real augment path, so it lands in the counters like
  // any other call. Capture the ordering FIRST: evaluating live-failure evidence
  // against a pre-canary snapshot is what stops a passing probe from erasing the
  // fact that production traffic is currently failing open.
  const orderBeforeProbe = { ...order };
  const started = Date.now();
  let ml:
    | { ran?: boolean; error?: string; predictedLabel?: string; wouldEscalate?: boolean }
    | undefined;
  let probeError: string | undefined;
  try {
    const result = await augmentWithMl(probeBase(), CANARY_TEXT, "INPUT");
    ml = (result.metadata as { ml?: typeof ml })?.ml;
  } catch (error) {
    // augmentWithMl is fail-open, so this should be unreachable. If it ever throws,
    // that is a bug worth surfacing rather than swallowing.
    probeError = `augmentWithMl threw instead of failing open: ${(error as Error).message}`;
  }
  const probeLatencyMs = Date.now() - started;

  const ran = ml?.ran === true;
  const health: MlTierHealth = {
    configuredMode,
    status: ran ? "healthy" : "degraded",
    enforcing: ran && configuredMode === "enforce",
    canaryLabel: ml?.predictedLabel,
    canaryWouldEscalate: ml?.wouldEscalate,
    probeLatencyMs,
    modelPath,
    checkedAt,
    runtime: getMlRuntimeCounters(),
  };

  if (!ran) {
    health.reason =
      probeError ??
      ml?.error ??
      (modelPath
        ? `ML tier is configured as "${configuredMode}" but did not run. The model at ` +
          `${modelPath} could not be loaded (missing weights, unpulled LFS stub, absent ` +
          "signed manifest, or a supply-chain gate rejection). Run `npm run ml:health` for detail."
        : `ML tier is configured as "${configuredMode}" but ML_ONNX_MODEL_PATH is not set, ` +
          "so no model can ever load. The guard is silently rules-only.");
  } else if (lastOutcomeWasFailure(orderBeforeProbe)) {
    // Loaded fine for us, but production traffic is currently failing open.
    health.status = "degraded";
    health.enforcing = false;
    health.reason =
      `ML tier loaded, but the most recent production augment failed open ` +
      `(${counters.failedOpen} of ${counters.calls} calls): ${counters.lastError ?? "unknown error"}`;
  }

  cachedProbe = { at: Date.now(), health };
  return health;
}

// ── Snapshots ───────────────────────────────────────────────────────────────

/**
 * Full guard-tier health. `status` is "degraded" only when a tier the operator
 * ASKED for is not delivering — a disabled tier is honest, not degraded.
 */
export async function getGuardHealth(options?: { force?: boolean }): Promise<GuardHealth> {
  const ml = await probeMlTier(options);
  return {
    status: ml.status === "degraded" ? "degraded" : "ok",
    requireHealthyMl: resolveRequireHealthyMl(),
    ml,
  };
}

/**
 * Redacted view for unauthenticated callers. `reason`, `modelPath`, counters and
 * error strings are operator diagnostics: they can name filesystem paths and
 * internal failure detail, so they stay out of any public payload. The coarse
 * status is still published, because hiding a degraded security tier from the
 * people relying on it is the dishonesty this module was written to end.
 */
export function toPublicGuardHealth(health: GuardHealth): {
  status: GuardHealth["status"];
  ml: { mode: MlAugmentMode; status: MlTierStatus; enforcing: boolean };
} {
  return {
    status: health.status,
    ml: {
      mode: health.ml.configuredMode,
      status: health.ml.status,
      enforcing: health.ml.enforcing,
    },
  };
}

/**
 * Deploy gate. Throws when the operator demanded a working ML tier and did not get
 * one, so a pipeline step (`npm run ml:health`) or a startup check fails loudly
 * instead of shipping a guard that silently dropped to rules-only.
 */
export async function assertMlTierHealthy(): Promise<MlTierHealth> {
  const ml = await probeMlTier({ force: true });
  if (resolveRequireHealthyMl() && ml.status === "degraded") {
    throw new Error(
      `SOTERAI_ML_REQUIRE_HEALTHY is on and the ML tier is degraded: ${ml.reason ?? "unknown reason"}`,
    );
  }
  return ml;
}





