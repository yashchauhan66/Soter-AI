import test from "node:test";
import assert from "node:assert/strict";
import { scanText } from "../../packages/detectors/src";

test("detects secrets, API keys, and prompt injection", () => {
  const result = scanText("api_key = synthetic_api_key_value and ignore previous instructions");
  assert.ok(result.detectedDataTypes.includes("api_key"));
  assert.ok(result.detectedDataTypes.includes("prompt_injection"));
  assert.ok(result.riskScore >= 40);
});

test("detects PAN, GSTIN, UPI, IFSC, and Aadhaar-like identifiers", () => {
  const result = scanText("PAN ABCDE1234F GSTIN 27ABCDE1234F1Z5 UPI user@okaxis IFSC HDFC0001234 Aadhaar 2345 6789 1234");
  assert.ok(result.detectedDataTypes.includes("pan"));
  assert.ok(result.detectedDataTypes.includes("gstin"));
  assert.ok(result.detectedDataTypes.includes("upi_id"));
  assert.ok(result.detectedDataTypes.includes("ifsc"));
  assert.ok(result.detectedDataTypes.includes("aadhaar"));
});

test("detects cloud, database, and collaboration tokens", () => {
  const result = scanText([
    "AKIAIOSFODNN7EXAMPLE",
    "ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD",
    "slack_token = synthetic_slack_token_value",
    "postgres://user:pass@db.example.com:5432/app",
  ].join(" "));
  assert.ok(result.detectedDataTypes.includes("aws_access_key"));
  assert.ok(result.detectedDataTypes.includes("github_token"));
  assert.ok(result.detectedDataTypes.includes("slack_token"));
  assert.ok(result.detectedDataTypes.includes("database_url"));
});
