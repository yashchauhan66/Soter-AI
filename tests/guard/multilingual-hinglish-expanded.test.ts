import assert from "node:assert/strict";
import test from "node:test";
import { MULTILINGUAL_HINGLISH_EXPANDED } from "../../lib/classifiers/datasets/expanded/multilingualHinglishExpanded";
import { attackRecall, describe } from "./_expanded-harness";

test("Phase 3 expanded multilingual/Hinglish recall is at least 90%", () => {
  const result = attackRecall(MULTILINGUAL_HINGLISH_EXPANDED);
  assert.ok(result.recall >= 0.90, `recall ${(result.recall * 100).toFixed(1)}%; misses: ${describe(result.misses)}`);
});
