import assert from "node:assert/strict";
import test from "node:test";
import { generateApiKey, hashApiKey } from "../lib/apiKeyCrypto";
import { analyzeText } from "../lib/guard/analyze";
import { prepareSafeLogContent, sanitizeMetadata } from "../lib/guard/logSafety";
import { toPublicGuardResult } from "../lib/guard/publicResult";
import { checkMemoryRateLimit, resetRateLimitBucketsForTests } from "../lib/rateLimit";
import { inputGuardSchema } from "../lib/validations";

process.env.API_KEY_PEPPER = "test-only-pepper-that-is-longer-than-thirty-two-characters";

test("API keys are random, prefixed, and hashed with the configured pepper", () => {
  const first = generateApiKey("test");
  const second = generateApiKey("test");
  assert.match(first.rawKey, /^ck_test_[A-Za-z0-9_-]{20,}$/);
  assert.notEqual(first.rawKey, second.rawKey);
  assert.notEqual(first.keyHash, first.rawKey);
  assert.equal(first.keyHash, hashApiKey(first.rawKey));
});

test("public guard results never echo original text", () => {
  const secret = "sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz123456";
  const publicResult = toPublicGuardResult(analyzeText(secret, "INPUT"));
  assert.equal("originalText" in publicResult, false);
  assert.equal(JSON.stringify(publicResult).includes(secret), false);
});

test("secret-bearing logs and metadata retain only redacted values", () => {
  const secret = "sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz123456";
  const result = analyzeText(`Credential ${secret}`, "INPUT");
  const prepared = prepareSafeLogContent(result, { note: `Credential ${secret}`, apiKey: secret });
  const serialized = JSON.stringify(prepared);
  assert.equal(prepared.originalText, null);
  assert.equal(serialized.includes(secret), false);
  assert.match(serialized, /REDACTED_SECRET/);
  assert.equal("apiKey" in (prepared.metadata.request as Record<string, unknown>), false);
});

test("system prompt leakage is never persisted verbatim", () => {
  const leaked = "System prompt: confidential internal rules";
  const prepared = prepareSafeLogContent(analyzeText(leaked, "OUTPUT"));
  assert.equal(prepared.originalText, null);
  assert.equal(prepared.redactedText, "[REDACTED_SYSTEM_INSTRUCTIONS]");
  assert.equal(JSON.stringify(prepared).includes(leaked), false);
});

test("system prompt leakage remains fully withheld even when another value is redacted", () => {
  const leaked = "System prompt: use secret sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz123456";
  const prepared = prepareSafeLogContent(analyzeText(leaked, "OUTPUT"));
  assert.equal(prepared.redactedText, "[REDACTED_SYSTEM_INSTRUCTIONS]");
  assert.equal(JSON.stringify(prepared).includes("System prompt"), false);
});

test("metadata sanitizer redacts personal data and drops suspicious keys", () => {
  const sanitized = sanitizeMetadata({
    email: "priya@example.com",
    authorization: "Bearer secret",
    count: 2,
  });
  assert.equal(sanitized.email, "[REDACTED_EMAIL]");
  assert.equal("authorization" in sanitized, false);
  assert.equal(sanitized.count, 2);
});

test("metadata validation rejects nested and oversized metadata", () => {
  assert.equal(inputGuardSchema.safeParse({ message: "hello", metadata: { nested: { secret: "value" } } }).success, false);
  const tooMany = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`field${index}`, index]));
  assert.equal(inputGuardSchema.safeParse({ message: "hello", metadata: tooMany }).success, false);
});

test("rate limiter blocks after the configured request count", () => {
  resetRateLimitBucketsForTests();
  assert.equal(checkMemoryRateLimit("test-key", 2).allowed, true);
  assert.equal(checkMemoryRateLimit("test-key", 2).allowed, true);
  const blocked = checkMemoryRateLimit("test-key", 2);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});
