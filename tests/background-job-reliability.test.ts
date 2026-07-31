import assert from "node:assert/strict";
import test from "node:test";
import { nextBackgroundJobFailureState } from "../lib/backgroundJobs";

test("background retry schedule is exponential and bounded", () => {
  const now = new Date("2026-07-30T00:00:00.000Z");
  assert.equal(nextBackgroundJobFailureState({ attempts: 1, maxAttempts: 5, now }).delayMs, 2_000);
  assert.equal(nextBackgroundJobFailureState({ attempts: 2, maxAttempts: 5, now }).delayMs, 4_000);
  assert.equal(nextBackgroundJobFailureState({ attempts: 20, maxAttempts: 25, now }).delayMs, 60_000);
});

test("exhausted background jobs enter an explicit terminal dead-letter state", () => {
  const state = nextBackgroundJobFailureState({ attempts: 3, maxAttempts: 3, now: new Date(0) });
  assert.equal(state.exhausted, true);
  assert.equal(state.status, "FAILED");
  assert.equal(state.event, "DEAD_LETTER");
  assert.equal(state.delayMs, 0);
});

test("background retries stop before exhaustion and become claimable later", () => {
  const now = new Date("2026-07-30T00:00:00.000Z");
  const state = nextBackgroundJobFailureState({ attempts: 2, maxAttempts: 3, now });
  assert.equal(state.status, "PENDING");
  assert.equal(state.event, "RETRY_SCHEDULED");
  assert.equal(state.runAfter.getTime(), now.getTime() + 4_000);
});
