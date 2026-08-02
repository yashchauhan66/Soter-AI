import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign, randomUUID } from "node:crypto";
import {
  canonicalPayload,
  guardAgentPayment,
  InMemorySpendStore,
  type PaymentMandate,
  type SpendingPolicy,
  type TrustedKey,
} from "../lib/payments/agentPaymentGuard";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const KEY_ID = "operator-test-key-1";
const trusted: TrustedKey[] = [{ keyId: KEY_ID, publicKeyPem }];

const policy: SpendingPolicy = {
  maxPerTxMinor: 100_000,        // ₹1,000.00
  maxPerWindowMinor: 300_000,    // ₹3,000 / hour
  windowMs: 3_600_000,
  allowedCurrencies: ["INR", "USD"],
  payeeAllowlist: ["vendor-a", "vendor-b"],
  payeeDenylist: ["scam-wallet"],
  approvalAboveMinor: 50_000,    // > ₹500 needs human
};

function makeMandate(over: Partial<PaymentMandate> = {}): PaymentMandate {
  const now = Date.now();
  const base: Omit<PaymentMandate, "signature"> = {
    mandateId: over.mandateId ?? randomUUID(),
    agentId: over.agentId ?? "agent-1",
    amountMinor: over.amountMinor ?? 10_000,
    currency: over.currency ?? "INR",
    payee: over.payee ?? "vendor-a",
    notBefore: over.notBefore ?? new Date(now - 1000).toISOString(),
    expiresAt: over.expiresAt ?? new Date(now + 60_000).toISOString(),
    scope: over.scope ?? "invoice:test",
    signerKeyId: over.signerKeyId ?? KEY_ID,
  };
  const sig = edSign(null, Buffer.from(canonicalPayload(base)), privateKey).toString("base64");
  return { ...base, signature: sig };
}

test("valid mandate → ALLOW and commits (single-use)", () => {
  const store = new InMemorySpendStore();
  const v = guardAgentPayment(makeMandate(), policy, trusted, store);
  assert.equal(v.decision, "ALLOW");
  assert.ok(v.mandateSha256.length === 64);
});

test("replay — same mandateId second time → BLOCK", () => {
  const store = new InMemorySpendStore();
  const m = makeMandate();
  const first = guardAgentPayment(m, policy, trusted, store);
  assert.equal(first.decision, "ALLOW");
  const second = guardAgentPayment(m, policy, trusted, store); // identical id
  assert.equal(second.decision, "BLOCK");
  assert.ok(second.reasons.some((r) => r.includes("replay")));
});

test("tampered amount → signature invalid → BLOCK (fail-closed)", () => {
  const store = new InMemorySpendStore();
  const m = makeMandate();
  m.amountMinor = 99_999_999; // attacker edits after signing
  const v = guardAgentPayment(m, policy, trusted, store);
  assert.equal(v.decision, "BLOCK");
  assert.ok(v.reasons.some((r) => r.includes("signature invalid")));
});

test("untrusted signer key → BLOCK", () => {
  const store = new InMemorySpendStore();
  const m = makeMandate({ signerKeyId: "rogue-key" });
  const v = guardAgentPayment(m, policy, trusted, store);
  assert.equal(v.decision, "BLOCK");
  assert.ok(v.reasons.some((r) => r.includes("untrusted signer")));
});

test("expired mandate → BLOCK", () => {
  const store = new InMemorySpendStore();
  const past = Date.now() - 10_000;
  const m = makeMandate({ expiresAt: new Date(past - 1000).toISOString(), notBefore: new Date(past - 60_000).toISOString() });
  const v = guardAgentPayment(m, policy, trusted, store);
  assert.equal(v.decision, "BLOCK");
  assert.ok(v.reasons.some((r) => r.includes("expired")));
});

test("denylisted payee → BLOCK", () => {
  const store = new InMemorySpendStore();
  const v = guardAgentPayment(makeMandate({ payee: "scam-wallet" }), policy, trusted, store);
  assert.equal(v.decision, "BLOCK");
  assert.ok(v.reasons.some((r) => r.includes("denylisted")));
});

test("over per-tx cap → BLOCK", () => {
  const store = new InMemorySpendStore();
  const v = guardAgentPayment(makeMandate({ amountMinor: 500_000 }), policy, trusted, store);
  assert.equal(v.decision, "BLOCK");
  assert.ok(v.reasons.some((r) => r.includes("per-tx cap")));
});

test("velocity cap — cumulative window spend exceeds limit → BLOCK", () => {
  const store = new InMemorySpendStore();
  // each under 50k approval threshold; 7×40k = 280k ≤ 300k window, then 40k more breaks it
  for (let i = 0; i < 7; i++) {
    assert.equal(guardAgentPayment(makeMandate({ amountMinor: 40_000 }), policy, trusted, store).decision, "ALLOW");
  }
  // next 40k → 320k > 300k cap
  const v = guardAgentPayment(makeMandate({ amountMinor: 40_000 }), policy, trusted, store);

  assert.equal(v.decision, "BLOCK");
  assert.ok(v.reasons.some((r) => r.includes("velocity cap")));
});

test("amount above approval threshold but under caps → REQUIRE_APPROVAL", () => {
  const store = new InMemorySpendStore();
  const v = guardAgentPayment(makeMandate({ amountMinor: 80_000 }), policy, trusted, store);
  assert.equal(v.decision, "REQUIRE_APPROVAL");
});

test("disallowed currency → BLOCK", () => {
  const store = new InMemorySpendStore();
  const v = guardAgentPayment(makeMandate({ currency: "EUR" }), policy, trusted, store);
  assert.equal(v.decision, "BLOCK");
});
