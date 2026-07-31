import assert from "node:assert/strict";
import test from "node:test";
import { adaptLegacyDecision, adapterSupports, restoreLegacyDecision, type AdapterContext, type LegacySurface } from "../lib/gateway/adapters";

const context: AdapterContext = {
  severity: "HIGH", confidence: 0.87, riskScore: 73, threshold: "policy.high.v2",
  reason: "High-impact external action needs review.", policyVersion: "policy-7",
  identity: { organizationId: "org-1", projectId: "project-1", userId: "user-1", sessionId: "session-1" },
  destination: { provider: "mcp", model: null, host: "tools.example.test" },
  traceId: "trace-1", category: "TOOL_ABUSE", enforcement: "ENFORCED",
  direction: "OUTPUT", findingsCount: 2, now: "2026-07-30T00:00:00.000Z",
};

const cases: Array<[LegacySurface, string, string]> = [
  ["guard-core", "approval_required", "REQUIRE_APPROVAL"],
  ["sdk", "REWRITE", "TRANSFORM"],
  ["agent-firewall", "SANDBOX_ONLY", "TRANSFORM"],
  ["agent-action-ledger", "BLOCK", "BLOCK"],
  ["browser-extension", "redact", "REDACT"],
  ["vscode-extension", "warn", "WARN"],
  ["n8n-workflow", "ASK_APPROVAL", "REQUIRE_APPROVAL"],
  ["rag", "QUARANTINE", "QUARANTINE"],
  ["governance", "MONITOR_ONLY", "WARN"],
  ["semantic-egress", "REVIEW", "WARN"],
  ["escrow", "CREATE_ESCROW", "REQUIRE_APPROVAL"],
  ["dry-run", "SAFE_TO_EXECUTE", "ALLOW"],
];

test("highest-value legacy surfaces map and round-trip through the canonical contract", () => {
  for (const [surface, source, expected] of cases) {
    const envelope = adaptLegacyDecision(surface, source, context);
    assert.equal(envelope.decision, expected, `${surface}:${source}`);
    assert.equal(envelope.severity, context.severity);
    assert.equal(envelope.confidence, context.confidence);
    assert.equal(envelope.threshold, context.threshold);
    assert.equal(envelope.policyVersion, context.policyVersion);
    assert.deepEqual(envelope.identity, context.identity);
    assert.deepEqual(envelope.destination, context.destination);
    assert.equal(envelope.traceId, context.traceId);
    assert.equal(envelope.enforcement, "ENFORCED");
    assert.equal(restoreLegacyDecision(envelope, surface), source);
  }
});

test("unknown legacy decisions abstain and never silently allow", () => {
  const envelope = adaptLegacyDecision("sdk", "NEW_UNRECOGNIZED_VERB", context);
  assert.equal(adapterSupports("sdk", "NEW_UNRECOGNIZED_VERB"), false);
  assert.equal(envelope.decision, "ABSTAIN");
  assert.equal(restoreLegacyDecision(envelope), "NEW_UNRECOGNIZED_VERB");
});

test("adapter evidence is bounded and privacy-safe by construction", () => {
  const envelope = adaptLegacyDecision("guard-core", "block", {
    ...context, reason: "x".repeat(10_000), confidence: 7, riskScore: 900,
  });
  assert.equal(envelope.reason.length, 300);
  assert.equal(envelope.confidence, 1);
  assert.equal(envelope.riskScore, 100);
  assert.equal(JSON.stringify(envelope).includes("rawContent"), false);
});

test("round-trip rejects a mismatched surface", () => {
  const envelope = adaptLegacyDecision("sdk", "BLOCK", context);
  assert.throws(() => restoreLegacyDecision(envelope, "guard-core"), /belongs to sdk/);
});
