#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// SoterAI — Public Pages Load Test (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════════
// Measures SSR public pages (no auth) at 1/10/100/500 concurrency.
//
// Usage:
//   node scripts/perf/public-pages-load-test.js
//   LOAD_HTTP_URL=http://localhost:3000 node scripts/perf/public-pages-load-test.js
// ═══════════════════════════════════════════════════════════════════════════════

const { BASE_URL, boundedNumber, summarize, runMeasuredWorkers, statusCounts, printTable } = require("./utils");

const CONCURRENCY_LEVELS = (process.env.LOAD_CONCURRENCY_LEVELS ?? "1,10,100,500")
  .split(",").map((v) => boundedNumber(v.trim(), 1, 1, 1000));
const PER_LEVEL = boundedNumber(process.env.LOAD_ITERATIONS, 500, 20, 20_000);
const MAX_P95_MS = boundedNumber(process.env.LOAD_MAX_P95_MS, 5000, 1, 60_000);
const MAX_ERROR_RATE = boundedNumber(process.env.LOAD_MAX_ERROR_RATE, 0.05, 0, 1);

const PAGES = [
  { path: "/", name: "root" },
  { path: "/docs", name: "docs" },
  { path: "/docs/services", name: "docs-services" },
  { path: "/pricing", name: "pricing" },
  { path: "/blog", name: "blog" },
  { path: "/contact", name: "contact" },
  { path: "/security", name: "security" },
  { path: "/compliance/owasp-llm-top-10", name: "compliance-owasp" },
  { path: "/comparison/lakera", name: "comparison" },
  { path: "/playground", name: "playground" },
];

async function oneRequest(index) {
  const page = PAGES[index % PAGES.length];
  const url = `${BASE_URL}${page.path}`;
  const started = performance.now();
  try {
    const res = await fetch(url, { method: "GET" });
    await res.arrayBuffer();
    return { latencyMs: performance.now() - started, ok: res.ok, status: res.status, page: page.name };
  } catch {
    return { latencyMs: performance.now() - started, ok: false, status: 0, page: page.name };
  }
}

async function preflight() {
  try {
    const res = await fetch(`${BASE_URL}/`);
    if (res.status >= 500) throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    throw new Error(`Cannot reach ${BASE_URL}: ${e.message}. Start the server first.`);
  }
}

async function main() {
  await preflight();
  console.log(`\n=== Public Pages Load Test ===`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Pages: ${PAGES.length}`);
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
    console.error(`\nFAIL: Pages p95 ${worstP95}ms exceeded threshold ${MAX_P95_MS}ms.`);
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
