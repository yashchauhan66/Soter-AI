import assert from "node:assert/strict";
import test from "node:test";

import {
  ENTERPRISE_PROOF_KIT,
  proofKitBlocksDimension,
  summarizeProofKit,
} from "../lib/enterprise/proofKit";

test("enterprise proof kit covers every remaining high-value GA proof gate", () => {
  const ids = new Set(ENTERPRISE_PROOF_KIT.map((item) => item.id));
  for (const id of [
    "honest-benchmark",
    "independent-benchmark",
    "external-pentest",
    "load-proof",
    "razorpay-proof",
    "saml-proof",
    "scim-proof",
    "tenant-isolation-proof",
    "runtime-marketplace-proof",
    "support-ops-proof",
  ]) {
    assert.ok(ids.has(id), `${id} proof missing`);
  }
});

test("enterprise proof kit is execution-ready without pretending external proof is complete", () => {
  const summary = summarizeProofKit();
  assert.equal(summary.total, 10);
  assert.ok(summary.readinessScore >= 70, `expected proof readiness >=70, got ${summary.readinessScore}`);
  assert.ok(summary.externalVendorRequired >= 1, "external pentest must stay external-vendor gated");
  assert.ok(summary.needsEnvironment >= 1, "live environment proof must stay explicit");
  assert.ok(summary.nextActions.some((action) => /External pentest|Load|Razorpay|SAML|SCIM|runtime/i.test(action)));
});

test("proof items have buyer-grade evidence requirements", () => {
  for (const item of ENTERPRISE_PROOF_KIT) {
    assert.ok(item.label.length > 8, `${item.id} label too thin`);
    assert.ok(item.evidencePath.includes("."), `${item.id} evidence path missing extension`);
    assert.ok(item.passCriteria.length >= 3, `${item.id} needs at least three pass criteria`);
    assert.ok(item.blocks.length > 0, `${item.id} must map to readiness dimensions`);
  }
});

test("proof kit maps directly to weak readiness dimensions", () => {
  assert.ok(proofKitBlocksDimension("Revenue Readiness").some((item) => item.id === "razorpay-proof"));
  assert.ok(proofKitBlocksDimension("Marketplace Readiness").some((item) => item.id === "runtime-marketplace-proof"));
  assert.ok(proofKitBlocksDimension("Enterprise Readiness").some((item) => item.id === "external-pentest"));
  assert.ok(proofKitBlocksDimension("Market Survival").some((item) => item.id === "support-ops-proof"));
});
