/**
 * Direct Benchmark Runner (bypasses rate limits)
 *
 * Calls analyzeText directly instead of going through the HTTP API,
 * avoiding rate limit issues on the local dev server.
 *
 * Usage: cd examples/real-chatbot-test && npx tsx src/run-benchmark-direct.ts
 */

import {
  BENCHMARK_CASES,
  BENCHMARK_CATEGORIES,
  summarizeResults,
  BenchResult,
} from "./benchmark-prompts";
import { analyzeText } from "../../lib/guard/analyze";
import fs from "fs";
import path from "path";

async function runBenchmark(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];
  const total = BENCHMARK_CASES.length;

  for (let i = 0; i < total; i++) {
    const c = BENCHMARK_CASES[i];
    process.stdout.write(`[${i + 1}/${total}] ${c.category}: ${c.label}... `);

    try {
      const direction = c.category === "Unsafe Output" ? "OUTPUT" : "INPUT";

      // ── Input guard test ──
      const inputStart = Date.now();
      const inputResult = analyzeText(c.message, direction);
      const inputLatencyMs = Date.now() - inputStart;

      const action = inputResult.action ?? "UNKNOWN";
      const isBlocked = action === "BLOCK" || action === "HUMAN_REVIEW";
      const inputPass = c.expectBlock ? isBlocked : !isBlocked;

      // ── Output guard test (best-effort, separate analyze call) ──
      let outputLatencyMs = 0;
      let outputAction = "";
      try {
        const outputStart = Date.now();
        const outputResult = analyzeText(c.message, "OUTPUT");
        outputLatencyMs = Date.now() - outputStart;
        outputAction = outputResult.action ?? "";
      } catch {
        // best-effort
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
      process.stdout.write(`${inputPass ? "✅ PASS" : "❌ FAIL"} (${inputLatencyMs}ms, ${action}, risk:${inputResult.riskScore})\n`);
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

async function main() {
  console.log("=".repeat(70));
  console.log("  SoterAI Guard — Direct Benchmark (no rate limits)");
  console.log("=".repeat(70));
  console.log(`  Total prompts: ${BENCHMARK_CASES.length}`);
  console.log(`  Categories: ${BENCHMARK_CATEGORIES.join(", ")}`);
  console.log("=".repeat(70));
  console.log();

  const start = Date.now();
  const results = await runBenchmark();
  const totalTime = ((Date.now() - start) / 1000).toFixed(1);

  const summary = summarizeResults(results);

  console.log();
  console.log("=".repeat(70));
  console.log("  BENCHMARK COMPLETE");
  console.log(`  Time: ${totalTime}s`);
  console.log(`  ${summary.passed}/${summary.total} passed (${summary.passRate})`);
  console.log("=".repeat(70));

  // Save JSON
  const reportDir = path.resolve(__dirname, "../../../docs/testing/benchmark");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "benchmark-results-direct.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, results }, null, 2), "utf-8");
  console.log(`\n📄 JSON: ${jsonPath}`);

  // Print summary
  console.log();
  console.log("Category Breakdown:");
  for (const cs of summary.categoryStats) {
    const pct = cs.total > 0 ? ((cs.passed / cs.total) * 100).toFixed(1) : "N/A";
    const status = cs.failed === 0 ? "✅" : "❌";
    console.log(`  ${status} ${cs.category.padEnd(22)} ${cs.passed}/${cs.total} passed (${pct}%)  avg: ${cs.avgInputLatency}ms`);
  }

  // List all failures
  const failures = results.filter((r) => !r.pass);
  if (failures.length > 0) {
    console.log();
    console.log("❌ FAILURES:");
    for (const f of failures) {
      console.log(`  ${f.id.padEnd(8)} ${f.category.padEnd(20)} action=${f.action} expected=${f.expectBlock ? "BLOCK" : "ALLOW"} risk=${f.riskScore} types=${f.riskTypes.join(",")}${f.error ? " error=" + f.error : ""}`);
    }
  }

  console.log();
  console.log(`Total time: ${totalTime}s`);
}

main().catch((e) => {
  console.error("Benchmark failed:", e);
  process.exit(1);
});
