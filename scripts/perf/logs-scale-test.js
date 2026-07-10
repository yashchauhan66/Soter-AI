#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// SoterAI — Logs Scale Test (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════════
// Measures /api/logs endpoint with various filter combinations at 1/10/100/500 concurrency.
// Requires a complete valid Cookie header (set DASHBOARD_COOKIE).
//
// Usage:
//   DASHBOARD_COOKIE="authjs.session-token=..." node scripts/perf/logs-scale-test.js
//   LOAD_HTTP_URL=http://localhost:3000 node scripts/perf/logs-scale-test.js
// ═══════════════════════════════════════════════════════════════════════════════

const { BASE_URL, boundedNumber, summarize, runMeasuredWorkers, statusCounts, printTable, requireDashboardHeaders } = require("./utils");

const CONCURRENCY_LEVELS = (process.env.LOAD_CONCURRENCY_LEVELS ?? "1,10,100,500")
  .split(",").map((v) => boundedNumber(v.trim(), 1, 1, 1000));
const PER_LEVEL = boundedNumber(process.env.LOAD_ITERATIONS, 500, 10, 5_000);
const MAX_P95_MS = boundedNumber(process.env.LOAD_MAX_P95_MS, 5000, 1, 60_000);
const MAX_ERROR_RATE = boundedNumber(process.env.LOAD_MAX_ERROR_RATE, 0.10, 0, 1);

const headers = requireDashboardHeaders();

// Different query shapes to exercise pagination and filtering
const LOG_QUERIES = [
  { name: "unfiltered", params: "" },
  { name: "page2", params: "?cursor=2026-06-01T00:00:00.000Z" },
  { name: "risk-filter", params: "?riskType=PROMPT_INJECTION" },
  { name: "action-filter", params: "?action=BLOCK" },
  { name: "combined", params: "?riskType=JAILBREAK&action=BLOCK&cursor=2026-06-01T00:00:00.000Z" },
];

async function oneRequest(index) {
  const query = LOG_QUERIES[index % LOG_QUERIES.length];
  const url = `${BASE_URL}/api/logs${query.params}`;
  const started = performance.now();
  try {
    const res = await fetch(url, { method: "GET", headers, redirect: "manual" });
    const body = res.status === 200 ? await res.json().catch(() => null) : null;
    return { latencyMs: performance.now() - started, ok: res.status === 200 && Array.isArray(body?.logs), status: res.status, query: query.name };
  } catch {
    return { latencyMs: performance.now() - started, ok: false, status: 0, query: query.name };
  }
}

async function preflight() {
  try {
    const res = await fetch(`${BASE_URL}/api/logs`, { headers, redirect: "manual" });
    const body = res.status === 200 ? await res.json().catch(() => null) : null;
    if (res.status !== 200 || !Array.isArray(body?.logs)) {
      throw new Error(`Authentication/data preflight failed with ${res.status}; refresh DASHBOARD_COOKIE`);
    }
  } catch (e) {
    throw new Error(`Cannot reach ${BASE_URL}: ${e.message}. Start the server first.`);
  }
}

async function main() {
  await preflight();
  console.log(`\n=== Logs Scale Test ===`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log("Authenticated data path: yes (preflight verified)");
  console.log(`Query shapes: ${LOG_QUERIES.length}`);
  console.log(`Iterations per level: ${PER_LEVEL}`);
  console.log(`Concurrency levels: ${CONCURRENCY_LEVELS.join(", ")}\n`);

  const results = [];
  let worstP95 = 0;
  let worstError = 0;

  for (const concurrency of CONCURRENCY_LEVELS) {
    const measured = await runMeasuredWorkers(concurrency, PER_LEVEL, oneRequest);
    const { samples } = measured;
    const latencies = samples.map((s) => s.latencyMs);
    const errors = samples.filter((s) => !s.ok).length;
    const errorRate = errors / samples.length;
    const stats = summarize(`c=${concurrency}`, latencies);
    worstP95 = Math.max(worstP95, stats.p95Ms);
    worstError = Math.max(worstError, errorRate);

    results.push({
      concurrency,
      iterations: samples.length,
      ...stats,
      errors,
      errorRate: +(errorRate * 100).toFixed(2),
      throughputRps: measured.throughputRps,
      driverCpuPercent: measured.driverCpuPercent,
      peakDriverRssMb: measured.peakDriverRssMb,
      statuses: statusCounts(samples),
    });

    console.log(`  c=${concurrency}: p50=${stats.p50Ms}ms p95=${stats.p95Ms}ms p99=${stats.p99Ms}ms rps=${measured.throughputRps} errors=${errors}/${samples.length}`);
  }

  console.log("\n--- Summary ---");
  printTable(results);

  if (worstP95 > MAX_P95_MS) {
    console.error(`\nFAIL: Logs p95 ${worstP95}ms exceeded threshold ${MAX_P95_MS}ms.`);
    process.exitCode = 1;
  }
  if (worstError > MAX_ERROR_RATE) {
    console.error(`\nFAIL: Error rate ${(worstError * 100).toFixed(2)}% exceeded threshold ${(MAX_ERROR_RATE * 100)}%.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
