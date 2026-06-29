/**
 * Integrity, signature, and provenance verification for model artifacts.
 *
 * - Integrity: SHA-256 (+ optional expected digest / known-good allowlist).
 * - Provenance: structural verification of SLSA / in-toto attestation envelopes
 *   (DSSE) and Sigstore-style bundles. We verify SHAPE and subject-digest
 *   binding (does the attestation actually cover THIS artifact?), which is the
 *   most commonly skipped check. Cryptographic signature chain verification is
 *   reported as a separate, explicit capability flag.
 */
import { createHash } from "node:crypto";
import type { Severity } from "./classify";

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export interface IntegrityResult {
  sha256: string;
  sizeBytes: number;
  expectedSha256: string | null;
  matchesExpected: boolean | null; // null when no expected digest supplied
  knownGood: boolean;
}

export function verifyIntegrity(
  buf: Buffer,
  opts: { expectedSha256?: string | null; knownGoodHashes?: string[] } = {},
): IntegrityResult {
  const digest = sha256(buf);
  const expected = opts.expectedSha256?.toLowerCase().trim() || null;
  const allow = new Set((opts.knownGoodHashes ?? []).map((h) => h.toLowerCase().trim()));
  return {
    sha256: digest,
    sizeBytes: buf.length,
    expectedSha256: expected,
    matchesExpected: expected ? expected === digest : null,
    knownGood: allow.has(digest),
  };
}

export interface ProvenanceResult {
  present: boolean;
  format: "dsse-intoto" | "slsa" | "sigstore-bundle" | "unknown" | "none";
  wellFormed: boolean;
  subjectDigestBinds: boolean | null; // does it cover the artifact's sha256?
  predicateType: string | null;
  builderId: string | null;
  signaturePresent: boolean;
  signatureVerified: boolean; // structural only — see notes
  issues: string[];
  severity: Severity; // risk contribution of provenance state
}

/**
 * Verify a provenance/attestation document against an artifact digest.
 * `attestation` may be a JSON object or string (DSSE envelope, in-toto
 * statement, SLSA provenance, or Sigstore bundle).
 */
export function verifyProvenance(
  attestation: unknown,
  artifactSha256: string,
): ProvenanceResult {
  const base: ProvenanceResult = {
    present: false, format: "none", wellFormed: false, subjectDigestBinds: null,
    predicateType: null, builderId: null, signaturePresent: false,
    signatureVerified: false, issues: [], severity: "MEDIUM",
  };
  if (attestation == null) {
    base.issues.push("No provenance attestation supplied — artifact origin is unverified.");
    return base;
  }

  let doc: Record<string, unknown>;
  try {
    doc = typeof attestation === "string" ? JSON.parse(attestation) : (attestation as Record<string, unknown>);
  } catch {
    return { ...base, present: true, format: "unknown", issues: ["Provenance is not valid JSON."], severity: "MEDIUM" };
  }
  base.present = true;

  // DSSE envelope: { payloadType, payload(base64), signatures[] }
  let statement: Record<string, unknown> = doc;
  if (typeof doc.payload === "string" && Array.isArray(doc.signatures)) {
    base.format = "dsse-intoto";
    base.signaturePresent = doc.signatures.length > 0 &&
      doc.signatures.some((s) => typeof (s as Record<string, unknown>)?.sig === "string");
    try {
      statement = JSON.parse(Buffer.from(doc.payload, "base64").toString("utf8"));
    } catch {
      base.issues.push("DSSE payload is not decodable JSON.");
      base.severity = "HIGH";
      return base;
    }
  } else if (doc.verificationMaterial || doc.dsseEnvelope || doc.messageSignature) {
    base.format = "sigstore-bundle";
    const env = (doc.dsseEnvelope as Record<string, unknown>) ?? {};
    base.signaturePresent = Boolean(env.signatures || doc.messageSignature);
    if (typeof env.payload === "string") {
      try { statement = JSON.parse(Buffer.from(env.payload, "base64").toString("utf8")); } catch { /* keep doc */ }
    }
  }

  const predicateType = (statement._type === "https://in-toto.io/Statement/v1" || statement.predicateType)
    ? String(statement.predicateType ?? "")
    : null;
  base.predicateType = predicateType;
  if (predicateType?.includes("slsa.dev/provenance")) base.format = base.format === "none" ? "slsa" : base.format;

  // Builder id (SLSA)
  const predicate = statement.predicate as Record<string, unknown> | undefined;
  const builder = predicate?.builder as Record<string, unknown> | undefined;
  base.builderId = (builder?.id as string) ?? (predicate?.builderId as string) ?? null;

  // Subject digest binding — the critical check.
  const subjects = (statement.subject as Array<Record<string, unknown>>) ?? [];
  base.wellFormed = Array.isArray(subjects) && subjects.length > 0;
  if (base.wellFormed) {
    const target = artifactSha256.toLowerCase();
    base.subjectDigestBinds = subjects.some((s) => {
      const digest = (s.digest as Record<string, string>) ?? {};
      return Object.values(digest).some((v) => String(v).toLowerCase() === target);
    });
    if (!base.subjectDigestBinds) {
      base.issues.push("Attestation does not list this artifact's SHA-256 as a subject — it may belong to a different file.");
    }
  } else {
    base.issues.push("Attestation has no in-toto subject array — cannot bind it to the artifact.");
  }

  // Structural signature presence (full chain verification requires the signer's
  // public key / Fulcio root and is intentionally surfaced as not-yet-verified).
  if (!base.signaturePresent) base.issues.push("No signature found in the provenance envelope.");
  base.signatureVerified = false;

  // Risk contribution
  if (!base.present) base.severity = "MEDIUM";
  else if (base.subjectDigestBinds && base.signaturePresent) base.severity = "LOW";
  else if (base.subjectDigestBinds === false) base.severity = "HIGH";
  else base.severity = "MEDIUM";

  return base;
}
