/**
 * Comprehensive Benchmark Runner
 *
 * Tests every prompt in BENCHMARK_CASES against the Soter input guard.
 * For prompts where expectBlock=false and they pass, also tests the output guard.
 * Measures per-prompt latency and generates a summary.
 *
 * Usage: npx tsx src/run-benchmark.ts
 */

import { soter } from "./guard";
import {
  BENCHMARK_CASES,
  BENCHMARK_CATEGORIES,
  summarizeResults,
  BenchResult,
  BenchSummary,
} from "./benchmark-prompts";
import fs from "fs";
import path from "path";

async function runBenchmark(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];
  const total = BENCHMARK_CASES.length;

  // Wait for rate limit bucket to reset from any previous runs
  await new Promise((r) => setTimeout(r, 2000));

  for (let i = 0; i < total; i++) {
    const c = BENCHMARK_CASES[i];
    // Small delay between tests to avoid rate limiting (60 RPM limit)
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));
    process.stdout.write(`[${i + 1}/${total}] ${c.category}: ${c.label}... `);

    try {
      // ── Input guard test ──
      const inputStart = Date.now();
      const inputResult = await soter.protect({ input: c.message });
      const inputLatencyMs = Date.now() - inputStart;

      const action = inputResult.action ?? "UNKNOWN";
      const isBlocked = action === "BLOCK" || action === "HUMAN_REVIEW";
      const inputPass = c.expectBlock ? isBlocked : !isBlocked;

      // ── Output guard test (only if input was processed successfully) ──
      let outputLatencyMs = 0;
      let outputAction = "";
      try {
        const outputStart = Date.now();
        const outputResult = await soter.guardOutput({
          aiResponse: c.message,
        });
        outputLatencyMs = Date.now() - outputStart;
        outputAction = outputResult.action ?? "";
      } catch {
        // output guard test is best-effort
      }

      const totalLatencyMs = inputLatencyMs + outputLatencyMs;

      const result: BenchResult = {
        id: c.id,
        category: c.category,
        label: c.label,
        input: c.message.slice(0, 60),
        expectBlock: c.expectBlock,
        pass: inputPass,
        action,
        riskScore: inputResult.riskScore ?? 0,
        riskTypes: inputResult.riskTypes ?? [],
        latencyMs: totalLatencyMs,
        inputLatencyMs,
        outputLatencyMs,
      };

      results.push(result);
      process.stdout.write(`${inputPass ? "✅ PASS" : "❌ FAIL"} (${inputLatencyMs}ms, ${action})\n`);
    } catch (err: any) {
      process.stdout.write(`❌ ERROR: ${err.message?.slice(0, 80)}\n`);
      results.push({
        id: c.id,
        category: c.category,
        label: c.label,
        input: c.message.slice(0, 60),
        expectBlock: c.expectBlock,
        pass: false,
        action: "ERROR",
        riskScore: 0,
        riskTypes: [],
        latencyMs: 0,
        inputLatencyMs: 0,
        outputLatencyMs: 0,
        error: err.message?.slice(0, 200),
      });
    }
  }

  return results;
}

function generateReport(results: BenchResult[], summary: BenchSummary): string {
  const now = new Date().toISOString();

  // ── HTML Report ──
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SoterAI Guard Benchmark Report</title>
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --green: #22c55e; --red: #ef4444; --amber: #f59e0b; --blue: #3b82f6; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    .subtitle { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
    .stat-card .value { font-size: 32px; font-weight: 700; }
    .stat-card .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    .pass { color: var(--green); }
    .fail { color: var(--red); }
    .neutral { color: var(--blue); }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; background: var(--card); border-bottom: 2px solid var(--border); font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: var(--muted); }
    td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
    tr:hover td { background: rgba(255,255,255,0.03); }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-allow { background: rgba(34,197,94,0.15); color: var(--green); }
    .badge-block { background: rgba(239,68,68,0.15); color: var(--red); }
    .badge-redact { background: rgba(245,158,11,0.15); color: var(--amber); }
    .badge-human { background: rgba(59,130,246,0.15); color: var(--blue); }
    .badge-error { background: rgba(239,68,68,0.25); color: var(--red); }
    .section-title { font-size: 18px; font-weight: 600; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .bar-container { display: flex; align-items: center; gap: 8px; }
    .bar { height: 20px; border-radius: 4px; min-width: 2px; }
    .latency-bar { background: var(--blue); }
    .latency-text { font-size: 12px; color: var(--muted); min-width: 60px; text-align: right; }
  </style>
</head>
<body>
<div class="container">
  <h1>🛡️ SoterAI Guard — Full Benchmark Report</h1>
  <p class="subtitle">Generated: ${now} · ${summary.total} test cases · ${summary.passed} passed · ${summary.failed} failed</p>

  <div class="stats-grid">
    <div class="stat-card"><div class="value ${summary.passed === summary.total ? 'pass' : 'neutral'}">${summary.total}</div><div class="label">Total Tests</div></div>
    <div class="stat-card"><div class="value pass">${summary.passed}</div><div class="label">Passed</div></div>
    <div class="stat-card"><div class="value fail">${summary.failed}</div><div class="label">Failed</div></div>
    <div class="stat-card"><div class="value neutral">${summary.passRate}</div><div class="label">Pass Rate</div></div>
    <div class="stat-card"><div class="value neutral">${summary.avgInputLatency}ms</div><div class="label">Avg Input Latency</div></div>
    <div class="stat-card"><div class="value neutral">${summary.avgOutputLatency}ms</div><div class="label">Avg Output Latency</div></div>
  </div>

  <h2 class="section-title">📊 Results by Category</h2>
  <table>
    <thead><tr><th>Category</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Latency</th></tr></thead>
    <tbody>
      ${summary.categoryStats.map((cs) => `
        <tr>
          <td><strong>${cs.category}</strong></td>
          <td>${cs.total}</td>
          <td class="pass">${cs.passed}</td>
          <td class="fail">${cs.failed}</td>
          <td>${cs.total > 0 ? ((cs.passed / cs.total) * 100).toFixed(1) + "%" : "N/A"}</td>
          <td>${cs.avgLatency}ms</td>
        </tr>`).join("")}
    </tbody>
  </table>

  <h2 class="section-title">📋 All Results</h2>
  <table>
    <thead><tr><th>ID</th><th>Category</th><th>Label</th><th>Input (truncated)</th><th>Expected</th><th>Actual</th><th>Score</th><th>Latency</th><th>Result</th></tr></thead>
    <tbody>
      ${results.map((r) => {
        const actionBadge = r.action === "ALLOW" ? "badge-allow" : r.action === "ALLOW_WITH_REDACTION" ? "badge-redact" : r.action === "BLOCK" ? "badge-block" : r.action === "HUMAN_REVIEW" ? "badge-human" : "badge-error";
        return `<tr>
          <td><code>${r.id}</code></td>
          <td>${r.category}</td>
          <td>${r.label}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.input.slice(0, 50)}</td>
          <td>${r.expectBlock ? "🚫 Block" : "✅ Allow"}</td>
          <td><span class="badge ${actionBadge}">${r.action}</span></td>
          <td>${r.riskScore}</td>
          <td>${r.latencyMs > 0 ? r.latencyMs + "ms" : "-"}</td>
          <td class="${r.pass ? 'pass' : 'fail'}"><strong>${r.pass ? "✅ PASS" : "❌ FAIL"}</strong>${r.error ? `: ${r.error.slice(0, 60)}` : ""}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
</div>
</body>
</html>`;

  // ── Markdown Summary ──
  const md = `# SoterAI Guard — Comprehensive Benchmark Report

**Date:** ${now}
**Total Tests:** ${summary.total}
**Passed:** ${summary.passed} | **Failed:** ${summary.failed}
**Pass Rate:** ${summary.passRate}

## Latency Metrics

| Metric | Value |
|--------|-------|
| Average Total Latency | ${summary.avgLatency}ms |
| Average Input Latency | ${summary.avgInputLatency}ms |
| Average Output Latency | ${summary.avgOutputLatency}ms |

## Results by Category

| Category | Total | Passed | Failed | Pass Rate | Avg Latency |
|----------|:-----:|:-----:|:-----:|:---------:|:-----------:|
${summary.categoryStats.map((cs) => `| ${cs.category} | ${cs.total} | ${cs.passed} | ${cs.failed} | ${cs.total > 0 ? ((cs.passed / cs.total) * 100).toFixed(1) + "%" : "N/A"} | ${cs.avgLatency}ms |`).join("\n")}

## Detailed Results

| ID | Category | Label | Expected | Actual | Score | Latency | Result |
|:---|:---------|:------|:---------|:-------|:-----:|:------:|:------:|
${results.map((r) => `| ${r.id} | ${r.category} | ${r.label} | ${r.expectBlock ? "BLOCK" : "ALLOW"} | ${r.action} | ${r.riskScore} | ${r.latencyMs > 0 ? r.latencyMs + "ms" : "-"} | ${r.pass ? "✅ PASS" : "❌ FAIL"}${r.error ? `: ${r.error}` : ""} |`).join("\n")}
`;

  return html + "\n\n---\n\n" + md;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  SoterAI Guard — Comprehensive Benchmark");
  console.log("=".repeat(60));
  console.log(`  Total prompts: ${BENCHMARK_CASES.length}`);
  console.log(`  Categories: ${BENCHMARK_CATEGORIES.join(", ")}`);
  console.log("=".repeat(60));
  console.log();

  const start = Date.now();
  const results = await runBenchmark();
  const totalTime = ((Date.now() - start) / 1000).toFixed(1);

  const summary = summarizeResults(results);

  console.log();
  console.log("=".repeat(60));
  console.log("  BENCHMARK COMPLETE");
  console.log(`  Time: ${totalTime}s`);
  console.log(`  ${summary.passed}/${summary.total} passed (${summary.passRate})`);
  console.log("=".repeat(60));

  // ── Save JSON ──
  const reportDir = path.resolve(__dirname, "../../../docs/testing/benchmark");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "benchmark-results.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, results }, null, 2), "utf-8");
  console.log(`\n📄 JSON: ${jsonPath}`);

  // ── Save HTML + MD report ──
  const report = generateReport(results, summary);
  const htmlPath = path.join(reportDir, "benchmark-report.html");
  fs.writeFileSync(htmlPath, report, "utf-8");
  console.log(`📄 HTML: ${htmlPath}`);

  const mdPath = path.join(reportDir, "benchmark-report.md");
  fs.writeFileSync(mdPath, report.split("\n\n---\n\n")[1], "utf-8");
  console.log(`📄 MD:   ${mdPath}`);

  // ── Print summary to console ──
  console.log();
  console.log("Category Breakdown:");
  for (const cs of summary.categoryStats) {
    const pct = cs.total > 0 ? ((cs.passed / cs.total) * 100).toFixed(1) : "N/A";
    console.log(`  ${cs.category.padEnd(22)} ${cs.passed}/${cs.total} passed (${pct}%)  avg: ${cs.avgLatency}ms`);
  }
}

main().catch((e) => {
  console.error("Benchmark failed:", e);
  process.exit(1);
});
