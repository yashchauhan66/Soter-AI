// Shared utilities for Phase 5 load-test scripts.
// Usage: import { percentile, boundedNumber, runWorkers, printTable } from "./utils.js";

const BASE_URL = process.env.LOAD_HTTP_URL ?? "http://localhost:3000";

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

module.exports = { BASE_URL, boundedNumber, percentile, summarize, runWorkers, printTable, jsonReport };
