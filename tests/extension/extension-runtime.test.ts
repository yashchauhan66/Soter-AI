import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditSafePreview } from "../../apps/extension/src/lib/redaction";
import { getCachedPolicy, getState, setState } from "../../apps/extension/src/lib/storage";
import { scanPrompt, shouldPreventSubmit } from "../../apps/extension/src/lib/scanner";
import { browserName, sendHeartbeat } from "../../apps/extension/src/background/heartbeat";
import { evaluateSubmitInterception } from "../../apps/extension/src/content/submit-interceptor";
import { chatgptAdapter } from "../../apps/extension/src/content/adapters/chatgpt";
import { claudeAdapter } from "../../apps/extension/src/content/adapters/claude";
import { geminiAdapter } from "../../apps/extension/src/content/adapters/gemini";
import type { RuntimeResponse, ScanResult } from "../../apps/extension/src/lib/types";

const storage = new Map<string, unknown>();

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      async get(keys: string[]) {
        return Object.fromEntries(keys.map((key) => [key, storage.get(key)]));
      },
      async set(items: Record<string, unknown>) {
        for (const [key, value] of Object.entries(items)) storage.set(key, value);
      },
    },
  },
  runtime: { sendMessage() {} },
};

Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "Mozilla/5.0 Edg/126.0 Chrome/126.0" },
  configurable: true,
});

test("local policy cache survives offline operation", async () => {
  const initial = await getState();
  await setState({ policySyncStatus: "offline", policy: { ...initial.policy!, version: "cached-v2" } });
  const cached = await getCachedPolicy();
  assert.equal(cached.version, "cached-v2");
});

test("audit preview redacts secrets before logs", () => {
  const preview = auditSafePreview("api_key = abcdefghijklmnop and PAN ABCDE1234F", ["api_key", "pan"]);
  assert.equal(preview.includes("abcdefghijklmnop"), false);
  assert.equal(preview.includes("ABCDE1234F"), false);
});

test("heartbeat sends browser and policy metadata", async () => {
  const calls: unknown[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return { ok: true, json: async () => ({ ok: true }) };
  };
  assert.equal(browserName(), "edge");
  await sendHeartbeat("chatgpt.com");
  assert.equal((calls[0] as { browser: string }).browser, "edge");
  assert.equal((calls[0] as { domain: string }).domain, "chatgpt.com");
});

test("scanner redacts and blocks a ChatGPT secret prompt", async () => {
  const state = await getState();
  const result = scanPrompt("api_key = abcdefghijklmnop", "https://chatgpt.com/", state);
  assert.equal(result.action, "block");
  assert.equal(shouldPreventSubmit(result.action), true);
  assert.match(result.redactedText, /\[REDACTED_(?:SECRET|API_KEY)\]/);
});

test("clean response scanning stays local with no findings", async () => {
  const state = await getState();
  const result = scanPrompt("This is a generic public answer about project planning.", "https://chatgpt.com/", state, "response");
  assert.equal(result.hasFindings, false);
  assert.equal(result.detectedDataTypes.length, 0);
  assert.equal(result.action, "allow");
});

test("service worker audits response scans only when findings exist", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../../apps/extension/src/background/service-worker.ts"), "utf8");
  assert.match(source, /const isResponseScan = request\.eventType === "response"/);
  assert.match(source, /if \(!isResponseScan \|\| result\.hasFindings\) void api\.audit/);
  assert.match(source, /if \(!isResponseScan \|\| result\.hasFindings\) void api\.scan/);
});

test("extension locally evaluates compiled custom keyword policies", async () => {
  const state = await getState();
  const policy = {
    ...state.policy!,
    version: "12",
    rules: [{
      id: "custom-codename",
      name: "Block internal codename",
      action: "block" as const,
      severity: "critical" as const,
      destinations: ["chatgpt.com"],
      detectedDataTypes: ["custom_keyword"],
      enabled: true,
    }],
    customDetectors: {
      keywords: ["private-roadmap"],
      regex: [],
      documentFingerprints: [],
    },
  };
  const result = scanPrompt("Summarize the private-roadmap", "https://chatgpt.com/", { ...state, policy } as typeof state);
  assert.equal(result.action, "block");
  assert.ok(result.detectedDataTypes.includes("custom_keyword"));
});

test("ChatGPT, Claude, and Gemini adapters match their AI domains", () => {
  assert.equal(chatgptAdapter().matches("chatgpt.com"), true);
  assert.equal(claudeAdapter().matches("claude.ai"), true);
  assert.equal(geminiAdapter().matches("gemini.google.com"), true);
});

test("mock submit interception blocks sensitive prompt and allows clean prompt", async () => {
  const blocked = await evaluateSubmitInterception("api_key = abcdefghijklmnop", async () => ({
    ok: true,
    result: fakeScan("block", true),
  }));
  const allowed = await evaluateSubmitInterception("hello", async () => ({
    ok: true,
    result: fakeScan("allow", false),
  }));
  assert.equal(blocked.intercept, true);
  assert.equal(allowed.intercept, false);
});

function fakeScan(action: ScanResult["action"], hasFindings: boolean): ScanResult {
  return {
    hasFindings,
    riskScore: hasFindings ? 90 : 0,
    detectedDataTypes: hasFindings ? ["api_key"] : [],
    findings: [],
    action,
    redactedText: hasFindings ? "[REDACTED_SECRET]" : "hello",
    rewrittenSafeText: hasFindings ? "[REDACTED_SECRET]" : "hello",
    scannedAt: new Date(0).toISOString(),
    policy: {
      action,
      severity: hasFindings ? "critical" : "info",
      matchedRules: [],
      userMessage: "",
      adminMessage: "",
      redactedText: hasFindings ? "[REDACTED_SECRET]" : "hello",
      rewrittenSafeText: hasFindings ? "[REDACTED_SECRET]" : "hello",
      auditMetadata: {},
    },
  };
}
