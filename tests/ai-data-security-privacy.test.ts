import test from "node:test";
import assert from "node:assert/strict";
import { redactedPreview, createPrivacySafeFingerprint } from "../lib/ai-data-security/fingerprint";
import { toCsv } from "../lib/ai-data-security/csv";

const API_KEY = "sk-live-ABCDEF1234567890abcdef";
const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const GH_TOKEN = "ghp_" + "a".repeat(36);
const PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";

test("redacted preview removes API keys and secrets", () => {
  const preview = redactedPreview(`api_key = ${API_KEY} and password=SuperSecret123`);
  assert.equal(preview.includes(API_KEY), false);
  assert.equal(preview.includes("SuperSecret123"), false);
});

test("redacted preview removes emails, AWS keys, and GitHub tokens", () => {
  const preview = redactedPreview(`contact priya@example.com key ${AWS_KEY} token ${GH_TOKEN}`);
  assert.equal(preview.includes("priya@example.com"), false);
  assert.equal(preview.includes(AWS_KEY), false);
  assert.equal(preview.includes(GH_TOKEN), false);
});

test("private key material never appears verbatim in a fingerprint record", () => {
  const fp = createPrivacySafeFingerprint(PRIVATE_KEY);
  const serialized = JSON.stringify(fp);
  assert.equal(serialized.includes("MIIEpAIBAAKCAQEA"), false);
  assert.equal(serialized.includes("BEGIN RSA PRIVATE KEY"), false);
  assert.equal(fp.rawTextStored, false);
});

test("fingerprint stores hashes only — no shingle exceeds hash format", () => {
  const fp = createPrivacySafeFingerprint("the quick brown fox jumps over the lazy dog repeatedly today");
  for (const hash of [...fp.chunkHashes, ...fp.shingleHashes]) assert.match(hash, /^[a-f0-9]{64}$/);
});

test("CSV export is injection-safe (formula prefixes neutralised)", () => {
  const csv = toCsv(["name"], [["=cmd|' /C calc'!A0"], ["+SUM(1)"], ["-2+3"], ["@evil"], ["safe value"]]);
  const lines = csv.split("\r\n");
  assert.match(lines[1], /^"'=cmd/);
  assert.match(lines[2], /^"'\+SUM/);
  assert.match(lines[3], /^"'-2\+3/);
  assert.match(lines[4], /^"'@evil/);
  assert.equal(lines[5], '"safe value"');
});

test("CSV export escapes embedded quotes and preserves data", () => {
  const csv = toCsv(["preview"], [['he said "hi"']]);
  assert.match(csv.split("\r\n")[1], /"he said ""hi"""/);
});

test("semantic fingerprinting is advertised as planned, not implemented", () => {
  const fp = createPrivacySafeFingerprint("sample text for algorithm metadata check here now");
  assert.equal(fp.algorithms.semantic, "planned:not-enabled");
});
