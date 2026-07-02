import assert from "node:assert/strict";
import test from "node:test";
import { applyFilePolicy } from "../../apps/extension/src/lib/file-scan-policy";
import type { ScanResult } from "../../apps/extension/src/lib/types";

function result(types: string[], action: ScanResult["action"] = "allow"): ScanResult {
  return {
    hasFindings: types.length > 0,
    riskScore: types.length ? 80 : 0,
    detectedDataTypes: types,
    findings: [],
    action,
    policy: {
      action,
      severity: "low",
      matchedRules: [],
      userMessage: "",
      adminMessage: "",
      redactedText: "",
      rewrittenSafeText: "",
      auditMetadata: {},
    },
    redactedText: "",
    rewrittenSafeText: "",
    scannedAt: new Date(0).toISOString(),
  };
}

test("File content scanner blocks env files", () => {
  assert.equal(applyFilePolicy(result([]), ".env", false), "block");
});

test("File content scanner blocks secrets found in supported file content", () => {
  assert.equal(applyFilePolicy(result(["api_key"]), ".js", false), "block");
});

test("File content scanner requires approval for customer exports", () => {
  assert.equal(applyFilePolicy(result(["customer_data"]), ".csv", false), "require_approval");
});

test("File content scanner allows clean supported text files", () => {
  assert.equal(applyFilePolicy(result([]), ".txt", false), "allow");
});

test("Unsupported binary file warns when no stronger policy applies", () => {
  assert.equal(applyFilePolicy(result([]), ".bin", true), "warn");
});
