import assert from "node:assert/strict";
import test from "node:test";
import { RAG_POISONING_EXPANDED } from "../../lib/classifiers/datasets/expanded/ragPoisoningExpanded";
import { attackRecall, describe } from "./_expanded-harness";

test("Phase 3 expanded RAG-poisoning recall is at least 90%", () => {
  const result = attackRecall(RAG_POISONING_EXPANDED);
  assert.ok(result.recall >= 0.90, `recall ${(result.recall * 100).toFixed(1)}%; misses: ${describe(result.misses)}`);
});
