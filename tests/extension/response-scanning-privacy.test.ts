import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanPrompt } from "../../apps/extension/src/lib/scanner";
import { auditSafePreview } from "../../apps/extension/src/lib/redaction";
import { defaultState } from "../../apps/extension/src/lib/storage";
import { BUILT_IN_AI_DESTINATIONS } from "../../packages/shared/src/ai-destinations";
import type { ExtensionState } from "../../apps/extension/src/lib/types";

// ── RSP-001: Response scanning disabled creates no response audit event ────
test("RSP-001: service worker skips audit for clean response scans", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/background/service-worker.ts"),
    "utf8",
  );
  // The service worker must only audit response scans when findings exist
  assert.match(
    source,
    /if \(!isResponseScan \|\\| result\.hasFindings\) void api\.audit/,
    "Response scans without findings should skip audit",
  );
  assert.match(
    source,
    /if \(!isResponseScan \|\\| result\.hasFindings\) void api\.scan/,
    "Response scans without findings should skip backend scan",
  );
});

// ── RSP-002: Response scanning enabled creates redacted metadata only ──────
test("RSP-002: clean response scan produces no findings and allow action", () => {
  const state = { ...defaultState, enrollmentStatus: "enrolled" as const };
  const result = scanPrompt(
    "The capital of France is Paris. It is the largest city in the country.",
    "https://chatgpt.com/",
    state,
    "response",
  );
  assert.equal(result.hasFindings, false, "Clean response should have no findings");
  assert.equal(result.action, "allow", "Clean response should be allowed");
  assert.equal(result.detectedDataTypes.length, 0, "No data types detected in clean response");
});

// ── RSP-003: Unrelated pages are not scanned ───────────────────────────────
test("RSP-003: response observer checks enabled flag before scanning", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/content/response-observer.ts"),
    "utf8",
  );
  assert.match(
    source,
    /if \(!enabled\) return/,
    "Response observer must check enabled flag before scanning",
  );
});

// ── RSP-004: Full response text is not stored by default ───────────────────
test("RSP-004: redacted preview truncates long text and redacts known patterns", () => {
  // Use a format that matches the redaction regex (label := value)
  const preview = auditSafePreview(
    "password=Sup3rSecret123 and my PAN is ABCDE1234F",
    ["password", "pan"],
    30,
  );
  assert.equal(preview.includes("Sup3rSecret123"), false, "Raw password must not appear in preview");
  assert.equal(preview.includes("ABCDE1234F"), false, "Raw PAN must not appear in preview");
  // Clean response content is represented by a marker, never a truncated raw prefix.
  const longPreview = auditSafePreview("A".repeat(1000), [], 50);
  assert.equal(longPreview, "[CLEAN_PROMPT_NOT_STORED]");
});

// ── RSP-005: Response with sensitive data is detected and redacted ──────────
test("RSP-005: response containing secrets produces findings and redaction", () => {
  const state = { ...defaultState, enrollmentStatus: "enrolled" as const };
  const result = scanPrompt(
    "Here is your generated code: AKIAIOSFODNN7EXAMPLE is the AWS key you requested.",
    "https://chatgpt.com/",
    state,
    "response",
  );
  assert.equal(result.hasFindings, true, "Response with AWS key should have findings");
  assert.ok(result.detectedDataTypes.includes("aws_access_key"), "Should detect aws_access_key");
  assert.equal(result.action !== "allow", true, "Should not allow without action");
  assert.equal(
    result.redactedText.includes("AKIAIOSFODNN7EXAMPLE"),
    false,
    "Raw AWS key must be redacted",
  );
});

// ── RSP-006: Response scanning on specific destination only ─────────────────
test("RSP-006: response scanning respects destination configuration", () => {
  // Verify that the response observer is only installed when enabled for a destination
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/content/response-observer.ts"),
    "utf8",
  );
  // The install function takes an `enabled` parameter
  assert.match(
    source,
    /function installResponseObserver/,
    "installResponseObserver must exist",
  );
  assert.match(
    source,
    /adapter: AiSiteAdapter, enabled: boolean/,
    "installResponseObserver must accept enabled parameter",
  );
});

// ── RSP-007: AI destination responseScanningEnabled flag controls behavior ──
test("RSP-007: AI destinations define responseScanningEnabled field", () => {
  for (const dest of BUILT_IN_AI_DESTINATIONS) {
    assert.equal(
      typeof dest.responseScanningEnabled,
      "boolean",
      `Destination ${dest.destinationId} must define responseScanningEnabled`,
    );
    assert.equal(
      typeof dest.loggingMode,
      "string",
      `Destination ${dest.destinationId} must define loggingMode`,
    );
  }
});

// ── RSP-008: Response scan audit event contains only redacted preview ───────
test("RSP-008: service worker response scan audit uses redactedPreview not raw text", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/background/service-worker.ts"),
    "utf8",
  );
  // The audit event must route through the central privacy preview helper.
  assert.match(
    source,
    /redactedPreview:\s*previewForScan\(result,/,
    "Audit event must use the central privacy-safe preview helper",
  );
  assert.doesNotMatch(
    source,
    /originalText.*audit|audit.*originalText/,
    "Audit event must not include originalText",
  );
});

// ── RSP-009: Privacy policy documents response scanning controls ────────────
test("RSP-009: privacy policy explains response scanning scope and controls", () => {
  const privacyDoc = readFileSync(
    resolve(import.meta.dirname, "../../docs/extension-store/privacy-policy.md"),
    "utf8",
  );
  assert.match(
    privacyDoc,
    /response scan/i,
    "Privacy policy must mention response scanning",
  );
  assert.match(
    privacyDoc,
    /admin.*enable.*disable|enable.*disable.*admin|admin.*disable.*per.*destination/i,
    "Privacy policy must explain admin can enable/disable response scanning",
  );
  assert.match(
    privacyDoc,
    /metadata.*redact|redact.*metadata/i,
    "Privacy policy must explain metadata and redacted previews are stored by default",
  );
  assert.match(
    privacyDoc,
    /unrelated|not.*monitor|not.*scan/i,
    "Privacy policy must explain unrelated browsing is not monitored",
  );
});

// ── RSP-010: Permission justification documents response scanning ───────────
test("RSP-010: permission justification documents response scanning controls", () => {
  const permissionDoc = readFileSync(
    resolve(import.meta.dirname, "../../docs/extension-store/permission-justification.md"),
    "utf8",
  );
  assert.match(
    permissionDoc,
    /response scan/i,
    "Permission justification must document response scanning",
  );
  assert.match(
    permissionDoc,
    /admin.*disable|disable.*per.*destination/i,
    "Permission justification must explain admin control over response scanning",
  );
  assert.match(
    permissionDoc,
    /not.*monitor|unrelated/i,
    "Permission justification must state unrelated browsing is not monitored",
  );
});
