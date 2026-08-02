/**
 * Model artifact signer — makes a locally-trained SoterLLM artifact loadable by
 * the runtime supply-chain gate WITHOUT weakening that gate.
 *
 * WHY THIS EXISTS
 *   lib/ml/onnxBackend.ts refuses to deserialize any model until five things
 *   hold: the artifact exists, a signed manifest covers it, the manifest signer
 *   chains to an operator trust root, the provenance source is on an allowlist,
 *   and the scan verdict is clean (lib/model-scan/runtimeGate.ts). That is the
 *   correct fail-closed posture — a model file is executable input.
 *
 *   But nothing in the repo could PRODUCE those artifacts, so the gate blocked
 *   our own model 100% of the time. mlAugment then fails open (by design), which
 *   means the ML tier silently never ran while SOTERAI_ML_AUGMENT="enforce" was
 *   set. Rules-only detection, with no signal that anything was wrong.
 *
 *   This script closes that hole the honest way: it generates an operator
 *   signing key, signs the artifact digest, and emits a trust store — then
 *   re-runs the real runtime gate and REFUSES to write anything if the gate
 *   would not admit the result. No flag disables the gate; we satisfy it.
 *
 * SECURITY NOTES
 *   - The private key is Ed25519, written 0600, and MUST NOT be committed.
 *     Default output is under .soterai/model-signing/ which .gitignore covers.
 *   - The trust store holds PUBLIC keys only and is safe to commit: it is the
 *     operator's declaration of "these signers may ship models here".
 *   - Signing binds the artifact SHA-256. Re-training changes the digest, so a
 *     stale manifest fails closed rather than admitting an unreviewed model.
 *
 * USAGE
 *   npx tsx scripts/ml/sign-model-artifact.ts \
 *     --model models/ml-classifier-v4/model.onnx \
 *     --source local-training \
 *     --builder-id soterai://local/colab-v4
 *
 *   Add --rotate to mint a fresh signer key and revoke the previous one.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash, generateKeyPairSync, randomUUID, sign as cryptoSign } from "node:crypto";
import {
  gateRuntimeModel,
  manifestSigningPayload,
  type ModelTrustStore,
  type SignedModelManifest,
  type TrustStoreKey,
} from "../../lib/model-scan";

const DEFAULT_KEY_DIR = path.join(".soterai", "model-signing");
const DEFAULT_TRUST_STORE = path.join("artifacts", "security", "model-trust-store.json");

interface Args {
  model: string;
  source: string;
  builderId: string;
  trustStore: string;
  keyFile: string;
  keyId: string | null;
  rotate: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
  };
  const model = get("--model") ?? process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v4/model.onnx";
  return {
    model,
    source: get("--source") ?? "local-training",
    builderId: get("--builder-id") ?? "soterai://local/manual-sign",
    trustStore: get("--trust-store") ?? process.env.SOTERAI_MODEL_TRUST_STORE ?? DEFAULT_TRUST_STORE,
    keyFile: get("--key-file") ?? path.join(DEFAULT_KEY_DIR, "operator-signing-key.pem"),
    keyId: get("--key-id") ?? null,
    rotate: argv.includes("--rotate"),
  };
}

function loadOrCreateTrustStore(storePath: string): ModelTrustStore {
  if (!fs.existsSync(storePath)) return { version: 1, keys: [] };
  const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as ModelTrustStore;
  if (parsed.version !== 1 || !Array.isArray(parsed.keys)) {
    throw new Error(`Trust store at ${storePath} is not a version-1 store; refusing to overwrite it.`);
  }
  return parsed;
}

/**
 * Resolve the signing key. Reuses an existing operator key so repeated signings
 * do not churn the trust root; --rotate mints a new one and marks the old key
 * REVOKED (which makes every manifest it signed fail closed immediately).
 */
function resolveSigningKey(args: Args, store: ModelTrustStore): { keyId: string; privateKeyPem: string; publicKeyPem: string; rotatedFrom: string | null } {
  const haveKey = fs.existsSync(args.keyFile);
  if (haveKey && !args.rotate) {
    const privateKeyPem = fs.readFileSync(args.keyFile, "utf8");
    const metaPath = `${args.keyFile}.json`;
    if (!fs.existsSync(metaPath)) {
      throw new Error(`Found ${args.keyFile} but no ${metaPath}; cannot recover its keyId. Pass --rotate to mint a new signer.`);
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { keyId: string; publicKeyPem: string };
    return { ...meta, privateKeyPem, rotatedFrom: null };
  }

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const keyId = args.keyId ?? `soterai-operator-${randomUUID().slice(0, 8)}`;
  const rotatedFrom = args.rotate ? (store.keys.find((key) => key.status === "ACTIVE" && key.root)?.keyId ?? null) : null;

  fs.mkdirSync(path.dirname(args.keyFile), { recursive: true });
  fs.writeFileSync(args.keyFile, privateKeyPem, { mode: 0o600 });
  fs.writeFileSync(`${args.keyFile}.json`, JSON.stringify({ keyId, publicKeyPem }, null, 2));
  return { keyId, privateKeyPem, publicKeyPem, rotatedFrom };
}

function upsertTrustRoot(store: ModelTrustStore, keyId: string, publicKeyPem: string, rotatedFrom: string | null): ModelTrustStore {
  const now = new Date().toISOString();
  const keys: TrustStoreKey[] = store.keys.map((key) =>
    rotatedFrom && key.keyId === rotatedFrom
      ? { ...key, status: "REVOKED" as const, revokedAt: now, replacedBy: keyId }
      : key,
  );
  const existing = keys.findIndex((key) => key.keyId === keyId);
  const entry: TrustStoreKey = { keyId, publicKeyPem, status: "ACTIVE", root: true, validFrom: now };
  if (existing >= 0) keys[existing] = entry;
  else keys.push(entry);
  return { version: 1, keys };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.model)) {
    throw new Error(`Model artifact not found: ${args.model}`);
  }

  const bytes = fs.readFileSync(args.model);
  const filename = path.basename(args.model);
  const store = loadOrCreateTrustStore(args.trustStore);
  const key = resolveSigningKey(args, store);
  const nextStore = upsertTrustRoot(store, key.keyId, key.publicKeyPem, key.rotatedFrom);

  const unsigned: Omit<SignedModelManifest, "signature"> = {
    version: 1,
    artifact: {
      filename,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.length,
    },
    provenance: { source: args.source, builderId: args.builderId, createdAt: new Date().toISOString() },
    signer: { keyId: key.keyId },
  };
  const signature = cryptoSign(null, manifestSigningPayload(unsigned), key.privateKeyPem).toString("base64");
  const manifest: SignedModelManifest = { ...unsigned, signature };

  // HONESTY GATE — run the exact runtime gate the loader runs. If it would not
  // admit this model we write nothing, so a failed signing can never leave a
  // half-valid manifest that looks trustworthy.
  const gated = gateRuntimeModel(bytes, filename, manifest, nextStore, { approvedSources: [args.source] });
  if (!gated.evidence.executable) {
    console.error(`\nRefusing to write: the runtime gate would ${gated.evidence.decision} this artifact.`);
    for (const reason of gated.evidence.reasons) console.error(`  - ${reason}`);
    process.exitCode = 1;
    return;
  }

  const manifestPath = `${args.model}.manifest.json`;
  fs.mkdirSync(path.dirname(args.trustStore), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(args.trustStore, `${JSON.stringify(nextStore, null, 2)}\n`);

  console.log("Model artifact signed and admitted by the runtime supply-chain gate.\n");
  console.log(`  artifact      ${args.model}`);
  console.log(`  sha256        ${manifest.artifact.sha256}`);
  console.log(`  manifest      ${manifestPath}`);
  console.log(`  trust store   ${args.trustStore}`);
  console.log(`  signer        ${key.keyId}${key.rotatedFrom ? ` (rotated from ${key.rotatedFrom}, now REVOKED)` : ""}`);
  console.log(`  private key   ${args.keyFile}  <-- never commit this`);
  console.log(`  gate          ${gated.evidence.decision} / trust=${gated.evidence.trustStatus} / risk=${gated.report.riskScore}`);
  console.log("\nAdd to your environment:\n");
  console.log(`SOTERAI_MODEL_TRUST_STORE="${args.trustStore.replace(/\\/g, "/")}"`);
  console.log(`SOTERAI_MODEL_APPROVED_SOURCES="${args.source}"`);
}

main();
