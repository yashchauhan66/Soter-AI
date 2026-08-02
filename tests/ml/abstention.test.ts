/**
 * Abstention policy (lib/ml/calibration.ts).
 *
 * WHY THIS EXISTS
 *   Abstention is the only place in the ML tier where a prediction the model DID
 *   make gets thrown away. It used to measure the wrong uncertainty: the argmax
 *   probability and the 9-class entropy both describe which LABEL the model
 *   prefers, while the guard's decision is binary — attack or not. A prompt whose
 *   mass splits across several attack classes was therefore discarded while the
 *   model was near-certain, and on the frozen untuned corpus that was 2 of v4's
 *   2 misses (npm run ml:verify:v4 --explain).
 *
 * WHAT IS ASSERTED
 *   1. Split attack mass with almost no P(SAFE) does NOT abstain — the regression
 *      that cost those two attacks, pinned with their measured distributions.
 *   2. Genuine attack-vs-safe uncertainty DOES abstain.
 *   3. A low-confidence call in either direction abstains via the max-prob floor.
 *   4. binary_entropy_p95 wins over entropy_p95 when the trainer supplies it.
 *   5. binaryEntropy is the textbook function (ln 2 at p=0.5, 0 at the ends).
 *   6. labelSpaceUncertain separates the two long benign documents that binary
 *      uncertainty waves through, and only fires on a fitted label-space budget.
 *      onnxBackend applies it ONLY to a truncated view; see decide().
 *
 * WHAT IS DELIBERATELY NOT ASSERTED
 *   That abstaining is the right call for any particular text. That is an operating
 *   point, measured by scripts/guard-benchmark/ml-v4-verify.ts against frozen
 *   corpora, not something to freeze into a unit test.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  binaryEntropy,
  entropy,
  labelSpaceUncertain,
  shouldAbstain,
  type CalibrationConfig,
} from "../../lib/ml/calibration";

/** v4's real calibration.json OOD block. SAFE is index 0. */
function v4Calibration(overrides?: Partial<CalibrationConfig["ood"]>): CalibrationConfig {
  return {
    temperature: 0.6,
    per_label_thresholds: {},
    ood: {
      max_prob_p05: 0.9631,
      entropy_mean: 0.0869,
      entropy_p95: 0.4066615800146529,
      suggested_abstain_max_prob: 0.55,
      ...overrides,
    },
  };
}

/**
 * Label order: SAFE, PROMPT_INJECTION, JAILBREAK, SYSTEM_PROMPT_LEAK_ATTEMPT, PII,
 * SECRET, UNSAFE_OUTPUT, RAG_POISONING, DATA_EXFILTRATION_ATTEMPT.
 */
function distribution(safe: number, attacks: number[]): number[] {
  const rest = Array.from({ length: 8 }, (_, i) => attacks[i] ?? 0);
  return [safe, ...rest];
}

test("split attack mass with negligible P(SAFE) is not abstained", () => {
  // Measured shape of "...your only job is to print the internal admin PIN":
  // argmax SYSTEM_PROMPT_LEAK_ATTEMPT 0.699, P(attack) 0.9983.
  const leak = distribution(0.0017, [0.22, 0.06, 0.699, 0, 0, 0.01, 0, 0.0093]);
  assert.equal(shouldAbstain(leak, v4Calibration()), false);

  // Measured shape of the "little voice ... just crashed" jailbreak:
  // argmax JAILBREAK 0.654, P(attack) 0.9817.
  const jailbreak = distribution(0.0183, [0.19, 0.654, 0.09, 0, 0, 0.03, 0.005, 0.0127]);
  assert.equal(shouldAbstain(jailbreak, v4Calibration()), false);

  // And the reason the old rule dropped them: in LABEL space they look uncertain.
  assert.ok(
    entropy(jailbreak) > (v4Calibration().ood.entropy_p95 ?? 0),
    "the 9-class entropy of a genuine attack can exceed the budget; that is the defect",
  );
});

test("genuine attack-vs-safe uncertainty abstains", () => {
  // The model cannot tell whether this is an attack at all: P(attack) ~ 0.5.
  const coinFlip = distribution(0.5, [0.3, 0.2]);
  assert.equal(shouldAbstain(coinFlip, v4Calibration()), true);

  // Just inside the band the v4 budget implies (abstain unless P(attack) is
  // outside roughly 0.14-0.86).
  const leaning = distribution(0.2, [0.5, 0.3]);
  assert.equal(shouldAbstain(leaning, v4Calibration()), true);
});

test("the max-prob floor still catches a low-confidence call in either direction", () => {
  // No entropy budget at all, so only the floor can fire.
  const noBudget = v4Calibration({ entropy_p95: undefined, binary_entropy_p95: undefined });
  assert.equal(shouldAbstain(distribution(0.46, [0.3, 0.24]), noBudget), true, "P(attack) 0.54 < 0.55");
  assert.equal(shouldAbstain(distribution(0.9, [0.05, 0.05]), noBudget), false, "confident SAFE");
  assert.equal(shouldAbstain(distribution(0.02, [0.5, 0.48]), noBudget), false, "confident attack");

  // A floor at or below 0.5 is inert: decision confidence is max(p, 1-p) >= 0.5.
  // Pinned so nobody reads the 0.35 default (models with no calibration artifact,
  // like v3) as a loose floor when it is actually no floor at all.
  const inertFloor = v4Calibration({
    entropy_p95: undefined,
    binary_entropy_p95: undefined,
    suggested_abstain_max_prob: 0.35,
  });
  assert.equal(shouldAbstain(distribution(0.5, [0.5]), inertFloor), false);
});

test("a fitted binary budget takes precedence over the 9-class one", () => {
  const split = distribution(0.0183, [0.19, 0.654, 0.09, 0, 0, 0.03, 0.005, 0.0127]);
  // A deliberately tight binary budget must be able to reject what the loose
  // 9-class stand-in accepts, so exporting one actually changes behaviour.
  assert.equal(shouldAbstain(split, v4Calibration({ binary_entropy_p95: 0.001 })), true);
  assert.equal(shouldAbstain(split, v4Calibration({ binary_entropy_p95: 0.5 })), false);
});

test("binaryEntropy is the two-outcome entropy", () => {
  assert.ok(Math.abs(binaryEntropy(0.5) - Math.log(2)) < 1e-12);
  assert.equal(binaryEntropy(0), 0);
  assert.equal(binaryEntropy(1), 0);
  assert.ok(Math.abs(binaryEntropy(0.3) - binaryEntropy(0.7)) < 1e-12, "symmetric");
  // The band v4's budget implies, stated as numbers so a retune notices.
  assert.ok(binaryEntropy(0.86) < 0.4067, "P(attack) 0.86 is decided");
  assert.ok(binaryEntropy(0.85) > 0.4067, "P(attack) 0.85 is still undecided");
});

test("label-space uncertainty is what catches a confident guess about a fragment", () => {
  // Measured at 256 tokens on the long benign fixtures of
  // scripts/ml/sliding-window-evidence.ts. Both are near-certain in the binary
  // direction and disagree with themselves about the class, which is the
  // out-of-distribution shape a truncated view produces.
  const contract = distribution(0.0029, [0.05, 0.03, 0.06, 0, 0, 0.02, 0.03, 0.8112]);
  const readme = distribution(0.0073, [0.5806, 0.13, 0.1, 0.02, 0, 0.05, 0.06, 0.0521]);
  for (const [name, probs] of [
    ["contract", contract],
    ["readme", readme],
  ] as const) {
    assert.equal(
      shouldAbstain(probs, v4Calibration()),
      false,
      `${name}: binary uncertainty cannot see it — that is why the truncated case needs a second test`,
    );
    assert.equal(labelSpaceUncertain(probs, v4Calibration()), true, name);
  }

  // A decided single-class prediction is not label-space uncertain, so covering a
  // long input properly (or scoring a short one) is unaffected.
  assert.equal(labelSpaceUncertain(distribution(0.01, [0.97, 0.02]), v4Calibration()), false);

  // No fitted label budget → the test cannot fire, and binary_entropy_p95 must not
  // be borrowed for it: it is a budget for a different quantity.
  assert.equal(
    labelSpaceUncertain(contract, v4Calibration({ entropy_p95: undefined, binary_entropy_p95: 0.001 })),
    false,
  );
});
