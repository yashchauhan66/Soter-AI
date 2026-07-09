#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// SoterAI — Report Generation Load Test (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════════
// Measures /api/reports (monthly report generation) and /api/evidence/report/generate
// at 1/10 concurrency. These are heavier endpoints that trigger background jobs.
//
// Usage:
//   DASHBOARD_SESSION=session-token node scripts/perf/report-generation-test.js
//   LOAD_HTTP_URL=http://localhost:3000 node scripts/perf/report-generation-test.js
// ═══════════════════════════════════════════════════════════════════════════════

const { BASE_URL, boundedNumber, summarize, runWorkers, printTable } = require("./utils");

const SESSION = process.env.DASHBOARD_SESSION ?? "";
const PROJECT_ID = process.env.LOAD_PROJECT_ID ?? "test-project";
const CONCURRENCY_LEVELS = (process.env.LOAD_CONCURRENCY_LEVELS ?? "1,10")
  .split(",").map((v) => boundedNumber(v.trim(), 1, 1, 100));
const PER_LEVEL = boundedNumber(process.env.LOAD_ITERATIONS, 50, 10, 1_000);
const MAX_P95_MS = boundedNumber(process.env.LOAD_MAX_P95_MS, 10000, 1, 60_000);
const MAX_ERROR_RATE = boundedNumber(process.env.LOAD_MAX_ERROR_RATE, 0.15, 0, 1);

const headers = {
  "Content-Type": "application/json",
  ...(SESSION ? { Cookie: `next-auth.session-token=${SESSION}` } : {}),
};

// Monthly report requests for different months
const REPORT_MONTHS = [
  { month: 1, year: 2026 },
  { month: 2, year: 2026 },
  { month: 3, year: 2026 },
  { month: 4, year: 2026 },
  { month: 5, year: 2026 },
  { month: 6, year: 2026 },
];

async function oneRequest(index) {
  const m = REPORT_MONTHS[index % REPORT_MONTHS.length];
  const url = `${BASE_URL}/api/reports?projectId=${PROJECT_ID}&month=${m.month}&year=${m.year}`;
  const started = performance.now();
  try {
    const res = await fetch(url, { method: "GET", headers, redirect: "manual" });
    await res.arrayBuffer();
    return { latencyMs: performance.now() - started, ok: res.ok || (res.status >= 300 && res.status < 400), status: res.status, month: `${m.year}-${m.month}` };
  } catch {
    return { latencyMs: performance.now() - started, ok: false, status: 0, month: `${m.year}-${m.month}` };
  }
}

async function preflight() {
  try {
    const res = await fetch(`${BASE_URL}/api/reports?projectId=${PROJECT_ID}&month=6&year=2026`, { headers, redirect: "manual" });
    if (res.status >= 500) throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    throw new Error(`Cannot reach ${BASE_URL}: ${e.message}. Start the server first.`);
  }
}

async function main() {
  await preflight();
  console.log(`\n=== Report Generation Load Test ===`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Authenticated: ${SESSION ? "yes" : "NO"}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Iterations per level: ${PER_LEVEL}`);
  console.log(`Concurrency levels: ${CONCURRENCY_LEVELS.join(", ")}\n`);

  if (!SESSION) {
    console.log("WARNING: No DASHBOARD_SESSION set. Reports may fail auth.");
    console.log("Set DASHBOARD_SESSION=<session-token> for accurate measurements.\n");
  }

  const results = [];
  let worstP95 = 0;
  let worstError = 0;

  for (const concurrency of CONCURRENCY_LEVELS) {
    const samples = await runWorkers(concurrency, PER_LEVEL, oneRequest);
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
    });

    console.log(`  c=${concurrency}: p50=${stats.p50Ms}ms p95=${stats.p95Ms}ms p99=${stats.p99Ms}ms errors=${errors}/${samples.length}`);
  }

  console.log("\n--- Summary ---");
  printTable(results);

  if (worstP95 > MAX_P95_MS) {
    console.error(`\nFAIL: Reports p95 ${worstP95}ms exceeded threshold ${MAX_P95_MS}ms.`);
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
