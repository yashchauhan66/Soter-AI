/**
 * The sanitize footer must not be spliced into a pasted fragment.
 *
 * `rewriteSafePrompt` appends "🛡️ Soter sanitized this prompt before sending. …" to the sanitized
 * text. That sentence is true and useful when the *whole* composer is being replaced — the submit
 * path's "Use safe prompt" — because it explains the placeholders to the model. The paste path
 * reuses the same string for one fragment dropped into the middle of a prompt the user is still
 * writing, and there it was neither true nor harmless: pasting a customer record mid-sentence
 * inserted the footer into the middle of the sentence, and that text then went to the model as
 * part of the question.
 *
 * The fix keeps the scrubbing (internal URLs, repo references, amounts, IPs, paths) and drops only
 * the sentence about it, because the overlay already tells the user what happened. These tests are
 * behavioral, not source-level: they call the real functions the paste path calls.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SAFE_REWRITE_NOTE_MARKER,
  redactByDataTypes,
  rewriteSafePrompt,
  stripSafeRewriteNote,
} from "../../packages/policy-engine/src/evaluatePolicy";
import { safeFragmentText } from "../../apps/extension/src/lib/rewrite";

const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";

/** What the paste path actually receives: a scan result for one pasted fragment. */
function scanned(text: string, detectedDataTypes: string[]) {
  const redactedText = redactByDataTypes(text, detectedDataTypes);
  return { redactedText, rewrittenSafeText: rewriteSafePrompt(redactedText, detectedDataTypes, "block") };
}

test("SF-800: the whole-prompt path still explains itself to the model", () => {
  const { rewrittenSafeText } = scanned(`deploy key is ${AWS_KEY}`, ["api_key"]);
  assert.ok(rewrittenSafeText.includes("Soter sanitized this prompt before sending"),
    "the submit path's safe prompt keeps the footer — it is what explains the placeholders");
  assert.ok(rewrittenSafeText.includes("[REDACTED_AWS_KEY]"));
  assert.equal(rewrittenSafeText.includes(AWS_KEY), false);
});

test("SF-801: a pasted fragment carries the scrubbing but not the footer", () => {
  const result = scanned(`deploy key is ${AWS_KEY}`, ["api_key"]);
  const fragment = safeFragmentText(result);
  assert.equal(fragment.includes("Soter sanitized this prompt before sending"), false,
    "the footer would be spliced into the middle of the user's sentence and sent to the model");
  assert.equal(fragment.includes(SAFE_REWRITE_NOTE_MARKER), false, "no dangling separator either");
  assert.equal(fragment.includes(AWS_KEY), false, "dropping the footer must not drop the redaction");
  assert.ok(fragment.includes("[REDACTED_AWS_KEY]"));
  assert.ok(fragment.startsWith("deploy key is"), "the user's own words survive intact");
});

test("SF-802: the fragment keeps the rewrite's scrubbing, not just the regex redaction", () => {
  // `rewriteSafePrompt` removes things `redactByDataTypes` does not — an internal URL in code, for
  // one. Falling back to `redactedText` for the fragment would silently lose that.
  const result = scanned("see https://billing.internal/admin for the fix", ["source_code"]);
  const fragment = safeFragmentText(result);
  assert.ok(fragment.includes("[INTERNAL_URL_REMOVED]"),
    "the fragment must be the rewritten text minus the footer, not the merely-redacted text");
  assert.equal(fragment.includes("billing.internal"), false);
  assert.equal(fragment.includes("Soter sanitized"), false);
});

test("SF-803: stripSafeRewriteNote is a no-op on text that has no footer", () => {
  assert.equal(stripSafeRewriteNote("just a prompt"), "just a prompt");
  assert.equal(stripSafeRewriteNote(""), "");
  // A low-severity action never gets a footer, so the fragment is the text itself.
  const redacted = redactByDataTypes("nothing sensitive here", []);
  assert.equal(safeFragmentText({ redactedText: redacted, rewrittenSafeText: rewriteSafePrompt(redacted, [], "warn") }),
    "nothing sensitive here");
});

test("SF-804: a footer the user themselves pasted is not mistaken for ours", () => {
  // `lastIndexOf`, so only the trailing footer is removed — a user quoting an earlier sanitized
  // prompt keeps their quote.
  const quoted = `earlier: ${SAFE_REWRITE_NOTE_MARKER} Soter sanitized this prompt before sending. X.`;
  const result = scanned(`${quoted} and my key is ${AWS_KEY}`, ["api_key"]);
  const fragment = safeFragmentText(result);
  assert.ok(fragment.startsWith("earlier:"), "the user's quoted text is theirs to keep");
  assert.equal(fragment.split("Soter sanitized this prompt before sending").length - 1, 1,
    "exactly one footer should remain — the user's quote — with ours removed from the end");
  assert.ok(fragment.endsWith("[REDACTED_AWS_KEY]"),
    "the strip must cut only our trailing footer, leaving the user's own words after their quote");
  assert.equal(fragment.includes(AWS_KEY), false);
});

test("SF-805: the paste path is the caller, and it does not reach past the helper", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/content/paste-listener.ts"),
    "utf8",
  );
  assert.ok(source.includes("safeFragmentText(result)"),
    "the paste path must go through the helper that strips the footer");
  assert.equal(/result\.rewrittenSafeText\s*\|\|\s*result\.redactedText/.test(source), false,
    "that expression is the bug: it inserts the footer into the middle of the user's prompt");
});

test("SF-806: the whole-prompt callers deliberately keep the footer", () => {
  const submit = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/content/submit-interceptor.ts"),
    "utf8",
  );
  // v0.2.2 states the why this assertion asked for. The submit path does now import
  // `safeFragmentText`, but only to *compare*: `interruptionLevel` must know whether the sanitized
  // text differs from what the user actually wrote, and `rewrittenSafeText` always differs because
  // of the footer — so comparing against it would call every redact-level verdict an alteration and
  // put the full-screen modal back on ordinary work. What the submit path *writes* is unchanged:
  // the field replacement and the clipboard copy still carry the footer, which is what these two
  // assertions pin down.
  const writesStrippedText = /(?:setText|writeText)\(\s*safeFragmentText/.test(submit);
  assert.equal(writesStrippedText, false,
    "the submit path replaces the entire field, so what it writes back must keep the footer — " +
    "otherwise the model loses the explanation of the placeholders");
  assert.match(submit, /target\.setText\(stripSmuggledPayload\(safeText\)\.clean\)|target\.setText\(safeText\)|setText\(\s*result\.rewrittenSafeText/,
    "the whole-field replacement must still come from rewrittenSafeText");
  assert.match(submit, /writeText\(result\.rewrittenSafeText \|\| result\.redactedText\)/,
    "'Copy safe prompt' copies the whole prompt, footer included");
});
