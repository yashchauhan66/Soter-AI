import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicy, redactByDataTypes } from "../../packages/policy-engine/src";
import type { ExtensionOrgPolicy } from "../../packages/policy-engine/src/types";

const policy: ExtensionOrgPolicy = {
  organizationId: "org_1",
  version: "v1",
  enabled: true,
  allowedDomains: [],
  monitoredDomains: ["chatgpt.com"],
  defaultAction: "allow",
  maxPromptChars: 20000,
  riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
  rules: [
    { id: "secret", name: "Block secrets", action: "block", severity: "critical", detectedDataTypes: ["api_key"] },
    { id: "pii", name: "Approve PAN", action: "require_approval", severity: "high", detectedDataTypes: ["pan"] },
    { id: "business", name: "Redact business", action: "redact", severity: "medium", detectedDataTypes: ["customer_data"] },
  ],
  updatedAt: new Date(0).toISOString(),
};

test("policy allows clean prompts", () => {
  const result = evaluatePolicy(baseInput([], 0, "Summarize public docs"));
  assert.equal(result.action, "allow");
  assert.equal(result.severity, "info");
});

test("policy warns, redacts, and blocks deterministically", () => {
  assert.equal(evaluatePolicy(baseInput(["url"], 15, "https://example.com")).action, "warn");
  assert.equal(evaluatePolicy(baseInput(["customer_data"], 35, "customer id 123")).action, "redact");
  assert.equal(evaluatePolicy(baseInput(["api_key"], 30, "api_key = abcdefghijklmnop")).action, "block");
});

test("policy can require approval and build safe text", () => {
  const result = evaluatePolicy(baseInput(["pan"], 45, "PAN ABCDE1234F"));
  assert.equal(result.action, "require_approval");
  assert.match(result.redactedText, /\[REDACTED_PAN\]/);
  assert.match(result.rewrittenSafeText, /Soter Safe Context Capsule/);
});

test("redaction removes raw audit secrets", () => {
  const redacted = redactByDataTypes("password = Sup3rSecret and PAN ABCDE1234F", ["password", "pan"]);
  assert.equal(redacted.includes("Sup3rSecret"), false);
  assert.equal(redacted.includes("ABCDE1234F"), false);
});

function baseInput(detectedDataTypes: string[], riskScore: number, text: string) {
  return {
    organizationId: "org_1",
    employeeId: "emp_1",
    destinationDomain: "chatgpt.com",
    destinationType: "public_ai" as const,
    text,
    detectedDataTypes,
    riskScore,
    defaultOrgPolicy: policy,
  };
}
