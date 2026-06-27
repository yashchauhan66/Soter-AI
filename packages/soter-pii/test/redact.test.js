const assert = require("node:assert/strict");
const test = require("node:test");

const { redactPII } = require("../dist/index.js");

test("redacts email and phone values", () => {
  const result = redactPII("Email priya@example.com or call +1 (555) 123-4567.");

  assert.equal(result.hasPII, true);
  assert.deepEqual(result.detectedTypes, ["Email", "Phone"]);
  assert.equal(result.redactedText, "Email [REDACTED_EMAIL] or call [REDACTED_PHONE].");
});

test("redacts India PAN and Aadhaar values", () => {
  const result = redactPII("PAN ABCDE1234F and Aadhaar 1234 5678 9012");

  assert.equal(result.hasPII, true);
  assert.ok(result.detectedTypes.includes("PAN Card"));
  assert.ok(result.detectedTypes.includes("Aadhaar Card"));
  assert.doesNotMatch(result.redactedText, /ABCDE1234F|1234 5678 9012/);
});

test("leaves ordinary text unchanged", () => {
  const input = "The support team is available during business hours.";
  const result = redactPII(input);

  assert.equal(result.hasPII, false);
  assert.deepEqual(result.detectedTypes, []);
  assert.equal(result.redactedText, input);
});

test("global regular expressions do not leak state between calls", () => {
  const first = redactPII("First: one@example.com");
  const second = redactPII("Second: two@example.com");

  assert.equal(first.redactedText, "First: [REDACTED_EMAIL]");
  assert.equal(second.redactedText, "Second: [REDACTED_EMAIL]");
});
