import assert from "node:assert/strict";
import test from "node:test";
import { rejectDisallowedRawContent, sanitizeExtensionPreview } from "../../lib/extension/privacyGuard";
import { redactedWebhookPayload } from "../../lib/siem/webhooks";
import { createPrivacySafePreview } from "../../packages/shared/src/privacy";

test("backend rejects every disallowed raw content field", () => {
  for (const field of ["rawText", "prompt", "fullPrompt", "fileContent", "copiedText", "matchedText", "rawContent"]) {
    assert.throws(() => rejectDisallowedRawContent({ organizationId: "org", nested: { [field]: "confidential" } }), /not accepted/);
  }
});

test("backend sanitizes previews again and clean preview is metadata-only", () => {
  const secret = "synthetic_api_key_value";
  const sanitized = sanitizeExtensionPreview(`API_KEY=${secret}`, "prompt", ["api_key"]);
  assert.equal(sanitized?.includes(secret), false);
  assert.match(sanitized ?? "", /REDACTED_API_KEY|REDACTED_ENV_VAR/);
  assert.equal(sanitizeExtensionPreview("How do I implement error handling in React?", "prompt"), "[CLEAN_PROMPT_NOT_STORED]");
});

test("SIEM webhook strips raw fields and sanitizes fake secrets", () => {
  const secret = "synthetic_api_key_value";
  const payload = redactedWebhookPayload({ id: "event", organizationId: "org", projectId: null, eventType: "PROMPT_BLOCKED", severity: "HIGH", riskTypes: ["api_key"], action: "BLOCK", source: "browser_extension", createdAt: new Date(0), metadata: { rawText: `do not send ${secret}`, redactedPreview: `API_KEY=${secret}`, destination: "chatgpt.com" } });
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("rawText"), false);
  assert.match(serialized, /REDACTED_API_KEY|REDACTED_ENV_VAR/);
});

test("full prompt logging requires both explicit mode and allowFullText", () => {
  const clean = "Explicitly approved diagnostic prompt";
  assert.equal(createPrivacySafePreview({ rawText: clean, contextType: "prompt", logMode: "full_prompt_explicit_admin_enabled", allowFullText: false }), "[CLEAN_PROMPT_NOT_STORED]");
  assert.equal(createPrivacySafePreview({ rawText: clean, contextType: "prompt", logMode: "redacted_prompt", allowFullText: true }), "[CLEAN_PROMPT_NOT_STORED]");
  assert.equal(createPrivacySafePreview({ rawText: clean, contextType: "prompt", logMode: "full_prompt_explicit_admin_enabled", allowFullText: true }), clean);
});

test("fingerprint finding can never make unchanged confidential text eligible for preview", () => {
  const confidential = "Project Saffron confidential revenue plan";
  const preview = createPrivacySafePreview({ rawText: confidential, dataTypes: ["company_fingerprint_match"], contextType: "prompt", logMode: "redacted_prompt" });
  assert.equal(preview.includes(confidential), false);
  assert.match(preview, /Fingerprint match detected/);
});
