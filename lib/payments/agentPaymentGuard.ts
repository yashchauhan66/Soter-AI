/**
 * Agent Payment Guard (R3/U4 — agent financial-crime prevention)
 *
 * Pre-execution guard for agent-initiated payments (AP2/x402-style mandates).
 * No tracked competitor (PANW/Cisco/Lakera/PromptSec/HiddenLayer) ships this.
 *
 * Guarantees:
 *  1. MANDATE AUTHENTICITY — Ed25519 signature over the canonical mandate
 *     payload must verify against the operator's trusted key set.
 *  2. FRESHNESS — mandate expiresAt must be in the future; notBefore honoured.
 *  3. REPLAY PROTECTION — mandateId is single-use; a spent id never re-spends
 *     (in-memory cache + markSpent; persistence adapter via SpendStore).
 *  4. SPENDING POLICY — per-agent velocity cap (max per window), per-tx cap,
 *     payee allowlist/denylist, currency allowlist.
 *  5. FAIL CLOSED — any verification gap → BLOCK with a reason list.
 *
 * Decision verbs follow the canonical plane: ALLOW / REQUIRE_APPROVAL / BLOCK.
 */

import { createHash, verify as edVerify, createPublicKey, type KeyObject } from "node:crypto";

export type PaymentDecision = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";

export interface PaymentMandate {
  mandateId: string;
  agentId: string;
  amountMinor: number; // smallest currency unit (paise/cents) — integer only
  currency: string; // ISO 4217
  payee: string;
  notBefore: string; // ISO
  expiresAt: string; // ISO
  scope?: string; // e.g. "invoice:123" — binds mandate to one business action
  signature: string; // base64 Ed25519 over canonicalPayload()
  signerKeyId: string;
}

export interface SpendingPolicy {
  maxPerTxMinor: number;
  maxPerWindowMinor: number;
  windowMs: number; // e.g. 3600_000 = 1h
  allowedCurrencies: string[];
  payeeAllowlist?: string[];
  payeeDenylist?: string[];
  approvalAboveMinor?: number; // require human approval above this
}

export interface TrustedKey { keyId: string; publicKeyPem: string }

export interface SpendStore {
  isSpent(mandateId: string): boolean;
  markSpent(mandateId: string): void;
  windowSpendMinor(agentId: string, windowStartMs: number): number;
  record(agentId: string, amountMinor: number, atMs: number): void;
}

/** Default in-memory store — production: back with Redis/Postgres. */
export class InMemorySpendStore implements SpendStore {
  private spent = new Set<string>();
  private ledger: { agentId: string; amountMinor: number; atMs: number }[] = [];

  isSpent(id: string) { return this.spent.has(id); }
  markSpent(id: string) { this.spent.add(id); }
  windowSpendMinor(agentId: string, windowStartMs: number) {
    return this.ledger
      .filter((e) => e.agentId === agentId && e.atMs >= windowStartMs)
      .reduce((s, e) => s + e.amountMinor, 0);
  }
  record(agentId: string, amountMinor: number, atMs: number) {
    this.ledger.push({ agentId, amountMinor, atMs });
  }
}

/** Canonical signing form — stable key order, no whitespace ambiguity. */
export function canonicalPayload(m: Omit<PaymentMandate, "signature">): string {
  return [
    "v1", m.mandateId, m.agentId, String(m.amountMinor), m.currency.toUpperCase(),
    m.payee, m.notBefore, m.expiresAt, m.scope ?? "", m.signerKeyId,
  ].join("|");
}

export function payloadSha256(m: Omit<PaymentMandate, "signature">): string {
  return createHash("sha256").update(canonicalPayload(m)).digest("hex");
}

export interface GuardVerdict {
  decision: PaymentDecision;
  reasons: string[];
  mandateSha256: string;
  windowSpendAfterMinor: number;
}

export function guardAgentPayment(
  mandate: PaymentMandate,
  policy: SpendingPolicy,
  trustedKeys: TrustedKey[],
  store: SpendStore,
  nowMs: number = Date.now(),
): GuardVerdict {
  const reasons: string[] = [];
  const sha = payloadSha256(mandate);

  // 1. Structure
  if (!mandate.mandateId || !mandate.agentId) reasons.push("missing mandateId/agentId");
  if (!Number.isInteger(mandate.amountMinor) || mandate.amountMinor <= 0) reasons.push("amount must be positive integer minor units");
  if (isNaN(Date.parse(mandate.expiresAt)) || isNaN(Date.parse(mandate.notBefore))) reasons.push("bad notBefore/expiresAt");

  // 2. Freshness
  if (Date.parse(mandate.expiresAt) <= nowMs) reasons.push("mandate expired");
  if (Date.parse(mandate.notBefore) > nowMs) reasons.push("mandate not yet valid");

  // 3. Replay
  if (store.isSpent(mandate.mandateId)) reasons.push("mandateId already spent (replay)");

  // 4. Signature against trusted keys
  const key = trustedKeys.find((k) => k.keyId === mandate.signerKeyId);
  if (!key) {
    reasons.push(`untrusted signer key: ${mandate.signerKeyId}`);
  } else {
    try {
      const pub: KeyObject = createPublicKey(key.publicKeyPem);
      const ok = edVerify(null, Buffer.from(canonicalPayload(mandate)), pub, Buffer.from(mandate.signature, "base64"));
      if (!ok) reasons.push("signature invalid");
    } catch {
      reasons.push("signature verify error");
    }
  }

  // 5. Policy
  const cur = mandate.currency.toUpperCase();
  if (!policy.allowedCurrencies.map((c) => c.toUpperCase()).includes(cur)) reasons.push(`currency ${cur} not allowed`);
  if (mandate.amountMinor > policy.maxPerTxMinor) reasons.push(`amount ${mandate.amountMinor} > per-tx cap ${policy.maxPerTxMinor}`);
  if (policy.payeeDenylist?.includes(mandate.payee)) reasons.push("payee denylisted");
  if (policy.payeeAllowlist && !policy.payeeAllowlist.includes(mandate.payee)) reasons.push("payee not in allowlist");
  const windowStart = nowMs - policy.windowMs;
  const spent = store.windowSpendMinor(mandate.agentId, windowStart);
  if (spent + mandate.amountMinor > policy.maxPerWindowMinor) {
    reasons.push(`velocity cap: ${spent}+${mandate.amountMinor} > ${policy.maxPerWindowMinor} per ${policy.windowMs}ms`);
  }

  if (reasons.length > 0) {
    return { decision: "BLOCK", reasons, mandateSha256: sha, windowSpendAfterMinor: spent };
  }

  // Commit — single-use and ledger entry happen only on a clean verdict.
  store.markSpent(mandate.mandateId);
  store.record(mandate.agentId, mandate.amountMinor, nowMs);

  const needsApproval = policy.approvalAboveMinor !== undefined && mandate.amountMinor > policy.approvalAboveMinor;
  return {
    decision: needsApproval ? "REQUIRE_APPROVAL" : "ALLOW",
    reasons: needsApproval ? [`amount above approval threshold ${policy.approvalAboveMinor}`] : [],
    mandateSha256: sha,
    windowSpendAfterMinor: spent + mandate.amountMinor,
  };
}
