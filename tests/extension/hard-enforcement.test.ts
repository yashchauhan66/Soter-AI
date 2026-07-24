import test from "node:test";
import assert from "node:assert/strict";
import { scanPrompt, withHardEnforcement, hardEnforcementEnabled } from "../../apps/extension/src/lib/scanner";
import { defaultState } from "../../apps/extension/src/lib/storage";
import type { ExtensionState, ScanResult } from "../../apps/extension/src/lib/types";

const enrolled = { ...defaultState, enrollmentStatus: "enrolled" as const };
// A prompt the default org policy blocks (AWS key -> local-secret-block on public_ai).
const BLOCKING_PROMPT = "here is our key AKIAIOSFODNN7EXAMPLE please debug";

function blockResult(): ScanResult {
  return {
    hasFindings: true, riskScore: 90, detectedDataTypes: ["aws_access_key"], findings: [], action: "block",
    policy: { action: "block", severity: "critical", matchedRules: [{ id: "local-secret-block", name: "x", action: "block", severity: "critical" }], userMessage: "", adminMessage: "", redactedText: "", rewrittenSafeText: "", auditMetadata: {} },
    redactedText: "", rewrittenSafeText: "", scannedAt: new Date(0).toISOString(),
  };
}

test("hardEnforcementEnabled: off by default", () => {
  assert.equal(hardEnforcementEnabled(enrolled), false);
});

test("hardEnforcementEnabled: on via signed org policy flag", () => {
  const state: ExtensionState = { ...enrolled, policy: { ...enrolled.policy!, hardEnforcement: true } };
  assert.equal(hardEnforcementEnabled(state), true);
});

test("hardEnforcementEnabled: on via managed config flag (Intune/GPO/MDM)", () => {
  const state: ExtensionState = { ...enrolled, config: { ...enrolled.config, hardEnforcement: true } };
  assert.equal(hardEnforcementEnabled(state), true);
});

test("withHardEnforcement: injects hard-enforcement-block rule on a block when enabled", () => {
  const result = withHardEnforcement(blockResult(), true);
  assert.ok(result.policy.matchedRules.some((r) => r.id === "hard-enforcement-block"));
  // Original matched rule is preserved.
  assert.ok(result.policy.matchedRules.some((r) => r.id === "local-secret-block"));
});

test("withHardEnforcement: no-op when disabled", () => {
  const result = withHardEnforcement(blockResult(), false);
  assert.equal(result.policy.matchedRules.some((r) => r.id === "hard-enforcement-block"), false);
});

test("withHardEnforcement: no-op for non-block actions even when enabled", () => {
  const warnResult: ScanResult = { ...blockResult(), action: "warn", policy: { ...blockResult().policy, action: "warn", matchedRules: [] } };
  const result = withHardEnforcement(warnResult, true);
  assert.equal(result.policy.matchedRules.some((r) => r.id === "hard-enforcement-block"), false);
});

test("withHardEnforcement: idempotent (does not double-add the rule)", () => {
  const once = withHardEnforcement(blockResult(), true);
  const twice = withHardEnforcement(once, true);
  const count = twice.policy.matchedRules.filter((r) => r.id === "hard-enforcement-block").length;
  assert.equal(count, 1);
});

test("scanPrompt: blocking prompt gets hard-enforcement rule when org policy enables it", () => {
  const state: ExtensionState = { ...enrolled, policy: { ...enrolled.policy!, hardEnforcement: true } };
  const result = scanPrompt(BLOCKING_PROMPT, "https://chatgpt.com/", state, "submit");
  assert.equal(result.action, "block");
  assert.ok(result.policy.matchedRules.some((r) => r.id === "hard-enforcement-block"),
    "hard-enforcement-block should be present so the overlay renders a locked, audited-dismiss block");
});

test("scanPrompt: blocking prompt has NO hard-enforcement rule when disabled (default)", () => {
  const result = scanPrompt(BLOCKING_PROMPT, "https://chatgpt.com/", enrolled, "submit");
  assert.equal(result.action, "block");
  assert.equal(result.policy.matchedRules.some((r) => r.id === "hard-enforcement-block"), false);
});

test("scanPrompt: offline fail-closed can be forced via managed config even without org policy flag", () => {
  const state: ExtensionState = {
    ...enrolled,
    policySyncStatus: "offline",
    config: { ...enrolled.config, offlineFailClosed: true },
  };
  // A totally benign prompt must still be blocked while offline + fail-closed.
  const result = scanPrompt("hello how are you", "https://chatgpt.com/", state, "submit");
  assert.equal(result.action, "block");
  assert.ok(result.policy.matchedRules.some((r) => r.id === "offline-fail-closed"));
});

test("scanPrompt: offline WITHOUT fail-closed does not force a block", () => {
  const state: ExtensionState = { ...enrolled, policySyncStatus: "offline" };
  const result = scanPrompt("hello how are you", "https://chatgpt.com/", state, "submit");
  assert.notEqual(result.action, "block");
});
