import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_PROMPT_LEAK_EXPANDED } from "../../lib/classifiers/datasets/expanded/systemPromptLeakExpanded";
import { attackRecall, describe } from "./_expanded-harness";

test("Phase 3 expanded system-prompt-leak recall is at least 95%", () => {
  const result = attackRecall(SYSTEM_PROMPT_LEAK_EXPANDED);
  assert.ok(result.recall >= 0.95, `recall ${(result.recall * 100).toFixed(1)}%; misses: ${describe(result.misses)}`);
});
