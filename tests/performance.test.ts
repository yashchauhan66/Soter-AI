import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeRiskCounts } from "../lib/dashboard/metrics";
import { normalizeProductionMetricSummary } from "../lib/phase8/productionMetrics";

test("dashboard risk counts normalize database bigint values", () => {
  assert.deepEqual(
    normalizeRiskCounts([
      { label: "PROMPT_INJECTION", value: BigInt(12) },
      { label: "SECRET_DETECTED", value: 3 },
    ]),
    [
      { label: "PROMPT_INJECTION", value: 12 },
      { label: "SECRET_DETECTED", value: 3 },
    ],
  );
});

test("dashboard top-risk chart uses bounded database aggregation without content fields", () => {
  const dashboardSource = readFileSync("app/dashboard/page.tsx", "utf8");
  const metricsSource = readFileSync("lib/dashboard/metrics.ts", "utf8");

  assert.match(dashboardSource, /getTopRiskTypes\(project\.id, monthStart\)/);
  assert.doesNotMatch(dashboardSource, /take:\s*2_000/);
  assert.match(metricsSource, /unnest\("riskTypes"\)/);
  assert.match(metricsSource, /GROUP BY risk_type/);
  assert.match(metricsSource, /LIMIT \$\{boundedLimit\}/);
  assert.doesNotMatch(metricsSource, /originalText|redactedText|safeText/);
});

test("production metric summary normalizes database aggregate rows", () => {
  assert.deepEqual(
    normalizeProductionMetricSummary([
      { metric: "guard_api_latency_ms", sampleCount: BigInt(10), p50: 50, p95: 95 },
      { metric: "dashboard_latency_ms", sampleCount: 4, p50: 20, p95: 40 },
      { metric: "request_total", sampleCount: BigInt(100), p50: 1, p95: 1 },
      { metric: "request_error", sampleCount: 3, p50: 1, p95: 1 },
    ]),
    {
      guardApiP50: 50,
      guardApiP95: 95,
      dashboardP95: 40,
      requestCount: 100,
      errorCount: 3,
    },
  );
});

test("production monitoring page uses database aggregates instead of loading metric rows", () => {
  const pageSource = readFileSync("app/admin/production/page.tsx", "utf8");
  const metricsSource = readFileSync("lib/phase8/productionMetrics.ts", "utf8");

  assert.match(pageSource, /getProductionMetricSummary\(since\)/);
  assert.doesNotMatch(pageSource, /productionMetric\.findMany/);
  assert.doesNotMatch(pageSource, /take:\s*10_?000/);
  assert.match(metricsSource, /percentile_cont\(0\.5\)/);
  assert.match(metricsSource, /percentile_cont\(0\.95\)/);
  assert.match(metricsSource, /COUNT\(\*\)::bigint AS "sampleCount"/);
  assert.match(metricsSource, /GROUP BY "metric"/);
});

test("admin and enterprise queues use cursor pagination with bounded selects", () => {
  const sources = [
    "app/admin/support/page.tsx",
    "app/api/phase8/support/route.ts",
    "app/admin/detection-quality/page.tsx",
    "app/admin/organizations/page.tsx",
    "app/admin/projects/page.tsx",
    "app/dashboard/enterprise/audit/page.tsx",
    "app/dashboard/support/page.tsx",
  ].map((path) => [path, readFileSync(path, "utf8")] as const);

  for (const [path, source] of sources) {
    assert.match(source, /parseCursorDate|new URL\(request\.url\)\.searchParams/, path);
    assert.match(source, /take:\s*[A-Z_]+PAGE_SIZE \+ 1|take:\s*limit \+ 1/, path);
    assert.match(source, /select:\s*{/, path);
    assert.doesNotMatch(source, /take:\s*(?:100|250)\b/, path);
    assert.doesNotMatch(source, /include:\s*{/, path);
  }
});

test("siem worker has health, overlap guard, bounded interval, and graceful shutdown", () => {
  const workerSource = readFileSync("workers/siemWorker.ts", "utf8");
  const envRequirements = readFileSync("docs/final-audit/env-requirements.md", "utf8");
  const envExample = readFileSync(".env.example", "utf8");

  assert.match(workerSource, /createServer/);
  assert.match(workerSource, /SIEM_WORKER_HEALTH_PORT/);
  assert.match(workerSource, /Math\.min\(60_000, Math\.max\(1_000/);
  assert.match(workerSource, /if \(running \|\| stopping\) return/);
  assert.match(workerSource, /lastHeartbeat/);
  assert.match(workerSource, /process\.on\("SIGINT"/);
  assert.match(workerSource, /process\.on\("SIGTERM"/);
  assert.match(workerSource, /db\.\$disconnect\(\)/);
  assert.match(envRequirements, /SIEM_WORKER_HEALTH_PORT/);
  assert.match(envExample, /SIEM_WORKER_HEALTH_PORT="3097"/);
});
