import type { ModelScanReport, Verdict } from "./index";

export type DeploymentGateDecision = "ALLOW" | "QUARANTINE" | "BLOCK";

export interface ModelDeploymentPolicy {
  allowedVerdicts?: Verdict[];
  requireExpectedDigest?: boolean;
  requireProvenance?: boolean;
  requireVerifiedSignature?: boolean;
  maximumRiskScore?: number;
}

export interface ModelDeploymentGateResult {
  decision: DeploymentGateDecision;
  executable: boolean;
  reasons: string[];
  artifactSha256: string;
  scannerVersion: string;
}

/** Pure fail-closed gate: a loader must only proceed when executable is true. */
export function evaluateModelDeployment(
  report: ModelScanReport,
  policy: ModelDeploymentPolicy = {},
): ModelDeploymentGateResult {
  const reasons: string[] = [];
  const allowed = policy.allowedVerdicts ?? ["SAFE"];
  if (!allowed.includes(report.verdict)) reasons.push(`verdict ${report.verdict} is not deployable`);
  if (report.integrity.matchesExpected === false) reasons.push("artifact digest does not match the expected digest");
  if (policy.requireExpectedDigest && report.integrity.matchesExpected !== true) reasons.push("an expected digest match is required");
  if (policy.requireProvenance && report.provenance?.subjectDigestBinds !== true) reasons.push("digest-bound provenance is required");
  if (policy.requireVerifiedSignature && report.provenance?.signatureVerified !== true) reasons.push("a cryptographically verified signature is required");
  if (report.riskScore > (policy.maximumRiskScore ?? 10)) reasons.push(`risk score ${report.riskScore} exceeds the deployment threshold`);

  const malicious = report.verdict === "MALICIOUS" || report.integrity.matchesExpected === false;
  const decision: DeploymentGateDecision = malicious ? "BLOCK" : reasons.length ? "QUARANTINE" : "ALLOW";
  return {
    decision,
    executable: decision === "ALLOW",
    reasons,
    artifactSha256: report.sha256,
    scannerVersion: report.scannerVersion,
  };
}
