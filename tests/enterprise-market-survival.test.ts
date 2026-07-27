import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ENTERPRISE_SURVIVAL_GATES,
  canClaimEnterpriseGA,
  scoreSurvivalGates,
  summarizeSurvivalPosition,
  type SurvivalGate,
} from "../lib/enterprise/marketSurvival";

test("enterprise survival gates cover security, proof, runtime, customer, and ops", () => {
  const ids = new Set(ENTERPRISE_SURVIVAL_GATES.map((gate) => gate.id));
  for (const id of [
    "security-benchmark",
    "independent-validation",
    "external-pentest",
    "load-proof",
    "enterprise-runtime",
    "customer-proof",
    "support-ops",
    "claims-control",
  ]) {
    assert.ok(ids.has(id), `${id} gate missing`);
  }
});

test("current enterprise survival position is honest and not GA", () => {
  const result = scoreSurvivalGates();
  assert.ok(result.score >= 50, `expected credible controlled-beta score, got ${result.score}`);
  assert.notEqual(result.grade, "ENTERPRISE_READY");
  assert.equal(canClaimEnterpriseGA(), false);
  assert.ok(result.hardBlockers.some((gate) => gate.id === "external-pentest"));
  assert.ok(result.hardBlockers.some((gate) => gate.id === "enterprise-runtime"));
});

test("GA claim only unlocks when every gate is verified", () => {
  const verified: SurvivalGate[] = ENTERPRISE_SURVIVAL_GATES.map((gate) => ({
    ...gate,
    state: "VERIFIED",
    blocker: undefined,
  }));

  assert.equal(canClaimEnterpriseGA(verified), true);
  assert.equal(scoreSurvivalGates(verified).grade, "ENTERPRISE_READY");
});

test("survival summary is evidence-gated", () => {
  const summary = summarizeSurvivalPosition();
  assert.match(summary, /evidence-gated|external proof|paid pilots|controlled beta/i);
});

test("enterprise market survival doc contains buyer-grade operating rules", () => {
  const doc = readFileSync("docs/enterprise-market-survival-plan.md", "utf8");
  for (const phrase of [
    "No Enterprise GA claim",
    "paid pilot",
    "external pentest",
    "100/500/1000",
    "Razorpay",
    "SAML",
    "SCIM",
    "market survival",
    "kill criteria",
  ]) {
    assert.ok(doc.includes(phrase), `doc missing ${phrase}`);
  }
});
