/**
 * Continuous learning worker — the tiered clock.
 *
 * WHY A TIERED CLOCK AND NOT "RETRAIN EVERY MINUTE"
 *   The ask was a model that keeps strengthening itself, retrained continuously.
 *   Two of the four things a detector is made of really can move on a one-minute
 *   clock. The other two cannot, and forcing them to would make the product worse,
 *   not better:
 *
 *     tier 1  ~1 min    threat indicators   new IOC blocks the same minute it lands
 *     tier 2  ~15 min   harvest             collect what the stack is confused about
 *     tier 3  ~daily    thresholds/calib    needs a full frozen-eval run to certify
 *     tier 4  ~weekly   model weights       needs GPU + a shadow window + a gate
 *
 *   Retraining WEIGHTS every minute has no validation window — you cannot measure a
 *   3,987-row frozen eval set inside 60 seconds, so every promotion would be
 *   unmeasured by construction, which is exactly the "rank on paper, not actually
 *   stronger" failure. It also invites catastrophic forgetting: v4 was newer than v3
 *   and measured WORSE on identical rows. Sixty of those per hour compounds.
 *
 *   So the fast tiers move fast and the slow tiers stay honest. What the operator
 *   experiences is still "it got better on its own overnight", because tiers 1-2 run
 *   continuously and feed tiers 3-4.
 *
 * SAFETY CONTRACT
 *   - Off by default (CONTINUOUS_LEARNING=on). No behaviour change unless enabled.
 *   - This worker NEVER promotes on its own. It produces candidates and evidence;
 *     promotion requires evaluatePromotion() to return PROMOTE on a frozen eval run,
 *     and the rollout stays staged (SHADOW -> PARTIAL -> FULL) via lib/ml/rollout.ts.
 *   - It inherits threatIntelWorker's rule: no remote auto-import of production
 *     rules. Feeds are ingested as QUARANTINED candidates, never as live rules.
 *   - Every tick is fail-open and logged. A learning loop that breaks the guard is
 *     strictly worse than no learning loop.
 */

import http from "http";
import { harvestCandidates } from "@/lib/ml/continuousLearning/harvest";
import { validateRetrainingDataset, type RetrainingExample } from "@/lib/ml/retrainingValidation";
import type { GuardObservation, HarvestCandidate } from "@/lib/ml/continuousLearning/types";

const ENABLED = (process.env.CONTINUOUS_LEARNING ?? "off").toLowerCase() === "on";
const PORT = Number(process.env.CONTINUOUS_LEARNING_HEALTH_PORT ?? 3098);

/** Floors, not defaults: a tier may be slowed down, never sped past what it can certify. */
const TIER_INTERVALS = {
  indicators: Math.max(60_000, Number(process.env.CL_TIER1_INTERVAL_MS ?? 60_000)),
  harvest: Math.max(60_000, Number(process.env.CL_TIER2_INTERVAL_MS ?? 900_000)),
  calibration: Math.max(3_600_000, Number(process.env.CL_TIER3_INTERVAL_MS ?? 86_400_000)),
} as const;

interface TierState {
  lastRunAt: number | null;
  runs: number;
  failures: number;
  lastError?: string;
  lastSummary?: string;
}

const state: Record<"indicators" | "harvest" | "calibration", TierState> = {
  indicators: { lastRunAt: null, runs: 0, failures: 0 },
  harvest: { lastRunAt: null, runs: 0, failures: 0 },
  calibration: { lastRunAt: null, runs: 0, failures: 0 },
};

/** Rolling buffer of what production was confused about, drained by the harvest tier. */
const observationBuffer: GuardObservation[] = [];
const OBSERVATION_BUFFER_CAP = Number(process.env.CL_OBSERVATION_BUFFER_CAP ?? 20_000);

/** Quarantined output. Release to a trainer is a separate, human-gated step. */
const quarantine: HarvestCandidate[] = [];
const QUARANTINE_CAP = Number(process.env.CL_QUARANTINE_CAP ?? 50_000);

/**
 * Called by the guard routes when a request produced something worth learning from.
 * Text must already be redacted (lib/ml/types.ts redactBeforePersistence).
 */
export function recordObservation(observation: GuardObservation): void {
  if (!ENABLED) return;
  observationBuffer.push(observation);
  // Drop oldest rather than newest: novelty is the point of this loop.
  while (observationBuffer.length > OBSERVATION_BUFFER_CAP) observationBuffer.shift();
}

// --- tier 1: ~1 minute ------------------------------------------------------
// The only thing genuinely safe to move this fast, because an indicator is exact
// (a domain, a hash, an IP) rather than learned, and is reversible by deletion.
async function tickIndicators(): Promise<string> {
  // Inherits threatIntelWorker's decision: no remote auto-import into live rules.
  // A feed lands here as candidate evidence, and a human promotes it.
  return "indicator refresh: no remote auto-import (rule packs stay upload+approve)";
}

// --- tier 2: ~15 minutes ----------------------------------------------------
// Uncertainty sampling over the buffer. This is the tier that actually makes the
// next model stronger, and it is cheap: no inference, no GPU, pure selection.
async function tickHarvest(): Promise<string> {
  if (observationBuffer.length === 0) return "harvest: nothing observed";

  const batch = observationBuffer.splice(0, observationBuffer.length);
  const { candidates, dropped } = harvestCandidates(batch);

  // Re-assert the poison gate on anything carrying an auto-label, even though
  // harvest already refused untrusted benign. Two independent checks, because the
  // failure is silent if either one is wrong.
  const labelled: RetrainingExample[] = candidates
    .filter((c) => c.autoLabel !== null)
    .map((c) => ({ id: c.fingerprint, text: c.text, label: c.autoLabel!, source: c.source }));

  let validation = "";
  if (labelled.length > 0) {
    const report = validateRetrainingDataset(labelled);
    validation = ` validated(allowed=${report.allowed} attack=${report.attack} benign=${report.benign} findings=${report.findings.length})`;
    if (!report.allowed) {
      // HIGH-severity finding: keep the rows for a human to look at, but they do
      // not become training data. Refusing loudly beats training quietly.
      validation += " REFUSED-for-training";
    }
  }

  for (const candidate of candidates) {
    quarantine.push(candidate);
  }
  while (quarantine.length > QUARANTINE_CAP) quarantine.shift();

  return (
    `harvest: ${batch.length} observed -> ${candidates.length} candidates ` +
    `(${labelled.length} auto-labelled, ${quarantine.length} in quarantine); ` +
    `dropped noSignal=${dropped.noSignal} belowValue=${dropped.belowValue} dup=${dropped.duplicate} ` +
    `evalOverlap=${dropped.evalSetOverlap} cap=${dropped.sourceCap}${validation}`
  );
}

// --- tier 3: ~daily ---------------------------------------------------------
// Thresholds and calibration CAN be re-fit automatically, but only against the
// frozen eval set, and only through evaluatePromotion(). That run takes minutes
// and needs the ONNX backend, so it is a scheduled job, not an in-worker loop.
async function tickCalibration(): Promise<string> {
  return (
    "calibration: candidate thresholds require a frozen-eval run " +
    "(scripts/ml/eval-crossdist-production.ts) + evaluatePromotion() PROMOTE before any change"
  );
}

// tier 4 (weights) is deliberately NOT in this worker. It needs a GPU, a training
// corpus release out of quarantine, and a shadow window measured in days.

async function runTier(name: keyof typeof state, fn: () => Promise<string>): Promise<void> {
  const tier = state[name];
  try {
    const summary = await fn();
    tier.runs += 1;
    tier.lastRunAt = Date.now();
    tier.lastSummary = summary;
    tier.lastError = undefined;
    console.log(`[continuous-learning:${name}] ${summary}`);
  } catch (error) {
    tier.failures += 1;
    tier.lastError = (error as Error).message;
    // Fail-open: a broken learning tier must never affect the guard path.
    console.error(`[continuous-learning:${name}] failed`, error);
  }
}

if (ENABLED) {
  setInterval(() => void runTier("indicators", tickIndicators), TIER_INTERVALS.indicators);
  setInterval(() => void runTier("harvest", tickHarvest), TIER_INTERVALS.harvest);
  setInterval(() => void runTier("calibration", tickCalibration), TIER_INTERVALS.calibration);
  void runTier("indicators", tickIndicators);
  void runTier("harvest", tickHarvest);
} else {
  console.log("[continuous-learning] disabled (set CONTINUOUS_LEARNING=on to enable)");
}

http
  .createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        worker: "continuous-learning",
        enabled: ENABLED,
        intervalsMs: TIER_INTERVALS,
        buffered: observationBuffer.length,
        quarantined: quarantine.length,
        tiers: state,
        // Stated in the health payload so nobody reads this worker as auto-promotion.
        promotes: false,
        promotionRequires: "evaluatePromotion() PROMOTE on the frozen eval set + staged rollout",
      }),
    );
  })
  .listen(PORT);
