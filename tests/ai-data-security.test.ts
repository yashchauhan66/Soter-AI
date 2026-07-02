import assert from "node:assert/strict";
import test from "node:test";
import { createPrivacySafeFingerprint, matchFingerprintText, redactedPreview } from "../lib/ai-data-security/fingerprint";

const confidential = `
  Customer export for Project Saffron.
  Acme Corp, priya@example.com, renewal value INR 42 lakh.
  Roadmap item: launch private beta for regulated banking workflow.
`;

test("Company fingerprint vault stores hashes without raw text", () => {
  const fingerprint = createPrivacySafeFingerprint(confidential);
  const serialized = JSON.stringify(fingerprint);
  assert.equal(fingerprint.rawTextStored, false);
  assert.ok(fingerprint.chunkHashes.length > 0);
  assert.ok(fingerprint.shingleHashes.length > 0);
  assert.equal(serialized.includes("priya@example.com"), false);
  assert.equal(serialized.includes("Project Saffron"), false);
});

test("Company fingerprint exact match is detected as critical", () => {
  const fingerprint = createPrivacySafeFingerprint(confidential);
  const matches = matchFingerprintText(confidential, [{
    fingerprintSetId: "set_1",
    documentName: "Customer export",
    category: "customer_list",
    sensitivity: "critical",
    action: "block",
    chunkHashes: fingerprint.chunkHashes,
    shingleHashes: fingerprint.shingleHashes,
  }]);
  assert.equal(matches[0]?.matchType, "exact");
  assert.equal(matches[0]?.confidence, "critical");
  assert.equal(matches[0]?.recommendedAction, "block");
});

test("Company fingerprint fuzzy match detects similar content", () => {
  const fingerprint = createPrivacySafeFingerprint(confidential);
  const paraphrased = "Customer export for Project Saffron includes Acme Corp renewal value INR 42 lakh and regulated banking workflow notes.";
  const matches = matchFingerprintText(paraphrased, [{
    fingerprintSetId: "set_1",
    documentName: "Customer export",
    category: "customer_list",
    sensitivity: "high",
    action: "require_approval",
    chunkHashes: fingerprint.chunkHashes,
    shingleHashes: fingerprint.shingleHashes,
  }], 0.01);
  assert.equal(matches[0]?.matchType, "fuzzy");
  assert.ok(matches[0]!.similarityScore > 0);
});

test("Unrelated text does not trigger a critical fingerprint match", () => {
  const fingerprint = createPrivacySafeFingerprint(confidential);
  const matches = matchFingerprintText("Public lunch menu and office holiday calendar.", [{
    fingerprintSetId: "set_1",
    documentName: "Customer export",
    category: "customer_list",
    sensitivity: "critical",
    action: "block",
    chunkHashes: fingerprint.chunkHashes,
    shingleHashes: fingerprint.shingleHashes,
  }]);
  assert.equal(matches.length, 0);
});

test("Fingerprint match previews redact raw sensitive values", () => {
  const preview = redactedPreview("api_key = sk-test-secret-value priya@example.com");
  assert.equal(preview.includes("sk-test-secret-value"), false);
  assert.equal(preview.includes("priya@example.com"), false);
});
