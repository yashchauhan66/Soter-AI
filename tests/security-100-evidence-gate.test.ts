import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { evaluateSecurity100Evidence } from "../lib/enterprise/security100EvidenceGate";

test("security 100 gate blocks without the 99 foundation and OS evidence", () => {
  const root = fixtureRoot("empty");
  const result = evaluateSecurity100Evidence(root);
  assert.equal(result.canClaim100, false);
  assert.ok(result.score < 100);
  assert.equal(result.gates.find((gate) => gate.id === "security-99-foundation")?.status, "BLOCKED");
  assert.equal(result.gates.find((gate) => gate.id === "os-enforcement")?.status, "BLOCKED");
});

test("security 100 gate rejects advisory-only extension and OS controls", () => {
  const root = fixtureRoot("partial");
  writeAll99Evidence(root);
  writeJson(root, "reports/os-enforcement-attestation.json", {
    platform: "windows",
    enforcedBoundaries: ["process"],
    processTreeBlocked: true,
    shellBypassBlocked: true,
  });
  writeJson(root, "reports/extension-control-attestation.json", {
    provider: "manual",
    workspacePolicy: "advisory",
    allowlistEnforced: false,
    nonAllowlistedAiExtensionsBlocked: false,
  });
  const result = evaluateSecurity100Evidence(root);
  assert.equal(result.canClaim100, false);
  assert.equal(result.gates.find((gate) => gate.id === "security-99-foundation")?.status, "PASS");
  assert.equal(result.gates.find((gate) => gate.id === "os-enforcement")?.status, "PARTIAL");
  assert.equal(result.gates.find((gate) => gate.id === "enterprise-extension-control")?.status, "PARTIAL");
});

test("security 100 gate passes only with full foundation, OS, extension, provenance, and drill evidence", () => {
  const root = fixtureRoot("pass");
  writeAll99Evidence(root);
  writeJson(root, "reports/os-enforcement-attestation.json", {
    platform: "windows-job-object-plus-firewall",
    enforcedBoundaries: ["process", "network", "filesystem", "metadata-egress"],
    processTreeBlocked: true,
    shellBypassBlocked: true,
    arbitraryEgressBlocked: true,
    metadataEndpointBlocked: true,
    filesystemEscapeBlocked: true,
    testedAt: "2026-07-22T00:00:00.000Z",
  });
  writeJson(root, "reports/extension-control-attestation.json", {
    provider: "vscode-enterprise-policy",
    workspacePolicy: "allowlist",
    allowlistEnforced: true,
    nonAllowlistedAiExtensionsBlocked: true,
    policyId: "soterai-sensitive-workspace-v1",
    testedAt: "2026-07-22T00:00:00.000Z",
  });
  writeJson(root, "artifacts/security/sbom.spdx-lite.json", { spdxVersion: "SPDX-2.3" });
  writeJson(root, "reports/release-provenance-attestation.json", {
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    sbomPath: "artifacts/security/sbom.spdx-lite.json",
    artifactHash: "sha256:0123456789abcdef",
    signatureVerified: true,
    reproducibleBuildVerified: true,
    verifiedAt: "2026-07-22T00:00:00.000Z",
  });
  writeJson(root, "reports/recovery-drill-report.json", {
    completedAt: "2026-07-22T00:00:00.000Z",
    incidentTypes: ["secret-leak", "unsafe-agent-action", "dependency-compromise"],
    restoreVerified: true,
    rollbackVerified: true,
    rtoMinutes: 30,
    rpoMinutes: 5,
  });
  const result = evaluateSecurity100Evidence(root);
  assert.equal(result.canClaim100, true);
  assert.equal(result.score, 100);
  assert.equal(result.gates.every((gate) => gate.status === "PASS"), true);
});

function writeAll99Evidence(root: string) {
  writeJson(root, "reports/external-pentest-attestation.json", {
    vendor: "Example Security Lab",
    completedAt: "2026-07-15T10:00:00.000Z",
    scope: ["api", "agent-runtime", "tenant-isolation"],
    criticalOpen: 0,
    highOpen: 0,
    remediationSummaryPath: "reports/external-pentest-remediation-summary.md",
  });
  writeFile(root, "reports/external-pentest-remediation-summary.md", "# Remediation\n\nAll critical/high findings closed.\n");
  writeJson(root, "reports/live-agent-firewall-battery.json", { baseUrl: "https://app.example.com", pass: 30, fail: 0 });
  writeJson(root, "reports/live-load-matrix.json", {
    endpoint: "https://app.example.com/api/guard/analyze",
    thresholds: { maxErrorRate: 0.01, maxP95Ms: 1000 },
    results: [
      { concurrency: 100, errorRate: 0, p95Ms: 100, throttled429: 0 },
      { concurrency: 500, errorRate: 0.001, p95Ms: 250, throttled429: 0 },
      { concurrency: 1000, errorRate: 0.002, p95Ms: 500, throttled429: 0 },
    ],
  });
  writeJson(root, "reports/independent-benchmark-validation.json", {
    externalBenchmarks: [
      { dataset: "jailbreakbench", source: "file", representativeSample: false, recall: 0.99, falsePositiveRate: 0, f1: 0.99 },
      { dataset: "harmbench", source: "file", representativeSample: false, recall: 0.98, falsePositiveRate: 0.005, f1: 0.98 },
      { dataset: "pint", source: "file", representativeSample: false, recall: 0.97, falsePositiveRate: 0.005, f1: 0.97 },
    ],
  });
}

function fixtureRoot(name: string) {
  const root = path.join(tmpdir(), `soter-security-100-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function writeJson(root: string, relativePath: string, value: unknown) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(root: string, relativePath: string, value: string) {
  const absolute = path.join(root, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, value, "utf8");
}
