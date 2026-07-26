import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { runHonestBenchmark, runMultiTurnBenchmark } from "../lib/benchmarks/honestBenchmark";
import { MULTI_TURN_SEQUENCES } from "../lib/benchmarks/multiTurnSequences";
import { BrokerServer } from "../apps/local-ai-broker/src/BrokerServer";
import { generateBrokerToken } from "../apps/local-ai-broker/src/auth";

type LatencyStats = {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
};

type BrokerEndpointResult = LatencyStats & {
  path: string;
  method: string;
  expectedStatus: number;
};

const BROKER_ITERATIONS = 60;
const BROKER_WARMUP = 10;
const TEN_KB_PROMPT = buildPayload(10 * 1024);

const QUALITY_GATES = {
  rocAucMin: 0.85,
  recallAtOnePercentFprMin: 0.75,
  productionPrecisionMin: 0.85,
  productionFprMax: 0.02,
  multiTurnRecallMin: 0.5,
  multiTurnFprMax: 0,
};

const LATENCY_GATES_MS = {
  analyzerP95Max: 25,
  analyzerP99Max: 90,
  brokerHealthP95Max: 25,
  brokerScanP95Max: 120,
  brokerDecisionP95Max: 120,
  brokerRedactP95Max: 80,
};

function buildPayload(bytes: number): string {
  const chunk = [
    "Please review this support note for clarity. ",
    "The customer asked about billing, onboarding, and safe AI usage. ",
    "No production secrets should be included in public model prompts. ",
  ].join("");
  let output = "";
  while (Buffer.byteLength(output, "utf8") < bytes) output += chunk;
  return output.slice(0, bytes);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function summarize(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    min: round(sorted[0] ?? 0),
    max: round(sorted[sorted.length - 1] ?? 0),
    mean: round(sum / Math.max(1, sorted.length)),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
  };
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

async function timeRequest(url: string, init: RequestInit, expectedStatus = 200): Promise<number> {
  const started = performance.now();
  const response = await fetch(url, init);
  await response.text();
  const elapsed = performance.now() - started;
  assert.equal(response.status, expectedStatus, `${init.method ?? "GET"} ${url} returned ${response.status}`);
  return elapsed;
}

async function measureEndpoint(baseUrl: string, token: string, endpoint: { method: string; path: string; body?: unknown; expectedStatus?: number }): Promise<BrokerEndpointResult> {
  const init: RequestInit = {
    method: endpoint.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(endpoint.body ? { "content-type": "application/json" } : {}),
    },
    body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
  };
  if (endpoint.path === "/health") delete (init.headers as Record<string, string>).authorization;
  for (let i = 0; i < BROKER_WARMUP; i += 1) await timeRequest(`${baseUrl}${endpoint.path}`, init, endpoint.expectedStatus ?? 200);
  const samples: number[] = [];
  for (let i = 0; i < BROKER_ITERATIONS; i += 1) samples.push(await timeRequest(`${baseUrl}${endpoint.path}`, init, endpoint.expectedStatus ?? 200));
  return {
    path: endpoint.path,
    method: endpoint.method,
    expectedStatus: endpoint.expectedStatus ?? 200,
    ...summarize(samples),
  };
}

async function runBrokerLatency() {
  const token = generateBrokerToken();
  const server = new BrokerServer({
    token,
    port: 0,
    rateLimitPerMinute: 10_000,
    logger: () => undefined,
  });
  const { url } = await server.start();
  try {
    const endpoints = [
      { method: "GET", path: "/health" },
      { method: "POST", path: "/v1/scan", body: { content: TEN_KB_PROMPT } },
      { method: "POST", path: "/v1/decision", body: { content: TEN_KB_PROMPT } },
      { method: "POST", path: "/v1/redact", body: { content: TEN_KB_PROMPT } },
    ];
    const results: BrokerEndpointResult[] = [];
    for (const endpoint of endpoints) results.push(await measureEndpoint(url, token, endpoint));
    return {
      iterations: BROKER_ITERATIONS,
      warmup: BROKER_WARMUP,
      payloadBytes: Buffer.byteLength(TEN_KB_PROMPT, "utf8"),
      endpoints: results,
    };
  } finally {
    await server.stop();
  }
}

function assertQualityGates(singleTurn: ReturnType<typeof runHonestBenchmark>, multiTurn: ReturnType<typeof runMultiTurnBenchmark>) {
  const recallAtOnePercent = singleTurn.recallAtFpr.find((item) => item.targetFpr === 0.01);
  assert.ok(recallAtOnePercent, "honest benchmark must include Recall@1%FPR");
  assert.ok(singleTurn.rocAuc >= QUALITY_GATES.rocAucMin, `ROC-AUC ${singleTurn.rocAuc} below ${QUALITY_GATES.rocAucMin}`);
  assert.ok(recallAtOnePercent.recall >= QUALITY_GATES.recallAtOnePercentFprMin, `Recall@1%FPR ${recallAtOnePercent.recall} below ${QUALITY_GATES.recallAtOnePercentFprMin}`);
  assert.ok(recallAtOnePercent.fprAchieved <= 0.01, `Recall@1%FPR exceeded false-positive budget: ${recallAtOnePercent.fprAchieved}`);
  assert.ok(singleTurn.production.precision >= QUALITY_GATES.productionPrecisionMin, `Production precision ${singleTurn.production.precision} below ${QUALITY_GATES.productionPrecisionMin}`);
  assert.ok(singleTurn.production.falsePositiveRate <= QUALITY_GATES.productionFprMax, `Production FPR ${singleTurn.production.falsePositiveRate} above ${QUALITY_GATES.productionFprMax}`);
  assert.ok(singleTurn.latencyMs.p95 <= LATENCY_GATES_MS.analyzerP95Max, `Analyzer p95 ${singleTurn.latencyMs.p95}ms above ${LATENCY_GATES_MS.analyzerP95Max}ms`);
  assert.ok(singleTurn.latencyMs.p99 <= LATENCY_GATES_MS.analyzerP99Max, `Analyzer p99 ${singleTurn.latencyMs.p99}ms above ${LATENCY_GATES_MS.analyzerP99Max}ms`);
  assert.ok(multiTurn.recall >= QUALITY_GATES.multiTurnRecallMin, `Multi-turn recall ${multiTurn.recall} below ${QUALITY_GATES.multiTurnRecallMin}`);
  assert.ok(multiTurn.falsePositiveRate <= QUALITY_GATES.multiTurnFprMax, `Multi-turn FPR ${multiTurn.falsePositiveRate} above ${QUALITY_GATES.multiTurnFprMax}`);
}

function assertBrokerLatencyGates(broker: Awaited<ReturnType<typeof runBrokerLatency>>) {
  const byPath = new Map(broker.endpoints.map((endpoint) => [endpoint.path, endpoint]));
  assert.ok((byPath.get("/health")?.p95 ?? Infinity) <= LATENCY_GATES_MS.brokerHealthP95Max, `/health p95 too high`);
  assert.ok((byPath.get("/v1/scan")?.p95 ?? Infinity) <= LATENCY_GATES_MS.brokerScanP95Max, `/v1/scan p95 too high`);
  assert.ok((byPath.get("/v1/decision")?.p95 ?? Infinity) <= LATENCY_GATES_MS.brokerDecisionP95Max, `/v1/decision p95 too high`);
  assert.ok((byPath.get("/v1/redact")?.p95 ?? Infinity) <= LATENCY_GATES_MS.brokerRedactP95Max, `/v1/redact p95 too high`);
}

async function main() {
  const singleTurn = runHonestBenchmark();
  const multiTurn = runMultiTurnBenchmark(MULTI_TURN_SEQUENCES);
  assertQualityGates(singleTurn, multiTurn);

  const broker = await runBrokerLatency();
  assertBrokerLatencyGates(broker);

  const artifact = {
    generatedAtIso: new Date().toISOString(),
    gates: {
      quality: QUALITY_GATES,
      latencyMs: LATENCY_GATES_MS,
    },
    singleTurn,
    multiTurn,
    broker,
    limitations: [
      "Runs deterministic local production classifiers and local broker HTTP endpoints only.",
      "Does not claim third-party benchmark parity, external red-team certification, production traffic replay, or paid provider latency.",
      "Latency numbers are developer-machine local measurements and should be rerun in CI/staging hardware before public SLO claims.",
    ],
  };
  const outPath = path.join(process.cwd(), "scripts", "guard-benchmark", "market-gap-results.json");
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    artifact: outPath,
    checks: [
      `Corpus ${singleTurn.corpus.total} cases (${singleTurn.corpus.attacks} attacks, ${singleTurn.corpus.benign} benign)`,
      `ROC-AUC ${singleTurn.rocAuc.toFixed(4)}`,
      `Recall@1%FPR ${(singleTurn.recallAtFpr.find((item) => item.targetFpr === 0.01)?.recall ?? 0).toFixed(4)}`,
      `Production precision ${singleTurn.production.precision.toFixed(4)} and FPR ${singleTurn.production.falsePositiveRate.toFixed(4)}`,
      `Analyzer p95 ${singleTurn.latencyMs.p95.toFixed(3)}ms, p99 ${singleTurn.latencyMs.p99.toFixed(3)}ms`,
      `Multi-turn recall ${multiTurn.recall.toFixed(4)} with FPR ${multiTurn.falsePositiveRate.toFixed(4)}`,
      `Broker /v1/scan p95 ${(broker.endpoints.find((endpoint) => endpoint.path === "/v1/scan")?.p95 ?? 0).toFixed(3)}ms`,
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
