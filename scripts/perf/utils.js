// Shared utilities for Phase 5 load-test scripts.

const os = require("node:os");

const BASE_URL = process.env.LOAD_HTTP_URL ?? "http://localhost:3000";

function requireDashboardHeaders() {
  const rawCookie = process.env.DASHBOARD_COOKIE?.trim();
  const legacyToken = process.env.DASHBOARD_SESSION?.trim();
  const cookie = rawCookie || (legacyToken ? `authjs.session-token=${legacyToken}` : "");
  if (!cookie) {
    throw new Error(
      "Authenticated load test requires DASHBOARD_COOKIE with the complete Cookie header value. " +
      "Unauthenticated redirects are not performance evidence.",
    );
  }
  return { Cookie: cookie };
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

function summarize(label, durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  const mean = durations.reduce((s, v) => s + v, 0) / durations.length;
  return {
    label,
    n: durations.length,
    meanMs: +mean.toFixed(2),
    p50Ms: +percentile(sorted, 0.5).toFixed(2),
    p95Ms: +percentile(sorted, 0.95).toFixed(2),
    p99Ms: +percentile(sorted, 0.99).toFixed(2),
    maxMs: +Math.max(...durations).toFixed(2),
  };
}

async function runWorkers(concurrency, iterations, fn) {
  if (iterations < concurrency) {
    throw new Error(
      `LOAD_ITERATIONS (${iterations}) must be >= concurrency (${concurrency}); ` +
      "otherwise the requested concurrency cannot be reached.",
    );
  }
  const samples = [];
  let next = 0;
  async function worker() {
    while (next < iterations) {
      const i = next++;
      samples.push(await fn(i));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return samples;
}

async function runMeasuredWorkers(concurrency, iterations, fn) {
  const cpuStart = process.cpuUsage();
  const wallStart = performance.now();
  let peakDriverRss = process.memoryUsage().rss;
  const memoryTimer = setInterval(() => {
    peakDriverRss = Math.max(peakDriverRss, process.memoryUsage().rss);
  }, 25);

  try {
    const samples = await runWorkers(concurrency, iterations, fn);
    const wallMs = performance.now() - wallStart;
    const cpu = process.cpuUsage(cpuStart);
    const cpuMs = (cpu.user + cpu.system) / 1000;
    return {
      samples,
      wallMs,
      throughputRps: +(samples.length / (wallMs / 1000)).toFixed(2),
      driverCpuPercent: +((cpuMs / wallMs) * 100).toFixed(2),
      peakDriverRssMb: +(peakDriverRss / 1024 / 1024).toFixed(2),
      systemLoad1m: +os.loadavg()[0].toFixed(2),
      systemFreeMemoryMb: +(os.freemem() / 1024 / 1024).toFixed(2),
    };
  } finally {
    clearInterval(memoryTimer);
  }
}

function statusCounts(samples) {
  const counts = {};
  for (const sample of samples) counts[sample.status] = (counts[sample.status] ?? 0) + 1;
  return Object.entries(counts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([status, count]) => `${status}:${count}`)
    .join(",");
}

function printTable(rows) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) => k.length);
  for (const row of rows) {
    for (let i = 0; i < keys.length; i++) {
      widths[i] = Math.max(widths[i], String(row[keys[i]]).length);
    }
  }
  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  console.log(header);
  console.log(sep);
  for (const row of rows) {
    console.log(keys.map((k, i) => String(row[keys[i]]).padEnd(widths[i])).join("  "));
  }
}

function jsonReport(endpoint, concurrencyLevel, results, thresholds) {
  const report = { endpoint, concurrencyLevels: concurrencyLevel, thresholds, results };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

module.exports = {
  BASE_URL,
  requireDashboardHeaders,
  boundedNumber,
  percentile,
  summarize,
  runWorkers,
  runMeasuredWorkers,
  statusCounts,
  printTable,
  jsonReport,
};
