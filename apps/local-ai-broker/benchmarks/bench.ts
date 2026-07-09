/**
 * Local AI Broker -- HTTP benchmark suite
 *
 * Measures latency percentiles (p50/p95/p99) for core endpoints,
 * tests concurrency scaling, validates rate-limit behavior, and
 * tracks memory usage.
 *
 * Usage:
 *   npx tsx apps/local-ai-broker/benchmarks/bench.ts
 *
 * Exit code 1 when /health p95 > 10 ms  OR  /v1/scan p95 > 30 ms.
 */

import { performance } from "node:perf_hooks";
import { BrokerServer } from "../src/BrokerServer";
import { generateBrokerToken } from "../src/auth";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ITERATIONS = 200; // requests per endpoint per concurrency level
const CONCURRENCY_LEVELS = [1, 5, 10, 25];
const PAYLOAD_SIZE = 10 * 1024; // 10 KB

// Thresholds (ms) -- exit 1 if exceeded
const HEALTH_P95_LIMIT = 10;
const SCAN_P95_LIMIT = 30;

// Rate-limit test fires this many requests in a burst
const RATE_LIMIT_BURST = 150; // default limit is 120/min

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPayload(bytes: number): string {
  // Deterministic filler text that looks realistic enough for scanning
  const base =
    "The quick brown fox jumps over the lazy dog. " +
    "Please summarize the following confidential document. " +
    "SSN: 123-45-6789 email: test@example.com ";
  let out = "";
  while (Buffer.byteLength(out, "utf8") < bytes) {
    out += base;
  }
  return out.slice(0, bytes);
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

interface LatencyResult {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  count: number;
}

function summarize(durations: number[]): LatencyResult {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    count: sorted.length,
  };
}

function fmtMs(v: number): string {
  return v.toFixed(2).padStart(9) + " ms";
}

function fmtMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function printTable(
  label: string,
  rows: { name: string; result: LatencyResult }[],
): void {
  console.log(`\n${"=".repeat(90)}`);
  console.log(`  ${label}`);
  console.log("=".repeat(90));
  console.log(
    "  Endpoint".padEnd(28) +
      "  p50".padStart(12) +
      "  p95".padStart(12) +
      "  p99".padStart(12) +
      "  min".padStart(12) +
      "  max".padStart(12) +
      "  N".padStart(6),
  );
  console.log("-".repeat(90));
  for (const { name, result } of rows) {
    console.log(
      `  ${name.padEnd(26)}` +
        fmtMs(result.p50) +
        fmtMs(result.p95) +
        fmtMs(result.p99) +
        fmtMs(result.min) +
        fmtMs(result.max) +
        String(result.count).padStart(6),
    );
  }
}

// ---------------------------------------------------------------------------
// Request runners
// ---------------------------------------------------------------------------

async function timeRequest(
  url: string,
  init: RequestInit,
): Promise<{ durationMs: number; status: number }> {
  const t0 = performance.now();
  const res = await fetch(url, init);
  // Consume body to ensure the connection is fully measured
  await res.text();
  const t1 = performance.now();
  return { durationMs: t1 - t0, status: res.status };
}

async function runSequential(
  url: string,
  init: RequestInit,
  n: number,
): Promise<number[]> {
  const durations: number[] = [];
  for (let i = 0; i < n; i++) {
    const { durationMs } = await timeRequest(url, init);
    durations.push(durationMs);
  }
  return durations;
}

async function runConcurrent(
  url: string,
  init: RequestInit,
  total: number,
  concurrency: number,
): Promise<number[]> {
  const durations: number[] = [];
  let pending = total;
  const worker = async () => {
    while (pending > 0) {
      pending--;
      const { durationMs } = await timeRequest(url, init);
      durations.push(durationMs);
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, total) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return durations;
}

// ---------------------------------------------------------------------------
// Benchmark definitions
// ---------------------------------------------------------------------------

interface EndpointDef {
  name: string;
  method: string;
  path: string;
  body?: string;
  needsAuth: boolean;
}

const ENDPOINTS: EndpointDef[] = [
  { name: "GET /health", method: "GET", path: "/health", needsAuth: false },
  {
    name: "POST /v1/scan",
    method: "POST",
    path: "/v1/scan",
    body: JSON.stringify({ content: buildPayload(PAYLOAD_SIZE) }),
    needsAuth: true,
  },
  {
    name: "POST /v1/redact",
    method: "POST",
    path: "/v1/redact",
    body: JSON.stringify({ content: buildPayload(PAYLOAD_SIZE) }),
    needsAuth: true,
  },
  {
    name: "POST /v1/decision",
    method: "POST",
    path: "/v1/decision",
    body: JSON.stringify({ content: buildPayload(PAYLOAD_SIZE) }),
    needsAuth: true,
  },
];

function buildInit(
  ep: EndpointDef,
  token: string,
): RequestInit {
  const headers: Record<string, string> = {};
  if (ep.needsAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (ep.body) {
    headers["Content-Type"] = "application/json";
  }
  return {
    method: ep.method,
    headers,
    body: ep.body ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Rate-limit test
// ---------------------------------------------------------------------------

async function testRateLimit(
  baseUrl: string,
  token: string,
  limitPerMinute: number,
): Promise<void> {
  console.log(`\n${"=".repeat(90)}`);
  console.log("  Rate-limit behavior test");
  console.log("=".repeat(90));
  console.log(
    `  Sending ${RATE_LIMIT_BURST} rapid requests (limit is ${limitPerMinute}/min)...`,
  );

  let okCount = 0;
  let rateLimitedCount = 0;
  let otherCount = 0;

  const promises = Array.from({ length: RATE_LIMIT_BURST }, () =>
    fetch(`${baseUrl}/health`).then((r) => {
      if (r.status === 200) okCount++;
      else if (r.status === 429) rateLimitedCount++;
      else otherCount++;
      return r.text(); // consume body
    }),
  );
  await Promise.all(promises);

  console.log(`  200 OK       : ${okCount}`);
  console.log(`  429 Limited  : ${rateLimitedCount}`);
  if (otherCount > 0) console.log(`  Other        : ${otherCount}`);

  if (rateLimitedCount > 0) {
    console.log("  [PASS] Rate limiter triggered as expected.");
  } else {
    console.log(
      "  [WARN] No 429 responses observed -- rate limit may be higher than burst size.",
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const token = generateBrokerToken();
  const rateLimitPerMinute = 120;

  console.log("Local AI Broker Benchmark");
  console.log("=".repeat(90));
  console.log(`  Iterations per endpoint   : ${ITERATIONS}`);
  console.log(`  Payload size              : ${(PAYLOAD_SIZE / 1024).toFixed(0)} KB`);
  console.log(`  Concurrency levels        : ${CONCURRENCY_LEVELS.join(", ")}`);
  console.log(`  Thresholds                : /health p95 < ${HEALTH_P95_LIMIT} ms, /v1/scan p95 < ${SCAN_P95_LIMIT} ms`);

  // -- Memory baseline -------------------------------------------------------
  const memStart = process.memoryUsage();
  console.log(
    `\n  Memory at start           : RSS ${fmtMB(memStart.rss)}, Heap ${fmtMB(memStart.heapUsed)}`,
  );

  // -- Start server -----------------------------------------------------------
  const server = new BrokerServer({
    token,
    port: 0, // OS-assigned ephemeral port
    rateLimitPerMinute,
  });
  const { url: baseUrl } = await server.start();
  console.log(`  Server listening at       : ${baseUrl}`);

  // -- Warm-up (discard results) ---------------------------------------------
  console.log("\n  Warming up...");
  for (const ep of ENDPOINTS) {
    const init = buildInit(ep, token);
    await runSequential(`${baseUrl}${ep.path}`, init, 10);
  }

  // -- Per-concurrency benchmarks --------------------------------------------
  const allResults: Map<string, LatencyResult> = new Map();

  for (const concurrency of CONCURRENCY_LEVELS) {
    const rows: { name: string; result: LatencyResult }[] = [];

    for (const ep of ENDPOINTS) {
      const init = buildInit(ep, token);
      const durations = await runConcurrent(
        `${baseUrl}${ep.path}`,
        init,
        ITERATIONS,
        concurrency,
      );
      const result = summarize(durations);
      rows.push({ name: ep.name, result });

      // Store concurrency-1 results for threshold checks
      if (concurrency === 1) {
        allResults.set(ep.name, result);
      }
    }

    printTable(`Concurrency = ${concurrency}`, rows);
  }

  // -- Rate-limit test -------------------------------------------------------
  await testRateLimit(baseUrl, token, rateLimitPerMinute);

  // -- Memory at end ----------------------------------------------------------
  const memEnd = process.memoryUsage();
  console.log(`\n${"=".repeat(90)}`);
  console.log("  Memory usage");
  console.log("=".repeat(90));
  console.log(
    `  Start  : RSS ${fmtMB(memStart.rss)}, Heap Used ${fmtMB(memStart.heapUsed)}`,
  );
  console.log(
    `  End    : RSS ${fmtMB(memEnd.rss)}, Heap Used ${fmtMB(memEnd.heapUsed)}`,
  );
  console.log(
    `  Delta  : RSS ${fmtMB(memEnd.rss - memStart.rss)}, Heap Used ${fmtMB(memEnd.heapUsed - memStart.heapUsed)}`,
  );

  // -- Cleanup ----------------------------------------------------------------
  await server.stop();
  console.log("\n  Server stopped.");

  // -- Threshold checks -------------------------------------------------------
  let failed = false;
  const healthResult = allResults.get("GET /health");
  const scanResult = allResults.get("POST /v1/scan");

  console.log(`\n${"=".repeat(90)}`);
  console.log("  Threshold checks (concurrency = 1)");
  console.log("=".repeat(90));

  if (healthResult) {
    const pass = healthResult.p95 <= HEALTH_P95_LIMIT;
    console.log(
      `  /health  p95 ${fmtMs(healthResult.p95).trim()}  limit ${fmtMs(HEALTH_P95_LIMIT).trim()}  ${pass ? "[PASS]" : "[FAIL]"}`,
    );
    if (!pass) failed = true;
  }

  if (scanResult) {
    const pass = scanResult.p95 <= SCAN_P95_LIMIT;
    console.log(
      `  /v1/scan p95 ${fmtMs(scanResult.p95).trim()}  limit ${fmtMs(SCAN_P95_LIMIT).trim()}  ${pass ? "[PASS]" : "[FAIL]"}`,
    );
    if (!pass) failed = true;
  }

  if (failed) {
    console.log("\n  BENCHMARK FAILED -- one or more thresholds exceeded.\n");
    process.exit(1);
  } else {
    console.log("\n  All thresholds passed.\n");
  }
}

main().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
