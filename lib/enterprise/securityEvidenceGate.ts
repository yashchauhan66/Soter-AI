import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type SecurityEvidenceStatus = "PASS" | "PARTIAL" | "BLOCKED";

export interface SecurityEvidenceGate {
  id: "external-pentest" | "live-runtime" | "load-matrix" | "external-benchmark";
  label: string;
  status: SecurityEvidenceStatus;
  evidencePath: string;
  reason: string;
}

export interface Security99EvidenceResult {
  score: number;
  canClaim99Plus: boolean;
  gates: SecurityEvidenceGate[];
  nextActions: string[];
}

interface PentestAttestation {
  vendor?: string;
  completedAt?: string;
  scope?: string[];
  criticalOpen?: number;
  highOpen?: number;
  remediationSummaryPath?: string;
}

interface LiveRuntimeReport {
  baseUrl?: string;
  generatedAt?: string;
  pass?: number;
  fail?: number;
  failures?: unknown[];
}

interface LoadMatrixReport {
  endpoint?: string;
  results?: Array<{ concurrency?: number; errorRate?: number; p95Ms?: number; throttled429?: number }>;
  thresholds?: { maxErrorRate?: number; maxP95Ms?: number };
}

interface IndependentBenchmarkReport {
  externalBenchmarks?: Array<{
    dataset?: string;
    source?: string;
    representativeSample?: boolean;
    recall?: number;
    falsePositiveRate?: number;
    f1?: number;
  }>;
}

const REQUIRED_CONCURRENCY = [100, 500, 1000] as const;
const REQUIRED_DATASETS = ["jailbreakbench", "harmbench", "pint"] as const;

export function evaluateSecurity99Evidence(root = process.cwd()): Security99EvidenceResult {
  const gates = [
    evaluatePentest(root),
    evaluateLiveRuntime(root),
    evaluateLoadMatrix(root),
    evaluateExternalBenchmark(root),
  ];
  const pass = gates.filter((gate) => gate.status === "PASS").length;
  const partial = gates.filter((gate) => gate.status === "PARTIAL").length;
  const score = Math.min(99, 95 + pass + Math.floor(partial / 2));
  const canClaim99Plus = gates.every((gate) => gate.status === "PASS");
  const nextActions = gates
    .filter((gate) => gate.status !== "PASS")
    .map((gate) => `${gate.label}: ${gate.reason}`);

  return { score: canClaim99Plus ? 99 : score, canClaim99Plus, gates, nextActions };
}

function evaluatePentest(root: string): SecurityEvidenceGate {
  const evidencePath = "reports/external-pentest-attestation.json";
  const attestation = readJson<PentestAttestation>(root, evidencePath);
  if (!attestation) {
    return gate("external-pentest", "Independent third-party pentest", "BLOCKED", evidencePath, "Missing vendor attestation JSON.");
  }
  const summaryExists = attestation.remediationSummaryPath
    ? existsSync(path.join(root, attestation.remediationSummaryPath))
    : false;
  const pass = Boolean(
    attestation.vendor
      && attestation.completedAt
      && Array.isArray(attestation.scope)
      && attestation.scope.length > 0
      && attestation.criticalOpen === 0
      && attestation.highOpen === 0
      && summaryExists,
  );
  return gate(
    "external-pentest",
    "Independent third-party pentest",
    pass ? "PASS" : "PARTIAL",
    evidencePath,
    pass ? "Vendor attestation and remediation summary are present with zero open critical/high findings." : "Attestation exists but vendor/date/scope/remediation/zero-open-critical-high evidence is incomplete.",
  );
}

function evaluateLiveRuntime(root: string): SecurityEvidenceGate {
  const evidencePath = "reports/live-agent-firewall-battery.json";
  const report = readJson<LiveRuntimeReport>(root, evidencePath);
  if (!report) {
    return gate("live-runtime", "Live deployed runtime security battery", "BLOCKED", evidencePath, "Missing live runtime battery JSON.");
  }
  const liveUrl = Boolean(report.baseUrl && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(report.baseUrl));
  const pass = liveUrl && Number(report.fail ?? 1) === 0 && Number(report.pass ?? 0) > 0;
  return gate(
    "live-runtime",
    "Live deployed runtime security battery",
    pass ? "PASS" : "PARTIAL",
    evidencePath,
    pass ? "Live deployed runtime battery passed with zero failures." : "Runtime report exists but is local, empty, or has failures.",
  );
}

function evaluateLoadMatrix(root: string): SecurityEvidenceGate {
  const evidencePath = "reports/live-load-matrix.json";
  const report = readJson<LoadMatrixReport>(root, evidencePath);
  if (!report) {
    return gate("load-matrix", "100/500/1000 concurrency live load matrix", "BLOCKED", evidencePath, "Missing live load matrix JSON.");
  }
  const maxErrorRate = report.thresholds?.maxErrorRate ?? 0.01;
  const maxP95Ms = report.thresholds?.maxP95Ms ?? 1000;
  const liveUrl = Boolean(report.endpoint && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(report.endpoint));
  const results = report.results ?? [];
  const hasAllLevels = REQUIRED_CONCURRENCY.every((level) => results.some((item) => item.concurrency === level));
  const passThresholds = results
    .filter((item) => REQUIRED_CONCURRENCY.includes(item.concurrency as 100 | 500 | 1000))
    .every((item) => (item.errorRate ?? 1) <= maxErrorRate && (item.p95Ms ?? Infinity) <= maxP95Ms && (item.throttled429 ?? 0) === 0);
  const pass = liveUrl && hasAllLevels && passThresholds;
  return gate(
    "load-matrix",
    "100/500/1000 concurrency live load matrix",
    pass ? "PASS" : "PARTIAL",
    evidencePath,
    pass ? "Live 100/500/1000 load matrix passed thresholds." : "Load report exists but is local, missing levels, throttled, or above latency/error thresholds.",
  );
}

function evaluateExternalBenchmark(root: string): SecurityEvidenceGate {
  const evidencePath = "reports/independent-benchmark-validation.json";
  const report = readJson<IndependentBenchmarkReport>(root, evidencePath);
  if (!report) {
    return gate("external-benchmark", "JailbreakBench/HarmBench/PINT-style external benchmark", "BLOCKED", evidencePath, "Missing independent benchmark validation JSON.");
  }
  const benchmarks = report.externalBenchmarks ?? [];
  const hasAllDatasets = REQUIRED_DATASETS.every((dataset) => benchmarks.some((item) => item.dataset === dataset));
  const fullFiles = benchmarks.every((item) => item.source === "file" && item.representativeSample === false);
  const thresholds = benchmarks.every((item) => (item.recall ?? 0) >= 0.95 && (item.falsePositiveRate ?? 1) <= 0.01 && (item.f1 ?? 0) >= 0.95);
  const pass = hasAllDatasets && fullFiles && thresholds;
  return gate(
    "external-benchmark",
    "JailbreakBench/HarmBench/PINT-style external benchmark",
    pass ? "PASS" : "PARTIAL",
    evidencePath,
    pass ? "Full local third-party dataset files passed recall/FPR/F1 thresholds." : "Benchmark report exists, but one or more datasets are representative samples or below thresholds.",
  );
}

function gate(
  id: SecurityEvidenceGate["id"],
  label: string,
  status: SecurityEvidenceStatus,
  evidencePath: string,
  reason: string,
): SecurityEvidenceGate {
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
