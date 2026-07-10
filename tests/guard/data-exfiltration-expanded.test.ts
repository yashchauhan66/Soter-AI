import assert from "node:assert/strict";
import test from "node:test";
import { DATA_EXFILTRATION_EXPANDED } from "../../lib/classifiers/datasets/expanded/dataExfiltrationExpanded";
import { attackRecall, describe } from "./_expanded-harness";

test("Phase 3 expanded data-exfiltration recall is at least 95%", () => {
  const result = attackRecall(DATA_EXFILTRATION_EXPANDED);
  assert.ok(result.recall >= 0.95, `recall ${(result.recall * 100).toFixed(1)}%; misses: ${describe(result.misses)}`);
});
