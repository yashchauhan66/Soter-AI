/**
 * End-to-end proof that the server signs policy bundles and the extension verifies them.
 *
 * This closes SS-1's second half. Before this pass:
 *  - `lib/extension/policySigning.ts` had a `signPolicyBundle` with **zero callers**, so
 *    `app/api/extension/policy/route.ts` never attached `signature`, `policyHash`,
 *    `algorithm`, `signatureKeyId` or `issuedAt` to any served bundle;
 *  - which meant `requirePolicySignature` — the enterprise control that turns an unverified
 *    bundle into a hard block — could only ever block, never succeed. An administrator who
 *    enabled it bricked their fleet, so nobody could enable it, so nothing was verified.
 *
 * The tests below run the real server adapter (`signPolicyForTransport`, driven by the real
 * environment variables) into the real extension verifier (`verifyPolicy`, driven by the
 * managed-config trust state). A canonicalisation drift between the two halves fails here
 * rather than in the field, where it would break every signature at once.
 *
 * SG-602 is the regression test for the original hash defect: the old
 * `JSON.stringify(policy, Object.keys(policy).sort())` used the *replacer allowlist* overload,
 * which filters keys at every depth, so `rules[]` was excluded from the hash entirely. A
 * bundle with a `block` rule flipped to `allow` hashed identically to the original.
 *
 * No key material is committed: every test generates an ephemeral P-256 keypair.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  generatePolicyKeyPair,
  getPolicySigningKey,
  policySigningKeyStatus,
  signPolicyForTransport,
} from "../../lib/extension/policySigning";
import { normalizeTrustedKeys, verifyPolicy } from "../../apps/extension/src/lib/policy-verification";
import { defaultState } from "../../apps/extension/src/lib/storage";
import type { ExtensionState } from "../../apps/extension/src/lib/types";
import type { PolicyTrustedKey } from "../../packages/shared/src/policy-integrity";

const ORG = "org-acme";

/** A bundle shaped like the one `app/api/extension/policy/route.ts` actually serves. */
function bundle(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: ORG,
    version: "org-acme-7",
    publishedAt: "2026-07-31T00:00:00.000Z",
    enabled: true,
    defaultAction: "allow",
    maxPromptChars: 20000,
    riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
    rules: [
      { id: "extension-secret-block", name: "Block secrets", action: "block", severity: "critical", detectedDataTypes: ["aws_access_key"] },
      { id: "extension-business-redact", name: "Redact business content", action: "redact", severity: "medium", detectedDataTypes: ["source_code"] },
    ],
    destinations: [{ destinationId: "chatgpt", name: "ChatGPT", category: "public_ai", domains: ["chatgpt.com"] }],
    hardEnforcement: true,
    offlineFailClosed: true,
    ...overrides,
  };
}

function clientState(input: {
  keys?: PolicyTrustedKey[];
  requirePolicySignature?: boolean;
  organizationId?: string;
  lastAcceptedIssuedAt?: string;
  signedBundleSeen?: boolean;
}): ExtensionState {
  return {
    ...defaultState,
    enrollmentStatus: "enrolled",
    policyTrust: input.lastAcceptedIssuedAt || input.signedBundleSeen
      ? { lastAcceptedIssuedAt: input.lastAcceptedIssuedAt, signedBundleSeen: input.signedBundleSeen === true }
      : undefined,
    config: {
      ...defaultState.config,
      organizationId: input.organizationId ?? ORG,
      policyTrustedKeys: input.keys,
      requirePolicySignature: input.requirePolicySignature,
    },
  } as ExtensionState;
}

/**
 * Runs `body` with the given signing environment and restores the previous values, so a
 * failing assertion cannot leak configuration into the next test.
 */
async function withSigningEnv(env: Record<string, string | undefined>, body: () => Promise<void>) {
  const names = [
    "SOTER_POLICY_SIGNING_KEY_ID",
    "SOTER_POLICY_SIGNING_PRIVATE_KEY",
    "SOTER_POLICY_SIGNING_ALGORITHM",
    "SOTER_POLICY_ALLOW_LEGACY_HMAC",
  ];
  const saved = new Map(names.map((name) => [name, process.env[name]] as const));
  try {
    for (const name of names) {
      const value = env[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await body();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/* ── The end-to-end path ──────────────────────────────────────────────────── */

test("SG-601: a bundle signed by the server verifies cryptographically on the extension", async () => {
  const { signing, trusted } = await generatePolicyKeyPair("acme-2026-07");
  await withSigningEnv(
    {
      SOTER_POLICY_SIGNING_KEY_ID: signing.keyId,
      SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey,
      SOTER_POLICY_SIGNING_ALGORITHM: signing.algorithm,
    },
    async () => {
      const key = getPolicySigningKey();
      assert.ok(key, "the server must pick the configured key up from the environment");
      assert.equal(key!.algorithm, "ecdsa-p256-sha256", "asymmetric signing is the default");

      const served = await signPolicyForTransport(bundle());
      // The envelope the extension needs, all five fields.
      for (const field of ["signature", "policyHash", "algorithm", "signatureKeyId", "issuedAt"] as const) {
        assert.ok((served as Record<string, unknown>)[field], `served bundle is missing ${field}`);
      }
      assert.equal((served as Record<string, unknown>).signatureKeyId, "acme-2026-07");
      // Crossing a real JSON boundary, because that is what the client receives.
      const received = JSON.parse(JSON.stringify(served));

      const strict = await verifyPolicy(received, clientState({ keys: [trusted], requirePolicySignature: true }));
      assert.equal(strict.valid, true, strict.reason);
      assert.equal(strict.verified, true, "the signature must verify, not merely be present");
      assert.equal(strict.code, "ok");
      assert.equal(strict.acceptedIssuedAt, (served as Record<string, unknown>).issuedAt);
    },
  );
});

test("SG-602: a flipped nested rule breaks the hash (the replacer-allowlist regression)", async () => {
  const { signing, trusted } = await generatePolicyKeyPair("acme-nested");
  await withSigningEnv(
    { SOTER_POLICY_SIGNING_KEY_ID: signing.keyId, SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey },
    async () => {
      const served = await signPolicyForTransport(bundle()) as Record<string, unknown>;
      const trust = clientState({ keys: [trusted], requirePolicySignature: true });

      // Every one of these mutations is invisible to a top-level-only hash.
      const mutations: Array<[string, (policy: any) => void]> = [
        ["rule action block → allow", (p) => { p.rules[0].action = "allow"; }],
        ["rule detector removed", (p) => { p.rules[0].detectedDataTypes = []; }],
        ["rule deleted outright", (p) => { p.rules.splice(0, 1); }],
        ["block threshold raised", (p) => { p.riskThresholds.block = 101; }],
        ["destination re-categorised", (p) => { p.destinations[0].category = "enterprise_ai"; }],
        ["hard enforcement disabled", (p) => { p.hardEnforcement = false; }],
        ["offline fail-closed disabled", (p) => { p.offlineFailClosed = false; }],
        ["rule order swapped", (p) => { p.rules.reverse(); }],
      ];
      for (const [label, mutate] of mutations) {
        const tampered = JSON.parse(JSON.stringify(served));
        mutate(tampered);
        const result = await verifyPolicy(tampered, trust);
        assert.equal(result.valid, false, label);
        assert.equal(result.verified, false, label);
        assert.equal(result.code, "hash_mismatch", `${label} must be caught by the content hash`);
      }

      // A re-signature over the tampered body is caught by the signature instead of the hash.
      const forged = JSON.parse(JSON.stringify(served));
      forged.rules[0].action = "allow";
      const { signing: attacker } = await generatePolicyKeyPair("acme-nested");
      const resigned = await signPolicyForTransport(forged, attacker);
      const result = await verifyPolicy(resigned, trust);
      assert.equal(result.valid, false);
      assert.equal(result.code, "signature_mismatch", "a self-consistent forgery must fail on authenticity");
    },
  );
});

test("SG-603: a signed bundle cannot be replayed into another tenant", async () => {
  const { signing, trusted } = await generatePolicyKeyPair("shared-key");
  await withSigningEnv(
    { SOTER_POLICY_SIGNING_KEY_ID: signing.keyId, SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey },
    async () => {
      // A permissive bundle legitimately signed for one tenant, delivered to another. Both
      // trust the same key (a multi-tenant control plane), so only the organisation binding
      // in the signing payload stops it.
      const other = await signPolicyForTransport(bundle({ organizationId: "org-victim-neighbour", rules: [] }));
      const result = await verifyPolicy(other, clientState({ keys: [trusted], requirePolicySignature: true }));
      assert.equal(result.valid, false);
      assert.equal(result.code, "organization_mismatch");
    },
  );
});

test("SG-604: an older signed bundle cannot roll a client back", async () => {
  const { signing, trusted } = await generatePolicyKeyPair("acme-rollback");
  await withSigningEnv(
    { SOTER_POLICY_SIGNING_KEY_ID: signing.keyId, SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey },
    async () => {
      const key = getPolicySigningKey()!;
      const { signPolicyBundle } = await import("../../packages/shared/src/policy-integrity");
      const old = await signPolicyBundle(bundle({ version: "org-acme-3", rules: [] }), key, { issuedAt: "2026-01-01T00:00:00.000Z" });
      const trust = clientState({ keys: [trusted], requirePolicySignature: true, lastAcceptedIssuedAt: "2026-07-01T00:00:00.000Z" });

      const result = await verifyPolicy(old, trust);
      assert.equal(result.valid, false, "a validly signed but stale bundle is still a downgrade");
      assert.equal(result.code, "rollback");

      // The current bundle is accepted by the same client, so the ratchet is not a dead end.
      const current = await signPolicyBundle(bundle(), key, { issuedAt: "2026-07-31T00:00:00.000Z" });
      const ok = await verifyPolicy(current, trust);
      assert.equal(ok.verified, true, ok.reason);
    },
  );
});

test("SG-605: only an administrator-pushed key can make a bundle verified", async () => {
  const { signing, trusted } = await generatePolicyKeyPair("acme-real");
  const impostor = await generatePolicyKeyPair("acme-real");        // same keyId, different key
  const unrelated = await generatePolicyKeyPair("some-other-key");  // different keyId
  await withSigningEnv(
    { SOTER_POLICY_SIGNING_KEY_ID: signing.keyId, SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey },
    async () => {
      const served = await signPolicyForTransport(bundle());

      // Right key: verified.
      assert.equal((await verifyPolicy(served, clientState({ keys: [trusted], requirePolicySignature: true }))).verified, true);

      // Same keyId, wrong key material: the signature is what decides.
      const wrongMaterial = await verifyPolicy(served, clientState({ keys: [impostor.trusted], requirePolicySignature: true }));
      assert.equal(wrongMaterial.valid, false);
      assert.equal(wrongMaterial.code, "signature_mismatch");

      // No key that matches the bundle's keyId at all.
      const noMatch = await verifyPolicy(served, clientState({ keys: [unrelated.trusted], requirePolicySignature: true }));
      assert.equal(noMatch.valid, false);
      assert.equal(noMatch.code, "key_missing");

      // Key rotation: old and new trusted simultaneously, bundle signed by one of them.
      const rotating = await verifyPolicy(served, clientState({ keys: [unrelated.trusted, trusted], requirePolicySignature: true }));
      assert.equal(rotating.verified, true, "an overlapping trust window must not break verification");
    },
  );
});

test("SG-606: with no server key, requirePolicySignature is a client-side block (and only then)", async () => {
  await withSigningEnv(
    {
      SOTER_POLICY_SIGNING_KEY_ID: undefined,
      SOTER_POLICY_SIGNING_PRIVATE_KEY: undefined,
      SOTER_POLICY_SIGNING_ALGORITHM: undefined,
    },
    async () => {
      assert.equal(getPolicySigningKey(), null);
      const served = await signPolicyForTransport(bundle());
      // Unchanged object: an unsigned deployment must keep working exactly as before.
      assert.deepEqual(served, bundle());
      for (const field of ["signature", "policyHash", "algorithm", "signatureKeyId", "issuedAt"]) {
        assert.equal(field in (served as Record<string, unknown>), false, `unsigned bundle must not claim ${field}`);
      }

      // Default posture: accepted for availability, but never reported as verified.
      const lenient = await verifyPolicy(served, clientState({}));
      assert.equal(lenient.valid, true, lenient.reason);
      assert.equal(lenient.verified, false, "an unsigned bundle must never be reported as verified");
      assert.equal(lenient.code, "unsigned");

      // Enterprise posture: refused.
      const strict = await verifyPolicy(served, clientState({ requirePolicySignature: true }));
      assert.equal(strict.valid, false);
      assert.equal(strict.code, "unsigned");

      // Trust ratchet: a client that has already seen a signed bundle refuses to go back.
      const ratcheted = await verifyPolicy(served, clientState({ signedBundleSeen: true }));
      assert.equal(ratcheted.valid, false);
      assert.equal(ratcheted.code, "unsigned");
    },
  );
});

/* ── Server key configuration is fail-safe, not fail-silent ───────────────── */

test("SG-607: an incomplete or unsafe signing configuration is refused, never guessed", async () => {
  const { signing } = await generatePolicyKeyPair("half-configured");
  const cases: Array<[string, Record<string, string | undefined>, PolicySigningKeyReason]> = [
    ["nothing configured", {}, "not_configured"],
    ["private key without a key id", { SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey }, "incomplete"],
    ["key id without a private key", { SOTER_POLICY_SIGNING_KEY_ID: "k1" }, "incomplete"],
    [
      "unknown algorithm",
      { SOTER_POLICY_SIGNING_KEY_ID: "k1", SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey, SOTER_POLICY_SIGNING_ALGORITHM: "rsa-pkcs1-md5" },
      "unsupported_algorithm",
    ],
    [
      // Symmetric signing hands every verifying client the ability to forge policy for the
      // whole tenant, so it stays off unless an operator has explicitly accepted that.
      "legacy HMAC without the opt-in",
      { SOTER_POLICY_SIGNING_KEY_ID: "k1", SOTER_POLICY_SIGNING_PRIVATE_KEY: "shared-secret", SOTER_POLICY_SIGNING_ALGORITHM: "hmac-sha256" },
      "legacy_hmac_not_enabled",
    ],
  ];

  for (const [label, env, reason] of cases) {
    await withSigningEnv(env, async () => {
      assert.equal(getPolicySigningKey(), null, label);
      const status = policySigningKeyStatus();
      assert.equal(status.configured, false, label);
      assert.equal(status.configured === false && status.reason, reason, label);
      // The bundle still ships — a key problem must not take policy delivery down.
      assert.deepEqual(await signPolicyForTransport(bundle()), bundle(), label);
    });
  }

  // Whitespace-only values are treated as absent rather than as a one-character key.
  await withSigningEnv({ SOTER_POLICY_SIGNING_KEY_ID: "   ", SOTER_POLICY_SIGNING_PRIVATE_KEY: "  " }, async () => {
    assert.equal(getPolicySigningKey(), null);
    assert.equal(policySigningKeyStatus().configured, false);
  });
});

test("SG-608: the status report never contains key material", async () => {
  const { signing } = await generatePolicyKeyPair("leak-check");
  await withSigningEnv(
    { SOTER_POLICY_SIGNING_KEY_ID: signing.keyId, SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey },
    async () => {
      const status = policySigningKeyStatus();
      assert.equal(status.configured, true);
      assert.equal(JSON.stringify(status).includes(signing.privateKey), false, "the private key must never appear in a status object");
      // ...nor in the served bundle, which is public to every enrolled client.
      const served = await signPolicyForTransport(bundle());
      assert.equal(JSON.stringify(served).includes(signing.privateKey), false, "the private key must never be served");
    },
  );
});

test("SG-609: a broken key serves an unsigned bundle instead of failing the request", async () => {
  await withSigningEnv(
    { SOTER_POLICY_SIGNING_KEY_ID: "corrupt", SOTER_POLICY_SIGNING_PRIVATE_KEY: "not-a-pkcs8-key" },
    async () => {
      assert.ok(getPolicySigningKey(), "the key looks configured; only signing can discover it is not");
      // Fail-open at the server (policy delivery survives), fail-closed at the client
      // (`requirePolicySignature` blocks). The block belongs on the client, which is the only
      // side that knows whether this tenant demands a signature.
      const served = await signPolicyForTransport(bundle());
      assert.deepEqual(served, bundle());
      const strict = await verifyPolicy(served, clientState({ requirePolicySignature: true }));
      assert.equal(strict.valid, false);
      assert.equal(strict.code, "unsigned");
    },
  );
});

test("SG-610: re-signing the same body produces the same content hash", async () => {
  // Idempotence proves the envelope is excluded from the hash. If it were not, a bundle could
  // never be re-signed (key rotation) without changing its identity.
  const { signing } = await generatePolicyKeyPair("idempotent");
  await withSigningEnv(
    { SOTER_POLICY_SIGNING_KEY_ID: signing.keyId, SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey },
    async () => {
      const first = await signPolicyForTransport(bundle()) as Record<string, unknown>;
      const second = await signPolicyForTransport(first as never) as Record<string, unknown>;
      assert.equal(second.policyHash, first.policyHash, "the envelope must not feed the content hash");
      // Key-order differences in the transport JSON must not change the hash either.
      const reordered = JSON.parse(JSON.stringify(bundle()), (_key, value) => value);
      const third = await signPolicyForTransport({ ...reordered, rules: [...(reordered as any).rules] });
      assert.equal((third as Record<string, unknown>).policyHash, first.policyHash);
    },
  );
});

test("SG-611: managed trusted keys survive the GPO JSON-string delivery form", async () => {
  // Windows GPO and some MDM channels deliver a nested array as a JSON string. A key that
  // does not survive the transport is a key the administrator cannot actually push.
  const { signing, trusted } = await generatePolicyKeyPair("gpo-string");
  await withSigningEnv(
    { SOTER_POLICY_SIGNING_KEY_ID: signing.keyId, SOTER_POLICY_SIGNING_PRIVATE_KEY: signing.privateKey },
    async () => {
      const served = await signPolicyForTransport(bundle());
      const asString = JSON.stringify([trusted]);
      assert.deepEqual(normalizeTrustedKeys(asString), [trusted]);

      const state = clientState({ requirePolicySignature: true });
      (state.config as Record<string, unknown>).policyTrustedKeys = asString;
      const result = await verifyPolicy(served, state);
      assert.equal(result.verified, true, result.reason);

      // Malformed input degrades to "no keys", never to a thrown error or a trusted key.
      for (const malformed of ["not json", "{}", "[]", "[{}]", '[{"keyId":"k"}]', "null"]) {
        assert.deepEqual(normalizeTrustedKeys(malformed), [], malformed);
      }
    },
  );
});

type PolicySigningKeyReason = "not_configured" | "incomplete" | "legacy_hmac_not_enabled" | "unsupported_algorithm";
