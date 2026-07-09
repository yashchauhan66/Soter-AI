#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// SoterAI — Dashboard Load Test (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════════
// Measures authenticated dashboard pages at 1/10/100 concurrency.
// Requires a valid session cookie (set DASHBOARD_SESSION env var).
//
// Usage:
//   DASHBOARD_SESSION=session-token node scripts/perf/dashboard-load-test.js
//   LOAD_HTTP_URL=http://localhost:3000 node scripts/perf/dashboard-load-test.js
// ═══════════════════════════════════════════════════════════════════════════════

const { BASE_URL, boundedNumber, summarize, runWorkers, printTable } = require("./utils");

const SESSION = process.env.DASHBOARD_SESSION ?? "";
const CONCURRENCY_LEVELS = (process.env.LOAD_CONCURRENCY_LEVELS ?? "1,10,100")
  .split(",").map((v) => boundedNumber(v.trim(), 1, 1, 500));
const PER_LEVEL = boundedNumber(process.env.LOAD_ITERATIONS, 100, 10, 5_000);
const MAX_P95_MS = boundedNumber(process.env.LOAD_MAX_P95_MS, 5000, 1, 60_000);
const MAX_ERROR_RATE = boundedNumber(process.env.LOAD_MAX_ERROR_RATE, 0.10, 0, 1);

const DASHBOARD_PAGES = [
  { path: "/dashboard", name: "dashboard-home" },
  { path: "/dashboard/projects", name: "projects" },
  { path: "/dashboard/logs", name: "logs" },
  { path: "/dashboard/billing", name: "billing" },
  { path: "/dashboard/api-keys", name: "api-keys" },
  { path: "/dashboard/reports", name: "reports" },
  { path: "/dashboard/agent-firewall", name: "agent-firewall" },
  { path: "/dashboard/evidence-vault", name: "evidence-vault" },
];

const headers = SESSION
  ? { Cookie: `next-auth.session-token=${SESSION}` }
  : {};

async function oneRequest(index) {
  const page = DASHBOARD_PAGES[index % DASHBOARD_PAGES.length];
  const url = `${BASE_URL}${page.path}`;
  const started = performance.now();
  try {
    const res = await fetch(url, { method: "GET", headers, redirect: "manual" });
    await res.arrayBuffer();
    return { latencyMs: performance.now() - started, ok: res.ok || (res.status >= 300 && res.status < 400), status: res.status, page: page.name };
  } catch {
    return { latencyMs: performance.now() - started, ok: false, status: 0, page: page.name };
  }
}

async function preflight() {
  try {
    const res = await fetch(`${BASE_URL}/dashboard`, { headers, redirect: "manual" });
    // 302/307 redirect to login is expected without session
    if (res.status >= 500) throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    throw new Error(`Cannot reach ${BASE_URL}: ${e.message}. Start the server first.`);
  }
}

async function main() {
  await preflight();
  console.log(`\n=== Dashboard Load Test ===`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Authenticated: ${SESSION ? "yes" : "NO (results will show 302 redirects)"}`);
  console.log(`Pages: ${DASHBOARD_PAGES.length}`);
  console.log(`Iterations per level: ${PER_LEVEL}`);
  console.log(`Concurrency levels: ${CONCURRENCY_LEVELS.join(", ")}\n`);

  if (!SESSION) {
    console.log("WARNING: No DASHBOARD_SESSION set. Dashboard pages will redirect to login (302).");
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
    console.error(`\nFAIL: Dashboard p95 ${worstP95}ms exceeded threshold ${MAX_P95_MS}ms.`);
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
