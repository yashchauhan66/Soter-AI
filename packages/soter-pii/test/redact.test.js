"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  redactPII,
  redactDeep,
  containsPII,
  luhnCheck,
  verhoeffCheck,
  isReDoSSafe,
} = require("../dist/index.js");

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

test("redacts email and phone values", () => {
  const result = redactPII("Email priya@example.com or call +1 (555) 123-4567.");
  assert.equal(result.hasPII, true);
  assert.deepEqual(result.detectedTypes.sort(), ["Email", "Phone"]);
  assert.equal(
    result.redactedText,
    "Email [REDACTED_EMAIL] or call [REDACTED_PHONE]."
  );
  assert.equal(result.matchCount, 2);
  assert.equal(result.counts.Email, 1);
  assert.equal(result.counts.Phone, 1);
});

test("redacts India PAN and Aadhaar values", () => {
  // Aadhaar must pass the Verhoeff checksum. 234167891234 is a known-valid sample.
  const result = redactPII("PAN ABCDE1234F and Aadhaar 234167891234");
  assert.equal(result.hasPII, true);
  assert.ok(result.detectedTypes.includes("PAN Card"));
  assert.ok(result.detectedTypes.includes("Aadhaar Card"));
  assert.doesNotMatch(result.redactedText, /ABCDE1234F|234167891234/);
});

test("rejects invalid Aadhaar (Verhoeff mismatch)", () => {
  const result = redactPII("Aadhaar 1234 5678 9012");
  assert.equal(result.detectedTypes.includes("Aadhaar Card"), false);
});

test("leaves ordinary text unchanged", () => {
  const input = "The support team is available during business hours.";
  const result = redactPII(input);
  assert.equal(result.hasPII, false);
  assert.deepEqual(result.detectedTypes, []);
  assert.equal(result.redactedText, input);
  assert.equal(result.matchCount, 0);
});

test("global regular expressions do not leak state between calls", () => {
  const first = redactPII("First: one@example.com");
  const second = redactPII("Second: two@example.com");
  assert.equal(first.redactedText, "First: [REDACTED_EMAIL]");
  assert.equal(second.redactedText, "Second: [REDACTED_EMAIL]");
});

// ---------------------------------------------------------------------------
// Precision hooks (the Presidio / Comprehend differentiators)
// ---------------------------------------------------------------------------

test("redacts only Luhn-valid card numbers", () => {
  const valid = redactPII("Pay with 4111111111111111 and not with 1234567890123456.");
  assert.equal(valid.hasPII, true);
  assert.match(valid.redactedText, /REDACTED_CARD/);
  assert.ok(valid.redactedText.includes("1234567890123456")); // Luhn fails -> untouched
});

test("rejects random 13-digit runs as cards", () => {
  const result = redactPII("Order id 9999888877776666 and 4 0000000000.");
  // All-same-digit candidate and Luhn failures must not be redacted as Card.
  assert.doesNotMatch(result.redactedText, /\[REDACTED_CARD\]/);
});

test("validates US SSN structurally", () => {
  const valid = redactPII("SSN 123-45-6789");
  assert.ok(valid.detectedTypes.includes("US SSN"));
  const invalid = redactPII("SSN 000-45-6789 and 666-45-6789 and 900-45-6789");
  assert.equal(invalid.detectedTypes.includes("US SSN"), false);
});

test("redacts modern secrets", () => {
  const cases = [
    ["OpenAI key sk-abcdefghijklmnopqrstuvwxyz1234567890abcd", "OpenAI API Key"],
    ["ghp_abcdefghijklmnopqrstuvwxyz0123456789", "GitHub PAT"],
    ["AKIAIOSFODNN7EXAMPLE", "AWS Access Key"],
    ["xoxb-1234-5678-abcdef", "Slack Token"],
    ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", "JWT"],
    ["-----BEGIN OPENSSH PRIVATE KEY-----", "Private Key"],
  ];
  for (const [input, label] of cases) {
    const r = redactPII(input);
    assert.ok(r.detectedTypes.includes(label), `expected ${label} for: ${input}`);
  }
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

test("include/exclude options restrict detection", () => {
  const onlyEmail = redactPII("a@b.com and 4111111111111111", { include: ["Email"] });
  assert.deepEqual(onlyEmail.detectedTypes, ["Email"]);

  const noEmail = redactPII("a@b.com and 4111111111111111", { exclude: ["Email"] });
  assert.equal(noEmail.detectedTypes.includes("Email"), false);
  assert.equal(noEmail.detectedTypes.includes("Credit Card"), true);
});

test("allowlist overrides detection", () => {
  const result = redactPII("Contact support@yourcompany.com or jdoe@example.com", {
    allowlist: ["support@yourcompany.com"],
  });
  assert.ok(result.redactedText.includes("support@yourcompany.com"));
  assert.ok(result.redactedText.includes("[REDACTED_EMAIL]"));
  assert.equal(result.counts.Email, 1);
});

test("masked mode hides entity length", () => {
  const result = redactPII("bob@example.com", { mode: "masked" });
  assert.equal(result.redactedText, "***************");
  assert.equal(result.counts.Email, 1);
});

test("custom rules work; unsafe custom patterns are rejected", () => {
  const r = redactPII("Ticket CONF-123456", {
    customRules: [{ label: "Ticket", pattern: /\bCONF-\d{6}\b/gi }],
  });
  assert.ok(r.detectedTypes.includes("Ticket"));

  assert.equal(isReDoSSafe(/(a+)+$/), false);
  assert.equal(isReDoSSafe(/(a|ab)+$/), false);
  assert.equal(isReDoSSafe(/\b\w+@\w+\.com\b/), true);

  assert.throws(() =>
    redactPII("x", { customRules: [{ label: "Bad", pattern: /(a+)+$/, replacement: "!" }] })
  );
});

// ---------------------------------------------------------------------------
// Helper APIs
// ---------------------------------------------------------------------------

test("containsPII returns boolean only", () => {
  assert.equal(containsPII("clean text"), false);
  assert.equal(containsPII("call 123-45-6789"), true);
});

test("redactDeep walks nested objects and arrays", () => {
  const out = redactDeep({
    user: { email: "a@b.com", notes: [{ phone: "+1 (555) 123-4567" }] },
    keep: 42,
  });
  assert.equal(out.user.email, "[REDACTED_EMAIL]");
  assert.equal(out.user.notes[0].phone, "[REDACTED_PHONE]");
  assert.equal(out.keep, 42);
});

test("checksum helpers", () => {
  assert.equal(luhnCheck("4111111111111111"), true);
  assert.equal(luhnCheck("4111111111111112"), false);
  assert.equal(verhoeffCheck("234167891234"), true);
  assert.equal(verhoeffCheck("234167891237"), false);
});

test("result is deterministic across identical calls", () => {
  const input = "Email a@b.com, card 4111 1111 1111 1111, SSN 123-45-6789.";
  const a = redactPII(input);
  const b = redactPII(input);
  assert.deepEqual(a, b);
});
