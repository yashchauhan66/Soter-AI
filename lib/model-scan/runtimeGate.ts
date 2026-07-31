import { scanModelArtifact, type ModelScanReport } from "./index";
import { evaluateModelDeployment, type DeploymentGateDecision } from "./gate";
import {
  verifySignedModelManifest,
  type ModelTrustStore,
  type SignedModelManifest,
  type SignatureVerification,
} from "./trust";

export interface RuntimeModelPolicy {
  approvedSources: string[];
  maximumRiskScore?: number;
}

export interface RuntimeModelGateEvidence {
  decision: DeploymentGateDecision;
  executable: boolean;
  reasons: string[];
  artifactSha256: string;
  scannerVersion: string;
  signerKeyId: string;
  trustStatus: SignatureVerification["status"];
  provenanceSource: string;
  aiBomRef: string;
}

export function gateRuntimeModel(
  bytes: Buffer,
  filename: string,
  manifest: SignedModelManifest,
  trustStore: ModelTrustStore,
  policy: RuntimeModelPolicy,
): { report: ModelScanReport; evidence: RuntimeModelGateEvidence } {
  const provenanceStatement = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [{ name: manifest.artifact.filename, digest: { sha256: manifest.artifact.sha256 } }],
    predicate: { builder: { id: manifest.provenance.builderId } },
  };
  const report = scanModelArtifact(bytes, {
    filename,
    expectedSha256: manifest.artifact.sha256,
    attestation: {
      payloadType: "application/vnd.in-toto+json",
      payload: Buffer.from(JSON.stringify(provenanceStatement)).toString("base64"),
      signatures: [{ keyid: manifest.signer.keyId, sig: manifest.signature }],
    },
  });
  const trust = verifySignedModelManifest(manifest, trustStore);
  const reasons: string[] = [];
  if (manifest.artifact.filename !== filename) reasons.push("manifest filename does not match the artifact");
  if (manifest.artifact.sizeBytes !== bytes.length) reasons.push("manifest size does not match the artifact");
  if (!policy.approvedSources.includes(manifest.provenance.source)) reasons.push("artifact source is not approved");
  if (!trust.verified) reasons.push(trust.reason);

  const trustedReport: ModelScanReport = {
    ...report,
    provenance: report.provenance
      ? { ...report.provenance, signaturePresent: true, signatureVerified: trust.verified }
      : report.provenance,
  };
  const base = evaluateModelDeployment(trustedReport, {
    requireExpectedDigest: true,
    requireProvenance: true,
    requireVerifiedSignature: true,
    maximumRiskScore: policy.maximumRiskScore ?? 10,
  });
  reasons.push(...base.reasons);
  let decision: DeploymentGateDecision = base.decision;
  if (trust.status === "REVOKED_SIGNER" || trust.status === "INVALID_SIGNATURE" || reasons.some((reason) => /does not match/.test(reason))) {
    decision = "BLOCK";
  } else if (reasons.length > 0) {
    decision = "QUARANTINE";
  }
  return {
    report: trustedReport,
    evidence: {
      decision,
      executable: decision === "ALLOW",
      reasons: [...new Set(reasons)],
      artifactSha256: report.sha256,
      scannerVersion: report.scannerVersion,
      signerKeyId: manifest.signer.keyId,
      trustStatus: trust.status,
      provenanceSource: manifest.provenance.source,
      aiBomRef: `urn:soterai:model-scan:${report.sha256}`,
    },
  };
}
