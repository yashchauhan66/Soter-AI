/**
 * SS-1 adversarial tests for policy-bundle integrity.
 *
 * The pre-existing implementation hashed the bundle with
 * `JSON.stringify(policy, Object.keys(policy).sort())`. That is the *replacer allowlist*
 * overload, which filters keys at every depth — so `rules[]`, `riskThresholds` and
 * `destinations[]` were excluded from the hash entirely. PI-101/PI-102 are the exact
 * attacks that were previously undetectable: flip every rule to `allow`, or move the
 * block threshold to 100, and the hash input does not change.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalJson,
  computePolicyContentHash,
  generatePolicyKeyPair,
  signPolicyBundle,
  stripPolicyEnvelope,
  verifyPolicyBundle,
  type PolicySigningKey,
  type PolicyTrustedKey,
} from "../../packages/shared/src/policy-integrity";

interface TestBundle {
  organizationId: string;
  version: string;
  defaultAction: string;
  riskThresholds: { warn: number; redact: number; requireApproval: number; block: number };
  rules: Array<{ id: string; action: string; detectedDataTypes: string[] }>;
}

function bundle(): TestBundle {
  return {
    organizationId: "org-alpha",
    version: "2026.07.31",
    defaultAction: "allow",
    riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
    rules: [
      { id: "secrets", action: "block", detectedDataTypes: ["api_key", "private_key"] },
      { id: "india-pii", action: "require_approval", detectedDataTypes: ["aadhaar", "pan"] },
    ],
  };
}

let signing: PolicySigningKey;
let trusted: PolicyTrustedKey;

test("PI-000: generate a P-256 policy keypair", async () => {
  const pair = await generatePolicyKeyPair("key-2026-07");
  signing = pair.signing;
  trusted = pair.trusted;
  assert.equal(signing.algorithm, "ecdsa-p256-sha256");
  assert.ok(trusted.publicKey.length > 40);
});

test("PI-001: a correctly signed bundle verifies and is proven, not merely accepted", async () => {
  const signed = await signPolicyBundle(bundle(), signing);
  const result = await verifyPolicyBundle(signed, { keys: [trusted], organizationId: "org-alpha" });
  assert.equal(result.valid, true);
  assert.equal(result.verified, true);
  assert.equal(result.code, "ok");
  assert.equal(result.acceptedIssuedAt, signed.issuedAt);
});

test("PI-101: flipping a nested rule action to allow is detected (was undetectable)", async () => {
  const signed = await signPolicyBundle(bundle(), signing);
  const tampered = { ...signed, rules: signed.rules.map((rule) => ({ ...rule, action: "allow" })) };
  const result = await verifyPolicyBundle(tampered, { keys: [trusted], organizationId: "org-alpha" });
  assert.equal(result.valid, false);
  assert.equal(result.code, "hash_mismatch");
});

test("PI-102: raising the block threshold to 100 is detected (was undetectable)", async () => {
  const signed = await signPolicyBundle(bundle(), signing);
  const tampered = { ...signed, riskThresholds: { ...signed.riskThresholds, block: 100 } };
  const result = await verifyPolicyBundle(tampered, { keys: [trusted], organizationId: "org-alpha" });
  assert.equal(result.code, "hash_mismatch");
});

test("PI-103: deleting a rule, adding a rule and flipping defaultAction are all detected", async () => {
  const signed = await signPolicyBundle(bundle(), signing);
  const trust = { keys: [trusted], organizationId: "org-alpha" };
  const deleted = { ...signed, rules: signed.rules.slice(1) };
  const added = { ...signed, rules: [...signed.rules, { id: "evil", action: "allow", detectedDataTypes: [] }] };
  const flipped = { ...signed, defaultAction: "allow_all" };
  for (const [name, candidate] of [["deleted", deleted], ["added", added], ["flipped", flipped]] as const) {
    const result = await verifyPolicyBundle(candidate, trust);
    assert.equal(result.code, "hash_mismatch", name);
  }
});

test("PI-104: the demonstration that proves the old hash was blind", async () => {
  // Old implementation, verbatim in behaviour.
  const legacyHashInput = (policy: object) => JSON.stringify(policy, Object.keys(policy).sort());
  const original = bundle();
  const gutted = { ...original, rules: original.rules.map((r) => ({ ...r, action: "allow" })) };
  assert.equal(legacyHashInput(original), legacyHashInput(gutted),
    "old hash input is byte-identical for a fully disarmed policy — this is the bug");
  // New implementation must differ.
  assert.notEqual(await computePolicyContentHash(original), await computePolicyContentHash(gutted));
});

test("PI-105: key order and re-serialisation do not change the hash", async () => {
  const signed = await signPolicyBundle(bundle(), signing);
  const reordered = JSON.parse(JSON.stringify({
    rules: signed.rules,
    version: signed.version,
    riskThresholds: signed.riskThresholds,
    defaultAction: signed.defaultAction,
    organizationId: signed.organizationId,
    signature: signed.signature,
    policyHash: signed.policyHash,
    algorithm: signed.algorithm,
    signatureKeyId: signed.signatureKeyId,
    issuedAt: signed.issuedAt,
  }));
  const result = await verifyPolicyBundle(reordered, { keys: [trusted], organizationId: "org-alpha" });
  assert.equal(result.verified, true);
});

test("PI-106: a signature from a foreign key does not verify", async () => {
  const attacker = await generatePolicyKeyPair("key-2026-07"); // same keyId, different key
  const signed = await signPolicyBundle(bundle(), attacker.signing);
  const result = await verifyPolicyBundle(signed, { keys: [trusted], organizationId: "org-alpha" });
  assert.equal(result.valid, false);
  assert.equal(result.code, "signature_mismatch");
});

test("PI-107: a bundle signed for another tenant is refused", async () => {
  const signed = await signPolicyBundle({ ...bundle(), organizationId: "org-beta" }, signing);
  const result = await verifyPolicyBundle(signed, { keys: [trusted], organizationId: "org-alpha" });
  assert.equal(result.code, "organization_mismatch");
});

test("PI-108: replaying an older bundle is refused as a rollback", async () => {
  const older = await signPolicyBundle(bundle(), signing, { issuedAt: "2026-01-01T00:00:00.000Z" });
  const result = await verifyPolicyBundle(older, {
    keys: [trusted],
    organizationId: "org-alpha",
    lastAcceptedIssuedAt: "2026-07-30T00:00:00.000Z",
  });
  assert.equal(result.code, "rollback");
});

test("PI-109: a rollback inside clock-skew tolerance is allowed", async () => {
  const now = Date.now();
  const signed = await signPolicyBundle(bundle(), signing, { issuedAt: new Date(now - 60_000).toISOString() });
  const result = await verifyPolicyBundle(signed, {
    keys: [trusted],
    organizationId: "org-alpha",
    lastAcceptedIssuedAt: new Date(now).toISOString(),
  });
  assert.equal(result.verified, true);
});

test("PI-110: once a signed bundle has been seen, an unsigned bundle is refused for ever", async () => {
  const result = await verifyPolicyBundle(bundle(), { keys: [trusted], signedBundleSeen: true });
  assert.equal(result.valid, false);
  assert.equal(result.code, "unsigned");
});

test("PI-111: with a trusted key configured, an unsigned bundle is refused", async () => {
  const result = await verifyPolicyBundle(bundle(), { keys: [trusted] });
  assert.equal(result.valid, false);
  assert.equal(result.code, "unsigned");
});

test("PI-112: enterprise requireSigned refuses an unsigned bundle even with no keys", async () => {
  const result = await verifyPolicyBundle(bundle(), { requireSigned: true });
  assert.equal(result.valid, false);
  assert.equal(result.code, "unsigned");
});

test("PI-113: with no key and no enforcement, an unsigned bundle is accepted but NOT verified", async () => {
  const result = await verifyPolicyBundle(bundle(), {});
  assert.equal(result.valid, true);
  assert.equal(result.verified, false, "availability must never be reported as proven integrity");
  assert.equal(result.code, "unsigned");
});

test("PI-114: a signed bundle with no matching key is never reported as verified", async () => {
  const signed = await signPolicyBundle(bundle(), signing);
  const lenient = await verifyPolicyBundle(signed, { organizationId: "org-alpha" });
  assert.equal(lenient.valid, true);
  assert.equal(lenient.verified, false);
  assert.equal(lenient.code, "key_missing");

  const strict = await verifyPolicyBundle(signed, { organizationId: "org-alpha", requireSigned: true });
  assert.equal(strict.valid, false);
  assert.equal(strict.code, "key_missing");
});

test("PI-115: legacy symmetric HMAC is refused unless explicitly opted in", async () => {
  const secret = "shared-policy-secret-do-not-ship";
  const signed = await signPolicyBundle(bundle(), { keyId: "legacy-hmac", algorithm: "hmac-sha256", privateKey: secret });
  const keys: PolicyTrustedKey[] = [{ keyId: "legacy-hmac", algorithm: "hmac-sha256", publicKey: secret }];
  const blocked = await verifyPolicyBundle(signed, { keys, organizationId: "org-alpha" });
  assert.equal(blocked.valid, false);
  assert.equal(blocked.code, "unsupported_algorithm");

  const allowed = await verifyPolicyBundle(signed, { keys, organizationId: "org-alpha", allowLegacyHmac: true });
  assert.equal(allowed.verified, true);
});

test("PI-116: an unknown or downgraded algorithm is refused", async () => {
  const signed = await signPolicyBundle(bundle(), signing);
  for (const algorithm of ["none", "ECDSA-P256-SHA256", "md5"]) {
    const result = await verifyPolicyBundle({ ...signed, algorithm }, { keys: [trusted], organizationId: "org-alpha" });
    assert.equal(result.code, "unsupported_algorithm", algorithm);
  }
});

test("PI-116b: stripping envelope fields cannot downgrade a signed bundle to 'unsigned'", async () => {
  const signed = await signPolicyBundle(bundle(), signing);
  // No keys, no ratchet: the lenient path. A partial envelope must still be refused.
  for (const field of ["algorithm", "signature", "policyHash", "issuedAt"] as const) {
    const stripped: Record<string, unknown> = { ...signed };
    delete stripped[field];
    const result = await verifyPolicyBundle(stripped, {});
    assert.equal(result.valid, false, field);
    assert.equal(result.code, "malformed", field);
  }
});

test("PI-117: the algorithm is bound into the signed payload, so it cannot be swapped", async () => {
  // Sign with ECDSA, then claim HMAC with the public key as the shared secret.
  const signed = await signPolicyBundle(bundle(), signing);
  const confused = { ...signed, algorithm: "hmac-sha256" as const };
  const result = await verifyPolicyBundle(confused, {
    keys: [{ keyId: signed.signatureKeyId, algorithm: "hmac-sha256", publicKey: trusted.publicKey }],
    organizationId: "org-alpha",
    allowLegacyHmac: true,
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, "signature_mismatch");
});

test("PI-118: envelope fields are excluded from the hash, nested fields never are", () => {
  const body = stripPolicyEnvelope({
    organizationId: "org-alpha",
    signature: "x", policyHash: "y", algorithm: "z", signatureKeyId: "k", issuedAt: "t",
    rules: [{ id: "r", signature: "nested-must-stay" }],
  });
  assert.deepEqual(Object.keys(body).sort(), ["organizationId", "rules"]);
  assert.ok(canonicalJson(body).includes("nested-must-stay"));
});

test("PI-119: non-objects and malformed timestamps are refused, never thrown on", async () => {
  for (const value of [null, undefined, 42, "policy", [], true]) {
    const result = await verifyPolicyBundle(value, { keys: [trusted] });
    assert.equal(result.code, "malformed", JSON.stringify(value));
  }
  const signed = await signPolicyBundle(bundle(), signing);
  const badTime = await verifyPolicyBundle({ ...signed, issuedAt: "not-a-date" }, { keys: [trusted], organizationId: "org-alpha" });
  assert.equal(badTime.valid, false);
});

test("PI-120: canonicalisation is deterministic, depth-bounded and rejects non-finite numbers", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } }), '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}');
  assert.throws(() => canonicalJson({ threshold: Number.POSITIVE_INFINITY }), /non-finite/);
  assert.throws(() => canonicalJson({ big: 1n }), /bigint/);
  let deep: Record<string, unknown> = {};
  for (let i = 0; i < 80; i += 1) deep = { nested: deep };
  assert.throws(() => canonicalJson(deep), /maximum depth/);
});
