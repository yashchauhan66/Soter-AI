import assert from "node:assert/strict";
import test from "node:test";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { augmentWithMl, __resetMlBackendForTests, type MlAugmentDetail } from "../../lib/guard/mlAugment";
import type { GuardResult } from "../../lib/guard/types";

const base = (): GuardResult => ({
  allowed: true, action: "ALLOW", riskScore: 0, riskTypes: ["LOW_RISK"],
  reason: "clean", findings: [], metadata: {},
});

async function withEnv(settings: Record<string, string>, run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  __resetMlBackendForTests();
  try { await run(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    __resetMlBackendForTests();
  }
}

test("guard retains incomplete and complete coverage without changing its decision", async (t) => {
  for (const truncated of [true, false]) {
    const mock = t.mock.method(ONNXClassifierBackend.prototype, "infer", async () => ({
      predictedLabel: "SAFE" as const,
      confidence: 0.99,
      raw: {
        attackProbability: 0.01, abstained: false, rawPredictedLabel: "SAFE",
        truncated, contentTokens: 600, tokensScored: truncated ? 254 : 600,
        windows: truncated ? 1 : 7, maxLength: 256,
      },
    }));
    try {
      await withEnv({ SOTERAI_ML_AUGMENT: "enforce", ML_ONNX_MODEL_PATH: "missing-coverage-fixture/model.onnx", ML_ONNX_MAX_LENGTH: "256" }, async () => {
        const result = await augmentWithMl(base(), "please summarize this document", "INPUT");
        const ml = result.metadata?.ml as MlAugmentDetail;
        assert.equal(result.action, "ALLOW");
        assert.equal(result.allowed, true);
        assert.equal(ml.ran, true);
        assert.equal(ml.truncated, truncated);
        assert.equal(ml.contentTokens, 600);
        assert.equal(ml.tokensScored, truncated ? 254 : 600);
        assert.equal(ml.windows, truncated ? 1 : 7);
        assert.equal(ml.maxLength, 256);
      });
    } finally { mock.mock.restore(); }
  }
});

test("invalid runtime configuration preserves the recorded fail-open contract", async () => {
  await withEnv({ SOTERAI_ML_AUGMENT: "enforce", ML_ONNX_MODEL_PATH: "missing-coverage-fixture/model.onnx", ML_ONNX_MAX_LENGTH: "NaN" }, async () => {
    const result = await augmentWithMl(base(), "please summarize this document", "INPUT");
    const ml = result.metadata?.ml as MlAugmentDetail;
    assert.equal(result.action, "ALLOW");
    assert.equal(ml.ran, false);
    assert.match(ml.error ?? "", /integer of at least 3/);
  });
});
