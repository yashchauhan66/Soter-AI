import test from "node:test";
import assert from "node:assert/strict";
import { createPrivacySafeFingerprint, matchFingerprintText, type FingerprintRecord } from "../lib/ai-data-security/fingerprint";

const confidential = `
  Customer export for Project Saffron.
  Acme Corp, priya@example.com, renewal value INR 42 lakh.
  Roadmap item: launch private beta for regulated banking workflow.
`;

function recordFrom(text: string, over: Partial<FingerprintRecord> = {}): FingerprintRecord {
  const fp = createPrivacySafeFingerprint(text);
  return {
    fingerprintSetId: "set_1", documentName: "Customer export", category: "customer_list",
    sensitivity: "critical", action: "block", chunkHashes: fp.chunkHashes, shingleHashes: fp.shingleHashes, ...over,
  };
}

test("exact match triggers critical/block", () => {
  const matches = matchFingerprintText(confidential, [recordFrom(confidential)]);
  assert.equal(matches[0]?.matchType, "exact");
  assert.equal(matches[0]?.recommendedAction, "block");
  assert.equal(matches[0]?.confidence, "critical");
});

test("fuzzy match triggers on paraphrased content", () => {
  const paraphrased = "Customer export for Project Saffron includes Acme Corp renewal value INR 42 lakh and regulated banking workflow notes.";
  const matches = matchFingerprintText(paraphrased, [recordFrom(confidential, { sensitivity: "high", action: "require_approval" })], 0.01);
  assert.equal(matches[0]?.matchType, "fuzzy");
  assert.ok(matches[0]!.similarityScore > 0);
});

test("low similarity does not escalate to critical", () => {
  const matches = matchFingerprintText("Acme Corp renewal notes only mention regulated workflow briefly.", [recordFrom(confidential)], 0.01);
  for (const m of matches) {
    if (m.matchType === "fuzzy") assert.notEqual(m.confidence, "critical");
  }
});

test("unrelated text produces no match", () => {
  const matches = matchFingerprintText("Public lunch menu and office holiday calendar.", [recordFrom(confidential)]);
  assert.equal(matches.length, 0);
});

test("disabled/deleted set does not match (empty bundle behaviour)", () => {
  // The server excludes disabled/deleted sets from loadFingerprintRecords, so the bundle is empty.
  assert.equal(matchFingerprintText(confidential, []).length, 0);
});

test("fingerprint records store only hashes — no raw text leaks", () => {
  const record = recordFrom(confidential);
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes("priya@example.com"), false);
  assert.equal(serialized.includes("Project Saffron"), false);
  assert.equal(serialized.includes("Acme Corp"), false);
  for (const hash of [...record.chunkHashes, ...record.shingleHashes]) assert.match(hash, /^[a-f0-9]{64}$/);
});

test("match evidence asserts raw text is not stored", () => {
  const matches = matchFingerprintText(confidential, [recordFrom(confidential)]);
  assert.equal(matches[0]?.evidence.rawTextStored, false);
});

test("tenant isolation: a different org's fingerprints do not match this org's text", () => {
  const otherOrg = recordFrom("Completely different confidential doc about widget supply chain logistics in Berlin warehouse.");
  assert.equal(matchFingerprintText(confidential, [otherOrg]).length, 0);
});
