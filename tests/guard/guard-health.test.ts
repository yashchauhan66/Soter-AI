/**
 * Guard tier health (lib/guard/guardHealth.ts).
 *
 * WHY THIS EXISTS
 *   The ML tier is fail-open by design, which means a broken model produces
 *   ALLOW responses that are indistinguishable from protected ones. These tests
 *   pin the property that makes that safe to ship: a tier the operator ASKED for
 *   and did not get must report itself degraded, loudly, everywhere it is asked.
 *
 * WHAT IS ASSERTED
 *   1. Not configured = "disabled", not "degraded". An honest off is not a fault.
 *   2. Configured with no model = "degraded", with a reason that names the cause.
 *   3. Configured with a broken model path = "degraded" (fail-open still happened,
 *      the request still succeeded, but health tells the truth about it).
 *   4. `enforcing` is only true when the tier is BOTH configured to enforce and
 *      actually running — the claim can never outrun the capability.
 *   5. The public projection carries the status but leaks no paths, reasons or
 *      error strings.
 *   6. The deploy gate throws only when SOTERAI_ML_REQUIRE_HEALTHY is on.
 *   7. Runtime counters record fail-open events, and a tier whose most recent
 *      outcome was a failure is degraded even if a probe would pass.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { GuardResult } from "../../lib/guard/types";

import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import * as health from "../../lib/guard/guardHealth";
import * as mlAugment from "../../lib/guard/mlAugment";

const V4 = "models/ml-classifier-v4";
const TRUST_STORE = "artifacts/security/model-trust-store.json";

/** Real weights are ~90MB; a Git-LFS pointer stub is a few hundred bytes. */
function modelMaterialized(): boolean {
  try {
    if (statSync(`${V4}/model.onnx.data`).size < 100_000) return false;
    const fd = openSync(`${V4}/model.onnx.data`, "r");
    try {
      const buf = Buffer.alloc(64);
      readSync(fd, buf, 0, 64, 0);
      return !buf.toString("utf8").startsWith("version https://git-lfs");
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

const requiresModel = {
  skip:
    modelMaterialized() && existsSync(`${V4}/model.onnx.manifest.json`) && existsSync(TRUST_STORE)
      ? false
      : "ML runtime proof unavailable: materialized v4 weights plus signed manifest and operator trust store are required (npm run ml:sign)",
};

const MUTATED = [
  "SOTERAI_ML_AUGMENT",
  "SOTERAI_ML_REQUIRE_HEALTHY",
  "ML_ONNX_MODEL_PATH",
  "ML_ONNX_LABELS_PATH",
  "ML_ONNX_CALIBRATION_PATH",
  "ML_BACKEND",
  "SOTERAI_MODEL_TRUST_STORE",
  "SOTERAI_MODEL_APPROVED_SOURCES",
] as const;

/** Put the tier in a known configuration and clear every cache that could mask it. */
function configure(env: Partial<Record<(typeof MUTATED)[number], string>>): void {
  for (const key of MUTATED) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  mlAugment.__resetMlBackendForTests();
  health.__resetGuardHealthForTests();
}

function baseAllow(): GuardResult {
  return {
    allowed: true,
    action: "ALLOW",
    riskScore: 0,
    riskTypes: ["LOW_RISK"],
    reason: "clean",
    findings: [],
    metadata: {},
  };
}

test("not configured reports disabled, not degraded", async () => {
  configure({ SOTERAI_ML_AUGMENT: "off" });
  const snapshot = await health.getGuardHealth({ force: true });
  assert.equal(snapshot.ml.status, "disabled");
  assert.equal(snapshot.ml.enforcing, false);
  assert.equal(snapshot.status, "ok", "an operator who never enabled ML is not degraded");
});

test("configured with no model path is degraded and says why", async () => {
  configure({ SOTERAI_ML_AUGMENT: "enforce" });
  const snapshot = await health.getGuardHealth({ force: true });
  assert.equal(snapshot.ml.status, "degraded");
  assert.equal(snapshot.status, "degraded");
  assert.match(String(snapshot.ml.reason), /ML_ONNX_MODEL_PATH/);
});

test("a broken model fails open for the request but degrades health", async () => {
  configure({
    SOTERAI_ML_AUGMENT: "enforce",
    ML_ONNX_MODEL_PATH: "models/does-not-exist/model.onnx",
    ML_ONNX_LABELS_PATH: "models/does-not-exist/labels.json",
  });

  // The request must still succeed — fail-open is the runtime contract.
  const guarded = await mlAugment.augmentWithMl(baseAllow(), "summarise this invoice", "INPUT");
  assert.equal(guarded.action, "ALLOW", "a missing model must not break the guard");

  // ...but the failure must be visible rather than absorbed.
  const counters = health.getMlRuntimeCounters();
  assert.ok(counters.failedOpen >= 1, "fail-open must be counted");
  assert.ok(counters.lastError, "the reason must be retained for operators");

  const snapshot = await health.getGuardHealth({ force: true });
  assert.equal(snapshot.ml.status, "degraded");
  assert.equal(
    snapshot.ml.enforcing,
    false,
    "a tier that cannot run must never claim to be enforcing",
  );
});

test("the public projection publishes status but no internals", async () => {
  configure({
    SOTERAI_ML_AUGMENT: "enforce",
    ML_ONNX_MODEL_PATH: "models/does-not-exist/model.onnx",
  });
  const snapshot = await health.getGuardHealth({ force: true });
  const publicView = health.toPublicGuardHealth(snapshot);

  assert.equal(publicView.status, "degraded");
  assert.equal(publicView.ml.status, "degraded");
  assert.equal(publicView.ml.mode, "enforce");
  assert.equal(publicView.ml.enforcing, false);

  const serialized = JSON.stringify(publicView);
  assert.ok(!serialized.includes("does-not-exist"), "must not leak model paths");
  assert.ok(!/reason|lastError|modelPath/.test(serialized), "must not leak operator diagnostics");
});

test("the deploy gate only throws when the operator demanded a healthy tier", async () => {
  configure({
    SOTERAI_ML_AUGMENT: "enforce",
    ML_ONNX_MODEL_PATH: "models/does-not-exist/model.onnx",
    SOTERAI_ML_REQUIRE_HEALTHY: "off",
  });
  const tolerated = await health.assertMlTierHealthy();
  assert.equal(tolerated.status, "degraded", "reported, but not fatal when not required");

  process.env.SOTERAI_ML_REQUIRE_HEALTHY = "on";
  health.__resetGuardHealthForTests();
  await assert.rejects(
    () => health.assertMlTierHealthy(),
    /SOTERAI_ML_REQUIRE_HEALTHY is on and the ML tier is degraded/,
  );
});

test("a loaded tier reports healthy and enforcing", requiresModel, async () => {
  configure({
    SOTERAI_ML_AUGMENT: "enforce",
    ML_ONNX_MODEL_PATH: `${V4}/model.onnx`,
    ML_ONNX_LABELS_PATH: `${V4}/labels.json`,
    ML_ONNX_CALIBRATION_PATH: `${V4}/calibration.json`,
    SOTERAI_MODEL_TRUST_STORE: TRUST_STORE,
    SOTERAI_MODEL_APPROVED_SOURCES: "local-training",
  });

  const snapshot = await health.getGuardHealth({ force: true });
  assert.equal(snapshot.ml.status, "healthy", `degraded: ${snapshot.ml.reason ?? "-"}`);
  assert.equal(snapshot.ml.enforcing, true);
  assert.equal(snapshot.status, "ok");
  assert.ok(snapshot.ml.canaryLabel, "the probe should report what the canary scored");
  assert.ok(
    (snapshot.ml.probeLatencyMs ?? 0) >= 0 && snapshot.ml.probeLatencyMs !== undefined,
    "probe latency is recorded",
  );
});

test("a tier that starts failing after load is degraded on runtime evidence", requiresModel, async () => {
  configure({
    SOTERAI_ML_AUGMENT: "enforce",
    ML_ONNX_MODEL_PATH: `${V4}/model.onnx`,
    ML_ONNX_LABELS_PATH: `${V4}/labels.json`,
    ML_ONNX_CALIBRATION_PATH: `${V4}/calibration.json`,
    SOTERAI_MODEL_TRUST_STORE: TRUST_STORE,
    SOTERAI_MODEL_APPROVED_SOURCES: "local-training",
  });
  assert.equal((await health.probeMlTier({ force: true })).status, "healthy");

  // Simulate what a mid-life failure looks like to the guard: the last thing that
  // happened on the real request path was a fail-open.
  health.recordMlAugmentOutcome({ ran: true });
  health.recordMlAugmentOutcome({ ran: false, error: "onnxruntime session crashed" });

  const snapshot = await health.probeMlTier({ force: true });
  assert.equal(snapshot.status, "degraded", "the probe passing does not excuse live failures");
  assert.equal(snapshot.enforcing, false);
  assert.match(String(snapshot.reason), /failed open/);
  assert.match(String(snapshot.reason), /session crashed/);

  // And once live traffic succeeds again, health recovers on its own.
  health.recordMlAugmentOutcome({ ran: true });
  const recovered = await health.probeMlTier({ force: true });
  assert.equal(recovered.status, "healthy", "a recovered tier must not stay latched degraded");
});



