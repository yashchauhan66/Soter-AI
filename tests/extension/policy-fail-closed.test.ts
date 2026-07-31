/**
 * SS-4 / SS-11 adversarial tests for the fail-closed gate in `scanPrompt`.
 *
 * SS-4: fail-closed used to be gated on `policySyncStatus === "offline"` *and* an
 * availability flag:
 *
 *     if (state.policySyncStatus === "offline" && (policy.offlineFailClosed || state.config.offlineFailClosed))
 *
 * A *detected tamper event* sets `"error"`, not `"offline"`, so a policy bundle the
 * extension had already refused to trust fell through to normal evaluation — a detected
 * attack was strictly weaker than a network outage. A positive tamper signal must now block
 * regardless of any availability flag, because it is an attack signal and not connectivity.
 *
 * SS-11 (found while writing these tests): the fail-closed result carried
 * `rewrittenSafeText: text` — the *raw* prompt. Every consumer treats that field as the safe
 * variant: the overlay renders it as "Redacted/Safe Preview", `submit-interceptor.onReplace`
 * writes it back into the page input, whitelists it and replays the submit, and
 * "Copy safe prompt" puts it on the clipboard. One click on the primary, safe-sounding
 * button therefore sent the unredacted prompt to the destination the extension had just
 * blocked. FC-41x lock that closed at the kernel, not in the UI.
 *
 * `scanPrompt` is pure — it takes state as an argument — so no `chrome` stub is needed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  FAIL_CLOSED_RULE_IDS,
  isFailClosedBlock,
  remediationAffordances,
  scanPrompt,
  shouldPreventSubmit,
} from "../../apps/extension/src/lib/scanner";
import { defaultState } from "../../apps/extension/src/lib/storage";
import type { ExtensionState, PolicyIntegrityRecord } from "../../apps/extension/src/lib/types";

const DESTINATION = "https://chatgpt.com/";
const BENIGN = "please summarise the quarterly planning notes";
/** Synthetic, non-live AWS example key — the value AWS publishes for documentation. */
const RAW_SECRET = "here is our key AKIAIOSFODNN7EXAMPLE please debug";
const SECRET_LITERAL = "AKIAIOSFODNN7EXAMPLE";

/** Positive tamper signals: the bundle was modified, replayed or issued for another tenant. */
const TAMPER_CODES: PolicyIntegrityRecord["code"][] = [
  "malformed",
  "unsupported_algorithm",
  "organization_mismatch",
  "hash_mismatch",
  "signature_mismatch",
  "rollback",
];

/** Absence-of-signing codes. Not an attack signal on their own. */
const ABSENCE_CODES: PolicyIntegrityRecord["code"][] = ["unsigned", "key_missing"];

const enrolled: ExtensionState = { ...defaultState, enrollmentStatus: "enrolled" };

function stateWith(overrides: Partial<ExtensionState> = {}): ExtensionState {
  return {
    ...enrolled,
    // The most permissive possible availability posture, so a block can only come from the
    // integrity gate and never from an offline/fail-closed flag.
    policySyncStatus: "fresh",
    ...overrides,
    config: { ...enrolled.config, ...(overrides.config ?? {}) },
  };
}

function integrity(code: PolicyIntegrityRecord["code"], verified = false): PolicyIntegrityRecord {
  return { verified, code, checkedAt: new Date(0).toISOString() };
}

function blockedByRule(result: ReturnType<typeof scanPrompt>, id: string) {
  return result.action === "block" && result.policy.matchedRules.some((rule) => rule.id === id);
}

/* ── The SS-4 gate: a tamper signal outranks availability ────────────────── */

test("FC-401: every positive tamper code blocks even when fresh and no fail-closed flag is set", () => {
  for (const code of TAMPER_CODES) {
    const state = stateWith({ policyIntegrity: integrity(code) });
    assert.equal(state.config.offlineFailClosed, undefined, code);
    assert.equal(state.policy?.offlineFailClosed ?? false, false, code);
    const result = scanPrompt(BENIGN, DESTINATION, state, "submit");
    assert.equal(result.action, "block", code);
    assert.ok(blockedByRule(result, "policy-integrity-fail-closed"), code);
    assert.ok(result.detectedDataTypes.includes("policy_tamper_block"), code);
    assert.equal(result.riskScore, 100, code);
    assert.ok(shouldPreventSubmit(result.action), code);
  }
});

test("FC-402: a tamper code blocks a benign prompt on an otherwise allowed destination", () => {
  // No content finding, an unmonitored destination, `defaultAction: "allow"` — the only
  // reason to block is that the policy itself cannot be trusted.
  const state = stateWith({ policyIntegrity: integrity("hash_mismatch") });
  const result = scanPrompt(BENIGN, "https://example.internal/notes", state, "submit");
  assert.equal(result.action, "block");
  assert.equal(result.policy.severity, "critical");
  assert.equal(result.policy.matchedRules.length, 1, "the tamper rule is the whole decision");
});

test("FC-403: `verified: true` never blocks, whatever the code says", () => {
  // Defence against an inverted check: the gate must key off `verified`, not off the
  // presence of a code string.
  for (const code of [...TAMPER_CODES, ...ABSENCE_CODES, "ok" as const]) {
    const state = stateWith({ policyIntegrity: integrity(code, true) });
    const result = scanPrompt(BENIGN, DESTINATION, state, "submit");
    assert.notEqual(result.action, "block", code);
  }
});

test("FC-404: absence of signing is not a tamper signal on its own", () => {
  // Honest boundary: `unsigned` / `key_missing` mean *no integrity information*, which is
  // the shipped default. Blocking on them would block every unconfigured deployment. An
  // org that wants them refused sets `requirePolicySignature` (FC-405).
  for (const code of ABSENCE_CODES) {
    const result = scanPrompt(BENIGN, DESTINATION, stateWith({ policyIntegrity: integrity(code) }), "submit");
    assert.notEqual(result.action, "block", code);
  }
});

test("FC-405: requirePolicySignature blocks anything that is not cryptographically verified", () => {
  const cases: Array<PolicyIntegrityRecord | undefined> = [
    undefined,
    integrity("unsigned"),
    integrity("key_missing"),
    integrity("ok"), // code says ok but `verified` is false — must still block
  ];
  for (const policyIntegrity of cases) {
    const state = stateWith({ policyIntegrity, config: { ...enrolled.config, requirePolicySignature: true } });
    const result = scanPrompt(BENIGN, DESTINATION, state, "submit");
    assert.equal(result.action, "block", policyIntegrity?.code ?? "no record");
    assert.ok(blockedByRule(result, "policy-signature-required-fail-closed"), policyIntegrity?.code ?? "no record");
    assert.ok(result.detectedDataTypes.includes("policy_unverified_block"));
  }
  // ...and a verified bundle satisfies it.
  const verified = stateWith({
    policyIntegrity: integrity("ok", true),
    config: { ...enrolled.config, requirePolicySignature: true },
  });
  assert.notEqual(scanPrompt(BENIGN, DESTINATION, verified, "submit").action, "block");
});

test("FC-406: a tamper signal is reported ahead of the signature requirement", () => {
  // Both gates fire; the tamper one is the more specific diagnostic for the administrator.
  const state = stateWith({
    policyIntegrity: integrity("signature_mismatch"),
    config: { ...enrolled.config, requirePolicySignature: true },
  });
  const result = scanPrompt(BENIGN, DESTINATION, state, "submit");
  assert.ok(blockedByRule(result, "policy-integrity-fail-closed"));
});

test("FC-407: `error` status fails closed exactly like `offline` when the flag is set", () => {
  for (const policySyncStatus of ["offline", "error"] as const) {
    const viaManaged = stateWith({ policySyncStatus, config: { ...enrolled.config, offlineFailClosed: true } });
    assert.ok(blockedByRule(scanPrompt(BENIGN, DESTINATION, viaManaged, "submit"), "offline-fail-closed"), policySyncStatus);

    const viaOrgPolicy = stateWith({ policySyncStatus, policy: { ...enrolled.policy!, offlineFailClosed: true } });
    assert.ok(blockedByRule(scanPrompt(BENIGN, DESTINATION, viaOrgPolicy, "submit"), "offline-fail-closed"), policySyncStatus);

    // Without either flag this is an availability problem, not an attack: do not block.
    const noFlag = stateWith({ policySyncStatus });
    assert.notEqual(scanPrompt(BENIGN, DESTINATION, noFlag, "submit").action, "block", policySyncStatus);
  }
});

test("FC-408: a trusted, fresh policy produces no fail-closed block and still enforces content rules", () => {
  const trusted = stateWith({ policyIntegrity: integrity("ok", true) });
  const benign = scanPrompt(BENIGN, DESTINATION, trusted, "submit");
  assert.notEqual(benign.action, "block", "no false-positive fail-closed block");
  assert.equal(isFailClosedBlock(benign), false);

  // The content rules must be unaffected by the gate above them.
  const secret = scanPrompt(RAW_SECRET, DESTINATION, trusted, "submit");
  assert.equal(secret.action, "block");
  assert.ok(secret.policy.matchedRules.some((rule) => rule.id === "local-secret-block"));
  assert.equal(isFailClosedBlock(secret), false, "a content block is not a fail-closed block");
});

/* ── SS-11: a fail-closed block must not hand the raw prompt back ─────────── */

test("FC-410: the fail-closed result never carries the raw prompt in any 'safe' field", () => {
  const state = stateWith({ policyIntegrity: integrity("hash_mismatch") });
  const result = scanPrompt(RAW_SECRET, DESTINATION, state, "submit");
  assert.equal(result.action, "block");

  // `rewrittenSafeText` is what "Use safe prompt" writes into the page input and what
  // "Copy safe prompt" puts on the clipboard.
  assert.equal(result.rewrittenSafeText.includes(SECRET_LITERAL), false,
    "the raw secret must not be offered back to the page as the safe prompt");
  assert.equal(result.policy.rewrittenSafeText.includes(SECRET_LITERAL), false);
  assert.equal(result.redactedText.includes(SECRET_LITERAL), false);
  assert.equal(result.rewrittenSafeText, result.redactedText,
    "in a fail-closed state the redacted text is the only text the kernel may emit");
  // Nothing anywhere in the serialised result may contain it (findings previews included).
  assert.equal(JSON.stringify(result).includes(SECRET_LITERAL), false);
});

test("FC-411: a fail-closed block authorises no replace, no replay and no submit", () => {
  for (const state of [
    stateWith({ policyIntegrity: integrity("rollback") }),
    stateWith({ policyIntegrity: integrity("unsigned"), config: { ...enrolled.config, requirePolicySignature: true } }),
    stateWith({ policySyncStatus: "error", config: { ...enrolled.config, offlineFailClosed: true } }),
  ]) {
    const result = scanPrompt(RAW_SECRET, DESTINATION, state, "submit");
    assert.equal(isFailClosedBlock(result), true);
    const affordances = remediationAffordances(result);
    assert.deepEqual(affordances, {
      canReplace: false,
      canSubmitSafeText: false,
      canSubmitOriginal: false,
      canCopyPreview: true,
    });
  }
});

test("FC-412: an ordinary content block keeps its remediation path (the guard is not a blanket refusal)", () => {
  const trusted = stateWith({ policyIntegrity: integrity("ok", true) });
  const result = scanPrompt(RAW_SECRET, DESTINATION, trusted, "submit");
  assert.equal(result.action, "block");
  const affordances = remediationAffordances(result);
  assert.equal(affordances.canReplace, true, "the user must still be able to send the redacted prompt");
  assert.equal(affordances.canSubmitSafeText, true);
  assert.equal(affordances.canSubmitOriginal, false, "the text as typed may never reach the destination");
  // And the safe prompt it would send is genuinely transformed.
  assert.equal(result.rewrittenSafeText.includes(SECRET_LITERAL), false);
});

test("FC-413: isFailClosedBlock only fires on a block carrying a fail-closed rule id", () => {
  const trusted = stateWith({ policyIntegrity: integrity("ok", true) });
  assert.equal(isFailClosedBlock(scanPrompt(BENIGN, DESTINATION, trusted, "submit")), false);
  // Every id the gate can emit is recognised, so adding a gate without updating the guard
  // cannot silently re-open the replay path.
  for (const id of FAIL_CLOSED_RULE_IDS) {
    const fake = {
      ...scanPrompt(BENIGN, DESTINATION, trusted, "submit"),
      action: "block" as const,
    };
    fake.policy = { ...fake.policy, action: "block", matchedRules: [{ id, name: id, action: "block", severity: "critical" }] };
    assert.equal(isFailClosedBlock(fake), true, id);
  }
});

test("FC-414: the fail-closed decision is emitted for every event type, not just submit", () => {
  const state = stateWith({ policyIntegrity: integrity("organization_mismatch") });
  for (const eventType of ["scan", "submit", "paste", "context_menu", "file_upload", "response"] as const) {
    const result = scanPrompt(RAW_SECRET, DESTINATION, state, eventType);
    assert.equal(result.action, "block", eventType);
    assert.equal(isFailClosedBlock(result), true, eventType);
    assert.equal(result.rewrittenSafeText.includes(SECRET_LITERAL), false, eventType);
  }
});
