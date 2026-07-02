import test from "node:test";
import assert from "node:assert/strict";
import { extractTextFromFile, extensionForFile, isSupportedFile, isMetadataOnlyFile } from "../../apps/extension/src/lib/file-extractors";
import { applyFilePolicy } from "../../apps/extension/src/lib/file-scan-policy";
import type { ScanResult } from "../../apps/extension/src/lib/types";

function file(name: string, content: string | Uint8Array, type = "text/plain"): File {
  return new File([content], name, { type });
}

function result(types: string[], action: ScanResult["action"] = "allow"): ScanResult {
  return {
    hasFindings: types.length > 0, riskScore: types.length ? 80 : 0, detectedDataTypes: types, findings: [], action,
    policy: { action, severity: "low", matchedRules: [], userMessage: "", adminMessage: "", redactedText: "", rewrittenSafeText: "", auditMetadata: {} },
    redactedText: "", rewrittenSafeText: "", scannedAt: new Date(0).toISOString(),
  };
}

test("supported text/code extensions are recognised", () => {
  for (const ext of [".env", ".csv", ".sql", ".log", ".js", ".ts", ".py", ".sh"]) {
    assert.equal(isSupportedFile(file(`x${ext}`, "content")), true, ext);
  }
});

test("PDF/DOCX/XLSX/PPTX remain metadata-only (no fake parsing)", async () => {
  for (const ext of [".pdf", ".docx", ".xlsx", ".pptx"]) {
    assert.equal(isMetadataOnlyFile(file(`x${ext}`, "binary")), true, ext);
    const extracted = await extractTextFromFile(file(`x${ext}`, "binary"));
    assert.equal(extracted.supported, false);
    assert.equal(extracted.text, "");
    assert.equal(extracted.reason, "metadata_only_parser_not_available");
  }
});

test(".env file content is read locally", async () => {
  const extracted = await extractTextFromFile(file(".env", "API_KEY=sk-test-1234567890abcdef\nDB_URL=postgres://u:p@h/db"));
  assert.equal(extracted.supported, true);
  assert.match(extracted.text, /API_KEY/);
});

test("binary content in a text extension is flagged, not decoded as text", async () => {
  const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0x03]);
  const extracted = await extractTextFromFile(file("evil.txt", bytes));
  assert.equal(extracted.encryptedOrBinary, true);
  assert.equal(extracted.supported, false);
});

test("large file truncates safely to the scan cap", async () => {
  const big = "a".repeat(2 * 1024 * 1024); // 2MB
  const extracted = await extractTextFromFile(file("big.txt", big), 1024 * 1024);
  assert.ok(extracted.scannedBytes <= 1024 * 1024);
  assert.ok(extracted.text.length <= 1024 * 1024);
});

test("policy: .env is always blocked regardless of detected types", () => {
  assert.equal(applyFilePolicy(result([]), ".env", false), "block");
});

test("policy: secrets in supported code file are blocked", () => {
  assert.equal(applyFilePolicy(result(["api_key"]), ".js", false), "block");
  assert.equal(applyFilePolicy(result(["private_key"]), ".txt", false), "block");
  assert.equal(applyFilePolicy(result(["database_url"]), ".sql", false), "block");
});

test("policy: customer data export requires approval", () => {
  assert.equal(applyFilePolicy(result(["customer_data"]), ".csv", false), "require_approval");
});

test("policy: clean supported text file is allowed", () => {
  assert.equal(applyFilePolicy(result([]), ".txt", false), "allow");
});

test("policy: unsupported/binary file with no stronger policy warns", () => {
  assert.equal(applyFilePolicy(result([]), ".bin", true), "warn");
});

test("extensionForfile lowercases and extracts the final extension", () => {
  assert.equal(extensionForFile(file("Report.FINAL.CSV", "x")), ".csv");
});
