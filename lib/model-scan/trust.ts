import { createPublicKey, verify } from "node:crypto";

export interface TrustStoreKey {
  keyId: string;
  publicKeyPem: string;
  status: "ACTIVE" | "REVOKED";
  root?: boolean;
  signedBy?: string;
  certificateSignature?: string;
  validFrom?: string;
  validTo?: string;
  revokedAt?: string;
  replacedBy?: string;
}

export interface ModelTrustStore {
  version: 1;
  keys: TrustStoreKey[];
}

export interface SignedModelManifest {
  version: 1;
  artifact: { filename: string; sha256: string; sizeBytes: number };
  provenance: { source: string; builderId: string; createdAt: string };
  signer: { keyId: string };
  signature: string;
}

export type SignatureTrustStatus =
  | "TRUSTED"
  | "UNKNOWN_SIGNER"
  | "REVOKED_SIGNER"
  | "INVALID_SIGNATURE"
  | "INVALID_CHAIN"
  | "EXPIRED_SIGNER";

export interface SignatureVerification {
  status: SignatureTrustStatus;
  verified: boolean;
  keyId: string;
  chain: string[];
  reason: string;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function manifestSigningPayload(manifest: Omit<SignedModelManifest, "signature">): Buffer {
  return Buffer.from(canonicalize(manifest), "utf8");
}

function certificatePayload(key: TrustStoreKey): Buffer {
  return Buffer.from(canonicalize({
    keyId: key.keyId,
    publicKeyPem: key.publicKeyPem,
    validFrom: key.validFrom ?? null,
    validTo: key.validTo ?? null,
    signedBy: key.signedBy ?? null,
  }), "utf8");
}

function verifyBytes(publicKeyPem: string, payload: Buffer, signature: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem);
    const algorithm = key.asymmetricKeyType === "ed25519" || key.asymmetricKeyType === "ed448"
      ? null
      : "sha256";
    return verify(algorithm, payload, key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

function validateKeyChain(
  key: TrustStoreKey,
  store: ModelTrustStore,
  now: Date,
  seen = new Set<string>(),
): { ok: boolean; status: SignatureTrustStatus; chain: string[]; reason: string } {
  if (seen.has(key.keyId)) return { ok: false, status: "INVALID_CHAIN", chain: [key.keyId], reason: "trust chain contains a cycle" };
  seen.add(key.keyId);
  if (key.status === "REVOKED") return { ok: false, status: "REVOKED_SIGNER", chain: [key.keyId], reason: `signer ${key.keyId} is revoked` };
  if ((key.validFrom && now < new Date(key.validFrom)) || (key.validTo && now > new Date(key.validTo))) {
    return { ok: false, status: "EXPIRED_SIGNER", chain: [key.keyId], reason: `signer ${key.keyId} is outside its validity window` };
  }
  if (key.root) return { ok: true, status: "TRUSTED", chain: [key.keyId], reason: "chain terminates at configured trust root" };
  if (!key.signedBy || !key.certificateSignature) {
    return { ok: false, status: "INVALID_CHAIN", chain: [key.keyId], reason: "non-root signer has no signed parent certificate" };
  }
  const parent = store.keys.find((candidate) => candidate.keyId === key.signedBy);
  if (!parent) return { ok: false, status: "INVALID_CHAIN", chain: [key.keyId], reason: `parent key ${key.signedBy} is unknown` };
  const parentChain = validateKeyChain(parent, store, now, seen);
  if (!parentChain.ok) return { ...parentChain, chain: [key.keyId, ...parentChain.chain] };
  if (!verifyBytes(parent.publicKeyPem, certificatePayload(key), key.certificateSignature)) {
    return { ok: false, status: "INVALID_CHAIN", chain: [key.keyId, ...parentChain.chain], reason: "signer certificate signature is invalid" };
  }
  return { ok: true, status: "TRUSTED", chain: [key.keyId, ...parentChain.chain], reason: parentChain.reason };
}

export function verifySignedModelManifest(
  manifest: SignedModelManifest,
  store: ModelTrustStore,
  now = new Date(),
): SignatureVerification {
  const key = store.keys.find((candidate) => candidate.keyId === manifest.signer.keyId);
  if (!key) {
    return { status: "UNKNOWN_SIGNER", verified: false, keyId: manifest.signer.keyId, chain: [], reason: "signer is not present in the operator trust store" };
  }
  const chain = validateKeyChain(key, store, now);
  if (!chain.ok) return { status: chain.status, verified: false, keyId: key.keyId, chain: chain.chain, reason: chain.reason };
  const { signature, ...unsigned } = manifest;
  if (!verifyBytes(key.publicKeyPem, manifestSigningPayload(unsigned), signature)) {
    return { status: "INVALID_SIGNATURE", verified: false, keyId: key.keyId, chain: chain.chain, reason: "manifest signature is invalid" };
  }
  return { status: "TRUSTED", verified: true, keyId: key.keyId, chain: chain.chain, reason: chain.reason };
}
