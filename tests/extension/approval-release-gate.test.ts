/**
 * SS-7 — the ordering control, proved against the decision kernel.
 *
 * The pre-SS-7 interceptor asked `approvedPrompts.has(text)` *before* it scanned. That single
 * ordering choice meant an approval obtained once kept releasing the same text for the lifetime
 * of the tab: across a policy change, across an emergency lockdown, and across a tampered
 * policy bundle arriving — because none of those states were ever consulted again.
 *
 * The fix is two-part, and only the second part is a bound: always scan first, then ask the
 * kernel whether a grant is even *allowed* to release the decision that scan produced.
 * `canApprovalRelease` is that gate, and these tests pin it against real `scanPrompt` output
 * rather than hand-built objects, so a change in what the policy engine emits cannot quietly
 * turn a blocked state into a releasable one.
 *
 * The bounds on the grant itself (one-time, expiring, destination-bound) are in
 * `approval-ledger.test.ts`. A grant that the kernel refuses is never even looked up, which is
 * why the interceptor's `&&` order is asserted here too.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canApprovalRelease,
  isFailClosedBlock,
  scanPrompt,
  shouldPreventSubmit,
  withHardEnforcement,
} from "../../apps/extension/src/lib/scanner";
import { defaultState } from "../../apps/extension/src/lib/storage";
import type { ExtensionState, PolicyIntegrityRecord, ScanResult } from "../../apps/extension/src/lib/types";

const DESTINATION = "https://chatgpt.com/";
const BENIGN = "please summarise the quarterly planning notes";
/** Synthetic, non-live AWS example key — the value AWS publishes for documentation. */
const RAW_SECRET = "here is our key AKIAIOSFODNN7EXAMPLE please debug";

const INTERCEPTOR_SOURCE = "apps/extension/src/content/submit-interceptor.ts";

const enrolled: ExtensionState = { ...defaultState, enrollmentStatus: "enrolled" };

function stateWith(overrides: Partial<ExtensionState> = {}): ExtensionState {
  return {
    ...enrolled,
    policySyncStatus: "fresh",
    ...overrides,
    config: { ...enrolled.config, ...(overrides.config ?? {}) },
  };
}

function integrity(code: PolicyIntegrityRecord["code"], verified = false): PolicyIntegrityRecord {
  return { verified, code, checkedAt: new Date(0).toISOString() };
}

/**
 * Source with comments stripped. The interceptor documents the shape it replaced by name, so a
 * grep for the old pattern matches the explanation of why it is gone; the invariant is about
 * what the file *executes*.
 */
function codeOnly(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Re-labels a real scan result's action, keeping everything else the engine produced. */
function withAction(result: ScanResult, action: ScanResult["action"]): ScanResult {
  return { ...result, action, policy: { ...result.policy, action } };
}

/* ── No untrusted state may be released by a grant ────────────────────────── */

test("AG-701: no fail-closed state can be released by a previously granted approval", () => {
  const states: Array<[string, ExtensionState]> = [
    ["tampered bundle", stateWith({ policyIntegrity: integrity("signature_mismatch") })],
    ["replayed bundle", stateWith({ policyIntegrity: integrity("rollback") })],
    ["other tenant's bundle", stateWith({ policyIntegrity: integrity("organization_mismatch") })],
    ["signature required, none present", stateWith({
      policyIntegrity: integrity("unsigned"),
      config: { ...enrolled.config, requirePolicySignature: true },
    })],
    ["offline fail-closed", stateWith({
      policySyncStatus: "error",
      config: { ...enrolled.config, offlineFailClosed: true },
    })],
  ];
  for (const [label, state] of states) {
    const result = scanPrompt(RAW_SECRET, DESTINATION, state, "submit");
    assert.equal(isFailClosedBlock(result), true, `${label}: expected a fail-closed block`);
    assert.equal(canApprovalRelease(result), false, `${label}: an approval must not release an untrusted state`);
  }
});

test("AG-702: an ordinary content block is not releasable either", () => {
  const result = scanPrompt(RAW_SECRET, DESTINATION, stateWith({ policyIntegrity: integrity("ok", true) }), "submit");
  assert.equal(result.action, "block");
  assert.equal(isFailClosedBlock(result), false, "this must be a content block, not a fail-closed one");
  assert.equal(canApprovalRelease(result), false, "block is block — an approval is not an override");
});

test("AG-703: hard enforcement and emergency lockdown are unreleasable because they land on block", () => {
  const trusted = stateWith({ policyIntegrity: integrity("ok", true) });
  const blocked = scanPrompt(RAW_SECRET, DESTINATION, trusted, "submit");
  const locked = withHardEnforcement(blocked, true);
  assert.equal(locked.policy.matchedRules.some((rule) => rule.id === "hard-enforcement-block"), true);
  assert.equal(canApprovalRelease(locked), false);
  // Every action the kernel treats as a block is covered by the same single check, so a new
  // block-producing feature cannot arrive with a releasable hole.
  assert.equal(canApprovalRelease(withAction(blocked, "block")), false);
});

/* ── The decision the user was actually approved for still releases ───────── */

test("AG-710: the approval-gated decisions are exactly the ones a grant releases", () => {
  const trusted = stateWith({ policyIntegrity: integrity("ok", true) });
  const found = scanPrompt(RAW_SECRET, DESTINATION, trusted, "submit");
  assert.equal(found.hasFindings, true, "fixture must have produced findings");

  for (const action of ["require_approval", "require_justification"] as const) {
    const result = withAction(found, action);
    assert.equal(shouldPreventSubmit(action), true, `${action} must be an intercepted action`);
    assert.equal(canApprovalRelease(result), true, `${action} is the decision the user obtained authority for`);
  }
});

test("AG-711: a clean prompt with nothing to release is not a grant-spending path", () => {
  const trusted = stateWith({ policyIntegrity: integrity("ok", true) });
  const clean = scanPrompt(BENIGN, DESTINATION, trusted, "submit");
  assert.equal(clean.hasFindings, false, "fixture must be clean");
  assert.equal(shouldPreventSubmit(clean.action), false, "a clean prompt is not intercepted");
  assert.equal(canApprovalRelease(clean), false, "nothing was withheld, so nothing needs releasing");
});

test("AG-712: a warn-class decision with findings is releasable, without findings is not", () => {
  const trusted = stateWith({ policyIntegrity: integrity("ok", true) });
  const found = scanPrompt(RAW_SECRET, DESTINATION, trusted, "submit");
  const warned = withAction(found, "warn");
  assert.equal(canApprovalRelease(warned), true, "the user was warned about real findings and accepted");
  assert.equal(canApprovalRelease({ ...warned, hasFindings: false, findings: [] }), false);
});

/* ── The ordering itself, asserted on the shipped interceptor ─────────────── */

test("AG-720: the interceptor scans before it consults the ledger", () => {
  const source = codeOnly(INTERCEPTOR_SOURCE);
  const scanAt = source.indexOf("evaluateSubmitInterception");
  const consumeAt = source.indexOf("approvals.consume");
  assert.ok(scanAt > 0, "the interceptor must run a scan");
  assert.ok(consumeAt > 0, "the interceptor must consult the ledger");
  assert.ok(scanAt < consumeAt, "a grant may only be looked up against a decision that already exists");

  // The pre-SS-7 shape: a membership test on raw text, before anything was scanned.
  assert.equal(/approvedPrompts/.test(source), false, "the permanent approved-text set must be gone");
  assert.equal(/\.has\(\s*text\s*\)/.test(source), false, "no pre-scan membership short-circuit may remain");
});

test("AG-721: the kernel gate is consulted, and short-circuits before the grant is spent", () => {
  const source = codeOnly(INTERCEPTOR_SOURCE);
  assert.match(source, /canApprovalRelease\(/, "the interceptor must ask the kernel, not decide for itself");
  // `&&` ordering matters: a decision the kernel refuses must not consume the user's grant,
  // or one blocked submission silently burns an approval the user still needs.
  assert.match(
    source,
    /canApprovalRelease\([^)]*\)\s*&&\s*\(await approvals\.consume\(/,
    "the kernel check must guard the ledger lookup in the same expression",
  );
});

test("AG-722: a fail-closed decision purges outstanding grants rather than parking them", () => {
  const source = codeOnly(INTERCEPTOR_SOURCE);
  assert.match(
    source,
    /isFailClosedBlock\([^)]*\)\)\s*approvals\.purge\(\)/,
    "losing trust in the policy must invalidate grants issued under the old one",
  );
});

test("AG-723: replacing text with a redacted rewrite does not mint a grant", () => {
  // Redacted text re-scans clean, so it needs no grant; minting one would create a live
  // release token for a string the user can still edit back into a secret before sending.
  const source = codeOnly(INTERCEPTOR_SOURCE);
  const onReplace = source.slice(source.indexOf("onReplace"), source.indexOf("onApproved"));
  assert.ok(onReplace.length > 0, "expected an onReplace handler in the interceptor");
  assert.equal(/approvals\.grant/.test(onReplace), false, "the replace path must not issue a release grant");
});
