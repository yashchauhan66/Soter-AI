import assert from "node:assert/strict";
import test from "node:test";
import { TOOL_ABUSE_EXPANDED } from "../../lib/classifiers/datasets/expanded/toolAbuseExpanded";
import { attackRecall, describe } from "./_expanded-harness";

test("Phase 3 expanded tool-abuse recall is at least 95%", () => {
  const result = attackRecall(TOOL_ABUSE_EXPANDED);
  assert.ok(result.recall >= 0.95, `recall ${(result.recall * 100).toFixed(1)}%; misses: ${describe(result.misses)}`);
});
