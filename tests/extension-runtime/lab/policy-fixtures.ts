/**
 * Policy bundles the runtime lab serves to the packaged extension.
 *
 * Three modes, one per enforcement outcome the lab needs to observe end to end:
 *
 *  - `block`   — a clean, unsigned bundle whose only rule blocks credential material.
 *                Unsigned is the shipped default posture, so this is the bundle a real
 *                deployment without signing configured receives.
 *  - `redact`  — the same bundle with the rule action changed, so the *policy* decides the
 *                outcome and the test does not have to hunt for a second detector.
 *  - `tampered`— a bundle correctly signed by the lab key and then mutated in a nested
 *                field. This is the exact shape the old top-level-only hash could not see;
 *                the client must report `hash_mismatch` and fail closed.
 *
 * `demo-org` is the identity the extension carries before enrollment, so the lab can drive a
 * completely unmodified packaged artefact — no storage seeding, no simulated managed config.
 */
import { signPolicyBundle } from "../../../packages/shared/src/policy-integrity";
import type { ExtensionOrgPolicy } from "../../../packages/policy-engine/src/types";

export type LabPolicyMode = "block" | "redact" | "tampered";

export const LAB_ORGANIZATION_ID = "demo-org";

/** Detector family the lab drives every decision through. */
export const LAB_SECRET_DATA_TYPE = "aws_access_key";

/** Synthetic AWS key from the AWS documentation examples. Not a live credential. */
export const LAB_SECRET = "AKIAIOSFODNN7EXAMPLE";

export const LAB_PROMPT_WITH_SECRET =
  `Please debug this deploy script, the access key is ${LAB_SECRET} and it keeps failing.`;

function basePolicy(action: "block" | "redact", version: string): ExtensionOrgPolicy {
  return {
    organizationId: LAB_ORGANIZATION_ID,
    version,
    enabled: true,
    allowedDomains: [],
    monitoredDomains: ["chatgpt.com", "chat.openai.com", "claude.ai"],
    defaultAction: "allow",
    maxPromptChars: 20000,
    riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
    rules: [
      {
        id: `lab-secret-${action}`,
        name: `Lab rule: ${action} credential material`,
        action,
        severity: "critical",
        destinationTypes: ["public_ai"],
        detectedDataTypes: [LAB_SECRET_DATA_TYPE, "api_key", "private_key", "env_file"],
      },
    ],
    // Present (empty) so policy-sync does not go looking for a destinations bundle; the
    // legacy `monitoredDomains` path is what keeps the content script active.
    destinations: [],
    updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  };
}

export async function labPolicyBundle(mode: LabPolicyMode) {
  if (mode === "block") return basePolicy("block", "lab-policy-block-1");
  if (mode === "redact") return basePolicy("redact", "lab-policy-redact-1");

  const clean = basePolicy("block", "lab-policy-tampered-1");
  const signed = await signPolicyBundle(clean, {
    keyId: "lab-signing-key",
    algorithm: "ecdsa-p256-sha256",
    privateKey: await labSigningPrivateKey(),
  });
  // The mutation an attacker actually wants: the block rule becomes `allow`, nested two
  // levels down inside `rules[0]`. The envelope is left completely intact.
  return {
    ...signed,
    rules: [{ ...signed.rules[0], action: "allow" as const }],
  };
}

let cachedPrivateKey: string | undefined;

/**
 * Ephemeral signing key, generated once per lab process and never written to disk. The lab
 * only needs a *valid* signature to prove the hash check fires independently of it, so the
 * public half is deliberately not distributed to the extension: with no trusted key
 * configured the verifier still reaches `hash_mismatch`, because the content hash is checked
 * before key selection.
 */
async function labSigningPrivateKey(): Promise<string> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const { generatePolicyKeyPair } = await import("../../../packages/shared/src/policy-integrity");
  const { signing } = await generatePolicyKeyPair("lab-signing-key");
  cachedPrivateKey = signing.privateKey;
  return cachedPrivateKey;
}
