/**
 * Expanded Benchmark Runner (116 prompts, 12 categories)
 *
 * Calls analyzeText directly, bypassing HTTP rate limits.
 * Tests all 62 original prompts plus 54 new ones across:
 * - Chinese, Russian, Arabic multilingual attacks
 * - Data exfiltration attempts
 * - Adversarial ML attacks
 *
 * Usage: npx tsx scripts/run-expanded-benchmark.ts
 */

import { analyzeText } from "../lib/guard/analyze";
import type { BenchResult } from "../examples/real-chatbot-test/src/benchmark-expanded";
import { BENCHMARK_CASES, BENCHMARK_CATEGORIES, summarizeResults } from "../examples/real-chatbot-test/src/benchmark-expanded";
import fs from "fs";
import path from "path";

function runBenchmark(): BenchResult[] {
  const results: BenchResult[] = [];
  const total = BENCHMARK_CASES.length;

  for (let i = 0; i < total; i++) {
    const c = BENCHMARK_CASES[i];
    process.stdout.write(`[${i + 1}/${total}] ${c.category}: ${c.label}... `);

    try {
      const direction = c.category === "Unsafe Output" ? "OUTPUT" : "INPUT";

      const inputStart = Date.now();
      const inputResult = analyzeText(c.message, direction);
      const inputLatencyMs = Date.now() - inputStart;

      const action = inputResult.action ?? "UNKNOWN";
      const isBlocked = action === "BLOCK" || action === "HUMAN_REVIEW";
      const inputPass = c.expectBlock ? isBlocked : !isBlocked;

      let outputLatencyMs = 0;
      if (c.category === "System Prompt Leak") {
        try {
          const outputStart = Date.now();
          analyzeText(c.message, "OUTPUT");
          outputLatencyMs = Date.now() - outputStart;
        } catch {
          // best-effort
        }
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
      process.stdout.write(`${inputPass ? "✅ PASS" : "❌ FAIL"} (${inputLatencyMs}ms, ${action}, risk:${inputResult.riskScore}, types:[${inputResult.riskTypes.join(",")}])\n`);
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

function main() {
  console.log("=".repeat(70));
  console.log("  SoterAI Guard — EXPANDED Benchmark (116 prompts)");
  console.log("=".repeat(70));
  console.log(`  Total prompts: ${BENCHMARK_CASES.length}`);
  console.log(`  Categories: ${BENCHMARK_CATEGORIES.join(", ")}`);
  console.log("=".repeat(70));
  console.log();

  const start = Date.now();
  const results = runBenchmark();
  const totalTime = ((Date.now() - start) / 1000).toFixed(1);

  const summary = summarizeResults(results);

  console.log();
  console.log("=".repeat(70));
  console.log("  BENCHMARK COMPLETE");
  console.log(`  Time: ${totalTime}s`);
  console.log(`  ${summary.passed}/${summary.total} passed (${summary.passRate})`);
  console.log("=".repeat(70));

  // Save JSON
  const reportDir = path.resolve(__dirname, "../docs/testing/benchmark");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "benchmark-expanded-results.json");
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
      console.log(`  ${f.id.padEnd(8)} ${f.category.padEnd(20)} action=${f.action} expected=${f.expectBlock ? "BLOCK" : "ALLOW"} risk=${f.riskScore} types=[${f.riskTypes.join(",")}]${f.error ? " error=" + f.error : ""}`);
    }
  } else {
    console.log();
    console.log("🎉 🎉 🎉 ALL 116 TESTS PASSED! 100% SUCCESS RATE! 🎉 🎉 🎉");
  }

  console.log();
  console.log(`Total time: ${totalTime}s`);
}

main();
