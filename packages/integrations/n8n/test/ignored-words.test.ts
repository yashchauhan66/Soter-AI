import assert from "node:assert/strict";
import test from "node:test";

import { cleanInputGuard, run } from "./helpers";

/**
 * "Ignored Words or Phrases" (v3) lets an author keep exact strings — a company
 * name that looks like a surname, an internal order id, a product codename —
 * that redaction would otherwise remove. It is the literal-string companion to
 * Ignored Identifiers, and it lives under the same non-negotiable rule: a line
 * that carries a credential is refused, never kept, so the feature can never be
 * turned into a way to leave a live secret in the clear.
 *
 * The local engine masks the phrases before redaction and restores them after,
 * so on a local result the values genuinely survive. The cloud engine redacts
 * server-side with no parameter for literal phrases, so the node cannot protect
 * them there and says so rather than implying a protection that did not run.
 */

const MIXED = "Reach Acme Corp at ceo@acme.com. Deploy key AKIAIOSFODNN7EXAMPLE now.";

test("v3 local redactor keeps a listed phrase that would otherwise be redacted", async () => {
  const { safe } = await run({
    action: "piiRedactor",
    layout: "v3",
    params: {
      piiText: "Contact ceo@acme.com for access.",
      options: { detectionEngine: "LOCAL", ignoredWords: "ceo@acme.com" },
    },
    credentials: null,
  });

  const result = safe[0].json;
  // The email would normally become [REDACTED_EMAIL]; the ignore list keeps it.
  assert.match(String(result.safeText), /ceo@acme\.com/);
  assert.doesNotMatch(String(result.safeText), /\[REDACTED_EMAIL\]/);
  const report = result.ignoredWords as Record<string, unknown>;
  assert.deepEqual(report.words, ["ceo@acme.com"]);
  assert.equal(report.effect, "APPLIED");
});

test("v3 local redactor REFUSES a line carrying a credential and still redacts the secret", async () => {
  const { safe } = await run({
    action: "piiRedactor",
    layout: "v3",
    params: {
      piiText: MIXED,
      options: { detectionEngine: "LOCAL", ignoredWords: "Acme Corp\nceo@acme.com\nAKIAIOSFODNN7EXAMPLE" },
    },
    credentials: null,
  });

  const result = safe[0].json;
  const safeText = String(result.safeText);
  // The two benign phrases survive; the AWS key does not, however it was listed.
  assert.match(safeText, /Acme Corp/);
  assert.match(safeText, /ceo@acme\.com/);
  assert.match(safeText, /\[REDACTED_AWS_KEY\]/);
  assert.doesNotMatch(safeText, /AKIAIOSFODNN7EXAMPLE/);

  const report = result.ignoredWords as Record<string, unknown>;
  assert.deepEqual(report.words, ["Acme Corp", "ceo@acme.com"]);
  assert.deepEqual(report.refused, ["AKIAIOSFODNN7EXAMPLE"]);
  assert.equal(report.effect, "APPLIED");
  assert.match(String(report.detail), /never left in the clear/);
});

test("v3 local guard keeps a listed phrase in its redacted copy too", async () => {
  const { safe, flagged } = await run({
    action: "inputGuard",
    layout: "v3",
    params: {
      inputText: "my email ceo@acme.com is fine to keep",
      onThreat: "REDACT",
      options: { detectionEngine: "LOCAL", ignoredWords: "ceo@acme.com" },
    },
    credentials: null,
  });

  const result = (safe[0] ?? flagged[0]).json;
  const report = result.ignoredWords as Record<string, unknown>;
  assert.equal(report.effect, "APPLIED");
  // Wherever the guard exposes the cleaned text, the phrase must be intact.
  const text = String(result.safeText ?? result.redactedText ?? "");
  if (text) assert.match(text, /ceo@acme\.com/);
});

test("v3 cloud mode reports LOCAL_ONLY — it does not claim to have kept the words", async () => {
  const { safe } = await run({
    action: "piiRedactor",
    layout: "v3",
    params: {
      piiText: "Contact ceo@acme.com",
      options: { detectionEngine: "CLOUD", ignoredWords: "ceo@acme.com" },
    },
    // Server returns a redacted copy; the node cannot un-redact a literal phrase.
    respond: () => ({ body: { ...cleanInputGuard, safeText: "Contact [REDACTED_EMAIL]" } }),
  });

  const report = safe[0].json.ignoredWords as Record<string, unknown>;
  assert.equal(report.effect, "LOCAL_ONLY");
  assert.deepEqual(report.words, ["ceo@acme.com"]);
  assert.match(String(report.detail), /Local/);
});

test("v2 does not read ignoredWords — the field is version 3 only", async () => {
  // A v2 node handed an ignoredWords value must ignore it entirely: the email is
  // redacted as usual and no ignoredWords report appears. This is the guarantee
  // that a v3-only feature cannot change how an existing v2 workflow behaves.
  const { safe } = await run({
    action: "piiRedactor",
    typeVersion: 2,
    params: {
      piiText: "Contact ceo@acme.com",
      detectionEngine: "LOCAL",
      ignoredWords: "ceo@acme.com",
    },
    credentials: null,
  });

  const result = safe[0].json;
  assert.equal(result.ignoredWords, undefined, "v2 read a v3-only field it should ignore");
  assert.match(String(result.safeText), /\[REDACTED_EMAIL\]/);
  assert.doesNotMatch(String(result.safeText), /ceo@acme\.com/);
});

test("an empty Ignored Words list produces no report", async () => {
  const { safe } = await run({
    action: "piiRedactor",
    layout: "v3",
    params: { piiText: "Contact ceo@acme.com", options: { detectionEngine: "LOCAL", ignoredWords: "" } },
    credentials: null,
  });
  assert.equal(safe[0].json.ignoredWords, undefined);
});
