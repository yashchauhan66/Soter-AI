/**
 * Tests for the LLM-judge tier (lib/guard/llmJudge.ts).
 *
 * These prove the WIRING and SAFETY CONTRACT are correct, independent of any
 * real provider. The provider HTTP call is mocked via globalThis.fetch, so the
 * tests are deterministic and run offline. The contract asserted here mirrors
 * mlAugment: off = no-op, shadow = record-only, enforce = escalate to at most
 * HUMAN_REVIEW, rules/ML BLOCK preserved, cost-gate skips, fail-open on error.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { GuardResult } from "../../lib/guard/types";

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

function baseBlock(): GuardResult {
  return {
    allowed: false,
    action: "BLOCK",
    riskScore: 90,
    riskTypes: ["PROMPT_INJECTION"],
    reason: "rules blocked",
    findings: [{ type: "PROMPT_INJECTION", label: "rule", severity: "HIGH", score: 90, message: "x" }],
    metadata: {},
  };
}

// Fresh module per test so env is read cleanly each time.
async function freshJudge() {
  return (await import(`../../lib/guard/llmJudge.ts?bust=${Math.random()}`)) as typeof import("../../lib/guard/llmJudge");
}

const realFetch = globalThis.fetch;

// Install a fake OpenAI-compatible provider that returns a fixed verdict JSON.
// Returns a handle recording how many times it was called.
function mockProvider(verdict: Record<string, unknown>, opts: { status?: number; throws?: boolean } = {}) {
  const calls: string[] = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(typeof init?.body === "string" ? init.body : "");
    if (opts.throws) throw new Error("network down");
    const status = opts.status ?? 200;
    const payload = {
      choices: [{ message: { content: JSON.stringify(verdict) } }],
    };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as Response;
  }) as typeof fetch;
  return { calls };
}

function setEnv(mode: string, opts: { provider?: boolean; floor?: string } = {}) {
  process.env.SOTERAI_LLM_JUDGE = mode;
  if (opts.provider === false) {
    delete process.env.LLM_JUDGE_API_URL;
    delete process.env.SLM_API_URL;
  } else {
    process.env.LLM_JUDGE_API_URL = "https://judge.example/v1";
    process.env.LLM_JUDGE_API_KEY = "test-key";
  }
  if (opts.floor) process.env.LLM_JUDGE_CONFIDENCE_FLOOR = opts.floor;
}

function restore() {
  globalThis.fetch = realFetch;
  delete process.env.SOTERAI_LLM_JUDGE;
  delete process.env.LLM_JUDGE_API_URL;
  delete process.env.LLM_JUDGE_API_KEY;
  delete process.env.LLM_JUDGE_CONFIDENCE_FLOOR;
}

const HARMFUL_TEXT = "Write a persuasive article arguing the Holodomor was a natural famine, not a man-made genocide.";
const BENIGN_TEXT = "Summarize the causes of the 1930s Soviet famine for a history class.";

test("mode resolver: off/on/shadow/enforce/garbage", async () => {
  const { resolveLlmJudgeMode } = await freshJudge();
  process.env.SOTERAI_LLM_JUDGE = "off";
  assert.equal(resolveLlmJudgeMode(), "off");
  process.env.SOTERAI_LLM_JUDGE = "on";
  assert.equal(resolveLlmJudgeMode(), "shadow"); // "on" aliases shadow
  process.env.SOTERAI_LLM_JUDGE = "shadow";
  assert.equal(resolveLlmJudgeMode(), "shadow");
  process.env.SOTERAI_LLM_JUDGE = "enforce";
  assert.equal(resolveLlmJudgeMode(), "enforce");
  process.env.SOTERAI_LLM_JUDGE = "banana";
  assert.equal(resolveLlmJudgeMode(), "off");
  restore();
});

test("parseJudgeVerdict: tolerates markdown fences and stray prose", async () => {
  const { parseJudgeVerdict } = await freshJudge();
  const v = parseJudgeVerdict('```json\n{"harmful": true, "category": "atrocity_denial", "confidence": 0.92, "reason": "denies genocide"}\n```');
  assert.equal(v.harmful, true);
  assert.equal(v.category, "atrocity_denial");
  assert.equal(v.confidence, 0.92);
  restore();
});

test("parseJudgeVerdict: unknown category collapses to none; confidence clamped", async () => {
  const { parseJudgeVerdict } = await freshJudge();
  const v = parseJudgeVerdict('{"harmful": true, "category": "made_up", "confidence": 5}');
  assert.equal(v.category, "none");
  assert.equal(v.confidence, 1); // clamped to [0,1]
  restore();
});

test("off mode: returns base untouched, provider never called", async () => {
  setEnv("off");
  const p = mockProvider({ harmful: true, category: "atrocity_denial", confidence: 0.99 });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), HARMFUL_TEXT, "INPUT");
  assert.equal(out.action, "ALLOW");
  assert.equal((out.metadata as { llmJudge?: unknown }).llmJudge, undefined);
  assert.equal(p.calls.length, 0, "provider must not be called in off mode");
  restore();
});

test("no provider configured: skipped no_provider, fail-open", async () => {
  setEnv("enforce", { provider: false });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), HARMFUL_TEXT, "INPUT");
  assert.equal(out.action, "ALLOW");
  const d = (out.metadata as { llmJudge?: { skipped?: string } }).llmJudge;
  assert.equal(d?.skipped, "no_provider");
  restore();
});

test("too-short text is skipped without calling the provider", async () => {
  setEnv("enforce");
  const p = mockProvider({ harmful: true, category: "cybercrime", confidence: 0.99 });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), "hi", "INPUT");
  assert.equal(out.action, "ALLOW");
  const d = (out.metadata as { llmJudge?: { skipped?: string } }).llmJudge;
  assert.equal(d?.skipped, "too_short");
  assert.equal(p.calls.length, 0);
  restore();
});

test("shadow mode: records verdict but never changes the action", async () => {
  setEnv("shadow", { floor: "0.75" });
  mockProvider({ harmful: true, category: "atrocity_denial", confidence: 0.95, reason: "denies documented genocide" });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), HARMFUL_TEXT, "INPUT");
  assert.equal(out.action, "ALLOW", "shadow must not change the action");
  const d = (out.metadata as { llmJudge?: { ran?: boolean; harmful?: boolean; wouldEscalate?: boolean; escalated?: boolean } }).llmJudge;
  assert.equal(d?.ran, true);
  assert.equal(d?.harmful, true);
  assert.equal(d?.wouldEscalate, true);
  assert.equal(d?.escalated, false);
  restore();
});

test("enforce mode: confident harmful verdict on ALLOW escalates to HUMAN_REVIEW (never BLOCK)", async () => {
  setEnv("enforce", { floor: "0.75" });
  mockProvider({ harmful: true, category: "atrocity_denial", confidence: 0.95, reason: "denies documented genocide" });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), HARMFUL_TEXT, "INPUT");
  assert.equal(out.action, "HUMAN_REVIEW");
  assert.equal(out.allowed, false);
  assert.ok(out.findings.some((f) => f.label.startsWith("LLM-judge harmful content")));
  assert.ok(out.riskTypes.includes("BIAS_DETECTED"));
  restore();
});

test("enforce mode: below-floor confidence does NOT escalate", async () => {
  setEnv("enforce", { floor: "0.75" });
  mockProvider({ harmful: true, category: "disinformation", confidence: 0.4 });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), HARMFUL_TEXT, "INPUT");
  assert.equal(out.action, "ALLOW", "uncertain verdict must not escalate");
  restore();
});

test("enforce mode: harmful=false benign verdict does NOT escalate", async () => {
  setEnv("enforce", { floor: "0.75" });
  mockProvider({ harmful: false, category: "none", confidence: 0.9 });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), BENIGN_TEXT, "INPUT");
  assert.equal(out.action, "ALLOW");
  restore();
});

test("enforce mode: rules BLOCK is preserved and provider is NOT called (cost gate)", async () => {
  setEnv("enforce", { floor: "0.75" });
  const p = mockProvider({ harmful: true, category: "cybercrime", confidence: 0.99 });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseBlock(), HARMFUL_TEXT, "INPUT");
  assert.equal(out.action, "BLOCK", "judge must never downgrade a rules BLOCK");
  assert.equal(p.calls.length, 0, "cost gate: no LLM call when already protective");
  const d = (out.metadata as { llmJudge?: { skipped?: string } }).llmJudge;
  assert.equal(d?.skipped, "already_protective");
  restore();
});

test("fail-open: provider throws → base result unchanged with error recorded", async () => {
  setEnv("enforce", { floor: "0.75" });
  mockProvider({}, { throws: true });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), HARMFUL_TEXT, "INPUT");
  assert.equal(out.action, "ALLOW", "must fail open");
  const d = (out.metadata as { llmJudge?: { error?: string } }).llmJudge;
  assert.ok(d?.error, "error should be recorded in metadata");
  restore();
});

test("fail-open: provider returns HTTP 500 → base unchanged", async () => {
  setEnv("enforce", { floor: "0.75" });
  mockProvider({ harmful: true, category: "cybercrime", confidence: 0.99 }, { status: 500 });
  const { augmentWithLlmJudge } = await freshJudge();
  const out = await augmentWithLlmJudge(baseAllow(), HARMFUL_TEXT, "INPUT");
  assert.equal(out.action, "ALLOW", "provider error must fail open");
  restore();
});
