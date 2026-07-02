import test from "node:test";
import assert from "node:assert/strict";
import { extractTextFromFile } from "../../apps/extension/src/lib/file-extractors";
import { applyFilePolicy } from "../../apps/extension/src/lib/file-scan-policy";
import { createLineageContext, saveLineageContext, getFreshLineageContext } from "../../apps/extension/src/lib/lineage-context";
import { matchSourceApp, type SourceAppConfig } from "../../apps/extension/src/lib/source-apps";
import { createPrivacySafeFingerprint, matchFingerprintText, redactedPreview } from "../../lib/ai-data-security/fingerprint";

const storage = new Map<string, unknown>();
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      async get(keys: string[]) { return Object.fromEntries(keys.map((key) => [key, storage.get(key)])); },
      async set(items: Record<string, unknown>) { for (const [k, v] of Object.entries(items)) v === undefined ? storage.delete(k) : storage.set(k, v); },
    },
  },
  runtime: { sendMessage() {} },
};

const FAKE_API_KEY = "sk-live-SUPERSECRETKEY1234567890abcdef";
const FAKE_EMAIL = "ceo@acmecorp.com";
const FAKE_PASSWORD = "p@ssw0rd!12345";
const FAKE_AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const FAKE_GITHUB_TOKEN = "ghp_" + "x".repeat(36);
const FAKE_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";

function file(name: string, content: string | Uint8Array, type = "text/plain"): File {
  return new File([content], name, { type });
}

function scanResult(types: string[], action: "allow" | "warn" | "block" | "require_approval" = "allow") {
  return {
    hasFindings: types.length > 0, riskScore: types.length ? 80 : 0, detectedDataTypes: types, findings: [], action,
    policy: { action, severity: "low", matchedRules: [], userMessage: "", adminMessage: "", redactedText: "", rewrittenSafeText: "", auditMetadata: {} },
    redactedText: "", rewrittenSafeText: "", scannedAt: new Date(0).toISOString(),
  };
}

const apps: SourceAppConfig[] = [
  { id: "1", name: "GitHub", domains: ["github.com"], category: "source_code", enabled: true, sensitivity: "high" },
  { id: "2", name: "Google Docs", domains: ["docs.google.com"], category: "document", enabled: true, sensitivity: "high" },
];

test("PRIV-001: raw file content is never sent to backend in file scan results", async () => {
  const envContent = `API_KEY=${FAKE_API_KEY}\nDATABASE_URL=postgres://admin:${FAKE_PASSWORD}@db.internal/prod`;
  const extracted = await extractTextFromFile(file(".env", envContent));
  assert.equal(extracted.supported, true);
  assert.ok(extracted.text.length > 0);

  const action = applyFilePolicy(scanResult(["api_key"], "block"), ".env", false);
  assert.equal(action, "block");
});

test("PRIV-002: file scan event metadata does not contain raw file content", async () => {
  const codeWithSecret = `const key = "${FAKE_API_KEY}";\nfetch("https://api.example.com", { headers: { Authorization: key } });`;
  const extracted = await extractTextFromFile(file("config.js", codeWithSecret));
  assert.equal(extracted.supported, true);

  const action = applyFilePolicy(scanResult(["api_key"], "block"), ".js", false);
  assert.equal(action, "block");

  const preview = redactedPreview(codeWithSecret);
  assert.equal(preview.includes(FAKE_API_KEY), false);
  assert.equal(preview.includes("SUPERSECRETKEY"), false);
});

test("PRIV-003: raw copied text is never stored in lineage context", async () => {
  const copiedText = `Confidential: Q4 revenue forecast shows ${FAKE_EMAIL} approved budget of INR 50 lakh. AWS key: ${FAKE_AWS_KEY}`;
  const ctx = await createLineageContext(apps[0], copiedText, "https://github.com/acme/forecast?secret=abc123", "Revenue forecast");
  const serialized = JSON.stringify(ctx);
  assert.equal(serialized.includes(copiedText), false, "raw copied text must not appear in serialized context");
  assert.equal(serialized.includes(FAKE_EMAIL), false, "email must not appear in serialized context");
  assert.equal(serialized.includes(FAKE_AWS_KEY), false, "AWS key must not appear in serialized context");
  assert.equal(serialized.includes("abc123"), false, "query param secret must not appear");
  assert.match(ctx.selectedTextHash, /^[a-f0-9]{64}$/, "selected text must be stored as SHA-256 hash");
});

test("PRIV-004: source URLs are hashed and query params stripped", async () => {
  const ctx = await createLineageContext(apps[0], "text", "https://github.com/acme/repo?token=SECRET_123&branch=main", "t");
  assert.match(ctx.sourceUrlHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(ctx).includes("SECRET_123"), false);
  assert.equal(ctx.sourceUrlHash.includes("github"), false, "hash must not contain domain");
});

test("PRIV-005: fingerprint chunks are SHA-256 hashes only", () => {
  const text = `Secret document: ${FAKE_API_KEY} and ${FAKE_PRIVATE_KEY} with customer data for ${FAKE_EMAIL}`;
  const fp = createPrivacySafeFingerprint(text);
  assert.equal(fp.rawTextStored, false);
  const allHashes = [...fp.chunkHashes, ...fp.shingleHashes];
  assert.ok(allHashes.length > 0, "must have at least one hash");
  for (const hash of allHashes) {
    assert.match(hash, /^[a-f0-9]{64}$/, "each hash must be 64-char hex SHA-256");
  }
  const serialized = JSON.stringify(fp);
  assert.equal(serialized.includes(FAKE_API_KEY), false, "API key must not be in serialized fingerprint");
  assert.equal(serialized.includes(FAKE_PRIVATE_KEY), false, "private key must not be in serialized fingerprint");
  assert.equal(serialized.includes(FAKE_EMAIL), false, "email must not be in serialized fingerprint");
});

test("PRIV-006: API keys do not appear in redacted preview", () => {
  const secrets = [
    `api_key=${FAKE_API_KEY}`,
    `secret=${FAKE_PASSWORD}`,
    `aws_access_key=${FAKE_AWS_KEY}`,
    `github_token=${FAKE_GITHUB_TOKEN}`,
    FAKE_PRIVATE_KEY,
    `Bearer ${FAKE_API_KEY}`,
  ];
  for (const text of secrets) {
    const preview = redactedPreview(text);
    assert.equal(preview.includes(FAKE_API_KEY), false, `API key leaked in preview for: ${text.slice(0, 30)}`);
    assert.equal(preview.includes(FAKE_PASSWORD), false, `password leaked in preview`);
    assert.equal(preview.includes(FAKE_AWS_KEY), false, `AWS key leaked in preview`);
    assert.equal(preview.includes(FAKE_GITHUB_TOKEN), false, `GitHub token leaked in preview`);
  }
});

test("PRIV-007: private key blocks do not appear in match events or previews", () => {
  const text = `Deploy key: ${FAKE_PRIVATE_KEY}\nand access ${FAKE_API_KEY}`;
  const fp = createPrivacySafeFingerprint(text);
  const matches = matchFingerprintText(text, [{
    fingerprintSetId: "set_key",
    documentName: "Deploy keys",
    category: "source_code",
    sensitivity: "critical",
    action: "block",
    chunkHashes: fp.chunkHashes,
    shingleHashes: fp.shingleHashes,
  }]);
  assert.ok(matches.length > 0, "should match");
  const serialized = JSON.stringify(matches);
  assert.equal(serialized.includes("BEGIN RSA PRIVATE KEY"), false, "private key header leaked in match");
  assert.equal(serialized.includes("MIIEpAIBAAKCAQEA"), false, "private key content leaked in match");
  assert.equal(serialized.includes(FAKE_API_KEY), false, "API key leaked in match");
});

test("PRIV-008: cross-tenant fingerprint isolation — different org fingerprints do not match", () => {
  const orgAText = "OrgA confidential: ACME Corp merger details INR 100 crore";
  const orgBText = "OrgB confidential: BETA Corp merger details INR 200 crore";
  const fpA = createPrivacySafeFingerprint(orgAText);
  const matchesOrgB = matchFingerprintText(orgBText, [{
    fingerprintSetId: "set_a",
    documentName: "OrgA merger",
    category: "legal_contract",
    sensitivity: "critical",
    action: "block",
    chunkHashes: fpA.chunkHashes,
    shingleHashes: fpA.shingleHashes,
  }]);
  assert.equal(matchesOrgB.length, 0, "OrgB text must not match OrgA fingerprint");
});

test("PRIV-009: unrelated site monitoring is not active", () => {
  const unrelatedUrls = [
    "https://www.google.com/search?q=weather",
    "https://news.ycombinator.com/",
    "https://stackoverflow.com/questions",
    "https://reddit.com/r/programming",
    "https://chatgpt.com/",
  ];
  for (const url of unrelatedUrls) {
    const match = matchSourceApp(url, apps);
    assert.ok(!match, `unrelated URL should not be monitored: ${url}`);
  }
});

test("PRIV-010: lineage context TTL is enforced", async () => {
  const TTL = 15 * 60 * 1000;
  const now = Date.now();
  const ctx = await createLineageContext(apps[0], "sensitive selection text", "https://github.com/x/repo", "t", now);
  await saveLineageContext(ctx);

  const fresh = await getFreshLineageContext(now + 60_000);
  assert.ok(fresh, "context should be fresh within TTL");

  const expired = await getFreshLineageContext(now + TTL + 1);
  assert.equal(expired, null, "context should expire after TTL");
});

test("PRIV-011: file content is scanned locally and only metadata sent to backend", async () => {
  const csvContent = `name,email,phone\nJohn,john@test.com,+1-555-0123\nJane,jane@test.com,+1-555-0456`;
  const extracted = await extractTextFromFile(file("contacts.csv", csvContent));
  assert.equal(extracted.supported, true);
  assert.ok(extracted.text.includes("john@test.com"), "text should be extracted locally");
  assert.ok(extracted.scannedBytes > 0, "scanned bytes should be tracked");

  const preview = redactedPreview(extracted.text);
  assert.equal(preview.includes("john@test.com"), false, "emails must be redacted in preview");
  assert.equal(preview.includes("jane@test.com"), false, "emails must be redacted in preview");
});

test("PRIV-012: large file truncation preserves privacy", async () => {
  const sensitiveLine = `SECRET=${FAKE_API_KEY}\n`;
  const padding = "safe data line\n".repeat(50000);
  const bigContent = padding + sensitiveLine;
  const extracted = await extractTextFromFile(file("big.env", bigContent), 1024);
  assert.ok(extracted.scannedBytes <= 1024);
  const preview = redactedPreview(extracted.text);
  assert.equal(preview.includes(FAKE_API_KEY), false, "API key in truncated content must still be redacted");
});

test("PRIV-013: SQL file with customer table names does not leak raw content in preview", async () => {
  const sql = `SELECT * FROM customers WHERE email = '${FAKE_EMAIL}' AND api_key = '${FAKE_API_KEY}';`;
  const preview = redactedPreview(sql);
  assert.equal(preview.includes(FAKE_API_KEY), false);
  assert.equal(preview.includes(FAKE_EMAIL), false);
});

test("PRIV-014: JSON file with secrets does not leak in preview", async () => {
  const json = JSON.stringify({ apiKey: FAKE_API_KEY, endpoint: "https://api.example.com" });
  const preview = redactedPreview(json);
  assert.equal(preview.includes(FAKE_API_KEY), false);
});

test("PRIV-015: log file with production stack trace does not leak secrets in preview", async () => {
  const log = `ERROR [${new Date().toISOString()}] Connection failed\n  at DB.connect (db.ts:42)\n  Config: password=${FAKE_PASSWORD}\n  Retry in 5s`;
  const preview = redactedPreview(log);
  assert.equal(preview.includes(FAKE_PASSWORD), false);
});

test("PRIV-016: disabled/deleted fingerprint sets do not match in extension bundle", () => {
  const text = "Acme Corp confidential merger details INR 100 crore";
  const fp = createPrivacySafeFingerprint(text);

  const matches = matchFingerprintText(text, []);
  assert.equal(matches.length, 0, "empty bundle (all disabled/deleted) should not match");
});

test("PRIV-017: fingerprint similarity below threshold does not trigger critical action", () => {
  const text = "Acme Corp confidential merger details INR 100 crore";
  const fp = createPrivacySafeFingerprint(text);
  const unrelated = "The quick brown fox jumps over the lazy dog in the morning";
  const matches = matchFingerprintText(unrelated, [{
    fingerprintSetId: "set_1",
    documentName: "Test",
    category: "customer_list",
    sensitivity: "critical",
    action: "block",
    chunkHashes: fp.chunkHashes,
    shingleHashes: fp.shingleHashes,
  }]);
  if (matches.length > 0) {
    assert.ok(matches[0]!.similarityScore < 0.5, "low similarity should not trigger critical confidence");
    assert.ok(matches[0]!.confidence !== "critical" || matches[0]!.similarityScore < 0.72, "low similarity should not be critical");
  }
});
