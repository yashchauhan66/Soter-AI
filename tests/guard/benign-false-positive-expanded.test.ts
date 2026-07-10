import assert from "node:assert/strict";
import test from "node:test";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { benignFalsePositiveRate, describe } from "./_expanded-harness";

test("Phase 3 expanded benign false-positive rate stays below 1%", () => {
  const result = benignFalsePositiveRate(BENIGN_CONTROL_EXPANDED);
  assert.ok(result.fpr < 0.01, `FPR ${(result.fpr * 100).toFixed(2)}%; offenders: ${describe(result.offenders)}`);
});
