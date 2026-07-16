import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { evaluateSecurity99Evidence } from "../lib/enterprise/securityEvidenceGate";

test("security 99 gate blocks when external evidence is missing", () => {
  const root = path.join(tmpdir(), `soter-security-gate-empty-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  const result = evaluateSecurity99Evidence(root);
  assert.equal(result.canClaim99Plus, false);
  assert.ok(result.score < 99);
  assert.equal(result.gates.every((gate) => gate.status === "BLOCKED"), true);
});

test("security 99 gate does not pass representative external benchmark samples", () => {
  const root = fixtureRoot("samples");
  writeJson(root, "reports/independent-benchmark-validation.json", {
    externalBenchmarks: [
      { dataset: "jailbreakbench", source: "sample", representativeSample: true, recall: 1, falsePositiveRate: 0, f1: 1 },
      { dataset: "harmbench", source: "sample", representativeSample: true, recall: 1, falsePositiveRate: 0, f1: 1 },
      { dataset: "pint", source: "sample", representativeSample: true, recall: 1, falsePositiveRate: 0, f1: 1 },
    ],
  });
  const result = evaluateSecurity99Evidence(root);
  const gate = result.gates.find((item) => item.id === "external-benchmark");
  assert.equal(gate?.status, "PARTIAL");
  assert.equal(result.canClaim99Plus, false);
});

test("security 99 gate requires live URLs for runtime and load evidence", () => {
  const root = fixtureRoot("local-live");
  writeJson(root, "reports/live-agent-firewall-battery.json", { baseUrl: "http://localhost:3199", pass: 25, fail: 0 });
  writeJson(root, "reports/live-load-matrix.json", {
    endpoint: "http://localhost:3199/api/guard/analyze",
    thresholds: { maxErrorRate: 0.01, maxP95Ms: 1000 },
    results: [
      { concurrency: 100, errorRate: 0, p95Ms: 100, throttled429: 0 },
      { concurrency: 500, errorRate: 0, p95Ms: 200, throttled429: 0 },
      { concurrency: 1000, errorRate: 0, p95Ms: 300, throttled429: 0 },
    ],
  });
  const result = evaluateSecurity99Evidence(root);
  assert.equal(result.gates.find((item) => item.id === "live-runtime")?.status, "PARTIAL");
  assert.equal(result.gates.find((item) => item.id === "load-matrix")?.status, "PARTIAL");
});

test("security 99 gate passes only with pentest, live runtime, live load matrix, and full external datasets", () => {
  const root = fixtureRoot("all-pass");
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

  const result = evaluateSecurity99Evidence(root);
  assert.equal(result.canClaim99Plus, true);
  assert.equal(result.score, 99);
  assert.equal(result.gates.every((gate) => gate.status === "PASS"), true);
});

function fixtureRoot(name: string) {
  const root = path.join(tmpdir(), `soter-security-gate-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
