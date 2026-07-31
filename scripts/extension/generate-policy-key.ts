/**
 * Generates an ECDSA P-256 keypair for signing extension policy bundles.
 *
 *   npx tsx scripts/extension/generate-policy-key.ts [keyId]
 *
 * The private half goes into the server environment (never the repo); the public half is what
 * an administrator pushes to `policyTrustedKeys` in Chrome/Edge managed browser policy, where
 * it is the only thing that makes `requirePolicySignature` enforceable.
 *
 * Nothing is written to disk: the operator copies the two blocks into their own secret store
 * and browser-policy JSON. Printing to stdout keeps the private key out of the working tree,
 * where a stray commit or an editor backup would leak it.
 */
import { generatePolicyKeyPair } from "../../packages/shared/src/policy-integrity";

async function main() {
  const keyId = process.argv[2] ?? `soter-policy-${new Date().toISOString().slice(0, 10)}`;
  const { signing, trusted } = await generatePolicyKeyPair(keyId);

  console.log(`\nKey id: ${keyId}`);
  console.log(`Algorithm: ${signing.algorithm}\n`);

  console.log("── Server environment (SECRET — never commit, never log) ──────────────");
  console.log(`SOTER_POLICY_SIGNING_KEY_ID=${signing.keyId}`);
  console.log(`SOTER_POLICY_SIGNING_ALGORITHM=${signing.algorithm}`);
  console.log(`SOTER_POLICY_SIGNING_PRIVATE_KEY=${signing.privateKey}`);

  console.log("\n── Managed browser policy (public, safe to distribute) ───────────────");
  console.log(JSON.stringify({ policyTrustedKeys: [trusted], requirePolicySignature: true }, null, 2));

  console.log(
    "\nRotation: add the new public key to policyTrustedKeys alongside the old one, deploy the\n" +
    "new private key, confirm bundles verify under the new keyId, then remove the old entry.\n" +
    "Removing the old public key first blocks every client that still has a cached bundle\n" +
    "signed by it.\n",
  );
}

void main();
