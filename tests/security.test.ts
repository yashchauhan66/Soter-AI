import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeCallbackUrl } from "../lib/auth/callback";
import { generateApiKey, hashApiKey } from "../lib/apiKeyCrypto";
import { PUBLIC_BADGE_STATUS_FIELDS } from "../lib/badge";
import { analyzeText } from "../lib/guard/analyze";
import { prepareSafeLogContent, sanitizeMetadata } from "../lib/guard/logSafety";
import { toPublicGuardResult } from "../lib/guard/publicResult";
import { checkMemoryRateLimit, resetRateLimitBucketsForTests } from "../lib/rateLimit";
import { inputGuardSchema } from "../lib/validations";

process.env.API_KEY_PEPPER = "test-only-pepper-that-is-longer-than-thirty-two-characters";

test("sign-in callback URL is limited to safe relative paths", () => {
  assert.equal(safeCallbackUrl("/dashboard/reports"), "/dashboard/reports");
  assert.equal(safeCallbackUrl("https://evil.example/phish"), "/dashboard");
  assert.equal(safeCallbackUrl("//evil.example/phish"), "/dashboard");
  assert.equal(safeCallbackUrl("/\\evil.example/phish"), "/dashboard");
  assert.equal(safeCallbackUrl("/%5Cevil.example/phish"), "/dashboard");
  assert.equal(safeCallbackUrl("javascript:alert(1)"), "/dashboard");
});

test("auth middleware stays on edge-safe configuration only", () => {
  const middlewareSource = readFileSync("middleware.ts", "utf8");
  const authConfigSource = readFileSync("auth.config.ts", "utf8");
  const authSource = readFileSync("auth.ts", "utf8");

  assert.match(middlewareSource, /\.\/auth\.config/);
  assert.doesNotMatch(middlewareSource, /from "\.\/auth"/);
  assert.doesNotMatch(middlewareSource, /Credentials|bcrypt|@prisma\/client|\.\/lib\/db/);
  assert.match(authConfigSource, /providers:\s*\[\]/);
  assert.doesNotMatch(authConfigSource, /^import .*Credentials|^import .*bcrypt|^import .*\.\/lib\/db/m);
  assert.match(authSource, /Credentials\(/);
  assert.match(authSource, /bcrypt/);
});

test("public badge script avoids HTML injection sinks", () => {
  const badgeRoute = readFileSync("app/badge.js/route.ts", "utf8");
  assert.equal(badgeRoute.includes("innerHTML"), false);
  assert.match(badgeRoute, /safeColor/);
  assert.match(badgeRoute, /textContent|createTextNode/);
});

test("public badge status payload is allowlisted and omits private project data", () => {
  const allowed = new Set(PUBLIC_BADGE_STATUS_FIELDS);
  for (const privateField of [
    "id",
    "projectId",
    "organizationId",
    "userId",
    "name",
    "projectName",
    "agencyName",
    "email",
    "apiKey",
    "secret",
    "originalText",
    "redactedText",
    "safeText",
  ]) {
    assert.equal(allowed.has(privateField as (typeof PUBLIC_BADGE_STATUS_FIELDS)[number]), false, privateField);
  }

  const badgeSource = readFileSync("lib/badge.ts", "utf8");
  const scriptSource = readFileSync("app/badge.js/route.ts", "utf8");
  assert.match(badgeSource, /PUBLIC_BADGE_STATUS_FIELDS/);
  assert.match(badgeSource, /select:\s*{[\s\S]*id: true,[\s\S]*badgeEnabled: true/);
  assert.doesNotMatch(badgeSource, /include:\s*{/);
  assert.doesNotMatch(badgeSource, /projectName\s*:|agencyName\s*:|user:\s*true|organizationId|userId|apiKey\s*:|secret\s*:/i);
  assert.doesNotMatch(scriptSource, /projectName|agencyName|organizationId|userId|apiKey|secret|originalText|redactedText|safeText/i);
});

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
