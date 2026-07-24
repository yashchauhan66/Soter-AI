import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { evaluateSecurity99Evidence, type Security99EvidenceResult, type SecurityEvidenceStatus } from "./securityEvidenceGate";

export interface Security100Gate {
  id:
    | "security-99-foundation"
    | "os-enforcement"
    | "enterprise-extension-control"
    | "signed-provenance"
    | "recovery-drill";
  label: string;
  status: SecurityEvidenceStatus;
  evidencePath: string;
  reason: string;
}

export interface Security100EvidenceResult {
  score: number;
  canClaim100: boolean;
  foundation: Security99EvidenceResult;
  gates: Security100Gate[];
  nextActions: string[];
}

interface OsEnforcementAttestation {
  platform?: string;
  enforcedBoundaries?: string[];
  processTreeBlocked?: boolean;
  shellBypassBlocked?: boolean;
  arbitraryEgressBlocked?: boolean;
  metadataEndpointBlocked?: boolean;
  filesystemEscapeBlocked?: boolean;
  testedAt?: string;
}

interface ExtensionControlAttestation {
  provider?: string;
  workspacePolicy?: "allowlist" | "blocklist" | "advisory";
  allowlistEnforced?: boolean;
  nonAllowlistedAiExtensionsBlocked?: boolean;
  policyId?: string;
  testedAt?: string;
}

interface ProvenanceAttestation {
  commitSha?: string;
  sbomPath?: string;
  artifactHash?: string;
  signatureVerified?: boolean;
  reproducibleBuildVerified?: boolean;
  verifiedAt?: string;
}

interface RecoveryDrillReport {
  completedAt?: string;
  incidentTypes?: string[];
  restoreVerified?: boolean;
  rollbackVerified?: boolean;
  rtoMinutes?: number;
  rpoMinutes?: number;
}

export function evaluateSecurity100Evidence(root = process.cwd()): Security100EvidenceResult {
  const foundation = evaluateSecurity99Evidence(root);
  const gates = [
    evaluateFoundation(foundation),
    evaluateOsEnforcement(root),
    evaluateExtensionControl(root),
    evaluateProvenance(root),
    evaluateRecoveryDrill(root),
  ];
  const pass = gates.filter((gate) => gate.status === "PASS").length;
  const partial = gates.filter((gate) => gate.status === "PARTIAL").length;
  const score = gates.every((gate) => gate.status === "PASS")
    ? 100
    : Math.min(99, 94 + pass + Math.floor(partial / 2));
  const canClaim100 = gates.every((gate) => gate.status === "PASS");
  const nextActions = gates
    .filter((gate) => gate.status !== "PASS")
    .map((gate) => `${gate.label}: ${gate.reason}`);

  return { score, canClaim100, foundation, gates, nextActions };
}

function evaluateFoundation(foundation: Security99EvidenceResult): Security100Gate {
  return gate(
    "security-99-foundation",
    "99+ foundation evidence",
    foundation.canClaim99Plus ? "PASS" : "BLOCKED",
    "reports/security-99-evidence-gates.json",
    foundation.canClaim99Plus ? "All 99+ evidence gates pass." : "100/100 requires all 99+ gates to pass first.",
  );
}

function evaluateOsEnforcement(root: string): Security100Gate {
  const evidencePath = "reports/os-enforcement-attestation.json";
  const report = readJson<OsEnforcementAttestation>(root, evidencePath);
  if (!report) return gate("os-enforcement", "OS-enforced process and network boundary", "BLOCKED", evidencePath, "Missing OS enforcement attestation.");
  const required = ["process", "network", "filesystem", "metadata-egress"];
  const hasBoundaries = required.every((item) => report.enforcedBoundaries?.includes(item));
  const pass = Boolean(
    report.platform
      && hasBoundaries
      && report.processTreeBlocked
      && report.shellBypassBlocked
      && report.arbitraryEgressBlocked
      && report.metadataEndpointBlocked
      && report.filesystemEscapeBlocked
      && report.testedAt,
  );
  return gate(
    "os-enforcement",
    "OS-enforced process and network boundary",
    pass ? "PASS" : "PARTIAL",
    evidencePath,
    pass ? "OS enforcement attestation covers process, network, metadata, and filesystem bypass tests." : "OS enforcement evidence is incomplete or advisory-only.",
  );
}

function evaluateExtensionControl(root: string): Security100Gate {
  const evidencePath = "reports/extension-control-attestation.json";
  const report = readJson<ExtensionControlAttestation>(root, evidencePath);
  if (!report) return gate("enterprise-extension-control", "Enterprise extension allowlist enforcement", "BLOCKED", evidencePath, "Missing enterprise extension-control attestation.");
  const pass = Boolean(
    report.provider
      && report.workspacePolicy === "allowlist"
      && report.allowlistEnforced
      && report.nonAllowlistedAiExtensionsBlocked
      && report.policyId
      && report.testedAt,
  );
  return gate(
    "enterprise-extension-control",
    "Enterprise extension allowlist enforcement",
    pass ? "PASS" : "PARTIAL",
    evidencePath,
    pass ? "Enterprise allowlist enforcement is present and blocks non-allowlisted AI extensions." : "Extension-control evidence is incomplete or not allowlist-enforced.",
  );
}

function evaluateProvenance(root: string): Security100Gate {
  const evidencePath = "reports/release-provenance-attestation.json";
  const report = readJson<ProvenanceAttestation>(root, evidencePath);
  if (!report) return gate("signed-provenance", "Signed reproducible release provenance", "BLOCKED", evidencePath, "Missing release provenance attestation.");
  const sbomExists = report.sbomPath ? existsSync(path.join(root, report.sbomPath)) : false;
  const pass = Boolean(
    report.commitSha
      && /^[a-f0-9]{40}$/i.test(report.commitSha)
      && report.artifactHash
      && report.signatureVerified
      && report.reproducibleBuildVerified
      && sbomExists
      && report.verifiedAt,
  );
  return gate(
    "signed-provenance",
    "Signed reproducible release provenance",
    pass ? "PASS" : "PARTIAL",
    evidencePath,
    pass ? "Release provenance, artifact signature, reproducible build, and SBOM are verified." : "Release provenance is incomplete or unsigned.",
  );
}

function evaluateRecoveryDrill(root: string): Security100Gate {
  const evidencePath = "reports/recovery-drill-report.json";
  const report = readJson<RecoveryDrillReport>(root, evidencePath);
  if (!report) return gate("recovery-drill", "Incident recovery and rollback drill", "BLOCKED", evidencePath, "Missing recovery drill report.");
  const pass = Boolean(
    report.completedAt
      && (report.incidentTypes?.length ?? 0) >= 3
      && report.restoreVerified
      && report.rollbackVerified
      && typeof report.rtoMinutes === "number"
      && report.rtoMinutes <= 60
      && typeof report.rpoMinutes === "number"
      && report.rpoMinutes <= 15,
  );
  return gate(
    "recovery-drill",
    "Incident recovery and rollback drill",
    pass ? "PASS" : "PARTIAL",
    evidencePath,
    pass ? "Recovery drill validates rollback/restore with acceptable RTO/RPO." : "Recovery drill evidence is incomplete or misses RTO/RPO targets.",
  );
}

function gate(
  id: Security100Gate["id"],
  label: string,
  status: SecurityEvidenceStatus,
  evidencePath: string,
  reason: string,
): Security100Gate {
  return { id, label, status, evidencePath, reason };
}

function readJson<T>(root: string, relativePath: string): T | null {
  const absolute = path.join(root, relativePath);
  if (!existsSync(absolute)) return null;
  try {
    return JSON.parse(readFileSync(absolute, "utf8")) as T;
  } catch {
    return null;
  }
}
