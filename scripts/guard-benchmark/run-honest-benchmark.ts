/**
 * Honest benchmark runner.
 *
 * Runs the EXACT production classifier (analyzeText) over the vendored datasets,
 * computes Recall@1%FPR / ROC-AUC / production-threshold metrics / per-category
 * recall / latency, plus a multi-turn (Crescendo) evaluation, and writes an
 * honest artifact to scripts/guard-benchmark/honest-results.json.
 *
 * Run:  npx tsx scripts/guard-benchmark/run-honest-benchmark.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { runHonestBenchmark, runMultiTurnBenchmark } from "../../lib/benchmarks/honestBenchmark";
import { MULTI_TURN_SEQUENCES } from "../../lib/benchmarks/multiTurnSequences";

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

const report = runHonestBenchmark();
const multiTurn = runMultiTurnBenchmark(MULTI_TURN_SEQUENCES);

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(" SoterAI — Honest Guard Benchmark");
console.log("═══════════════════════════════════════════════════════════════");
console.log(`Corpus: ${report.corpus.total} cases (${report.corpus.attacks} attacks, ${report.corpus.benign} benign)`);
for (const [source, s] of Object.entries(report.corpus.sources)) {
  console.log(`  · ${source}: ${s.total} (${s.attacks} atk / ${s.benign} benign)`);
}

console.log("\n── Headline (honest) metrics ──");
console.log(`  ROC-AUC (separability):        ${report.rocAuc.toFixed(4)}`);
for (const r of report.recallAtFpr) {
  console.log(
    `  Recall @ ${pct(r.targetFpr)} FPR:          ${pct(r.recall)}  ` +
      `(threshold score > ${r.threshold}, achieved FPR ${pct(r.fprAchieved)}, budget ${r.allowedFalsePositives} FPs)`,
  );
}

console.log("\n── At the live production threshold (positive = any protective action) ──");
console.log(`  Mitigation recall: ${pct(report.production.recall)}  (attack neutralized: block/review/rewrite/redact)`);
console.log(`  Hard block/review: ${pct(report.production.blockOrReviewRate)}  (strictest — fully stopped/escalated)`);
console.log(`  Precision:         ${pct(report.production.precision)}`);
console.log(`  F1:                ${report.production.f1.toFixed(4)}`);
console.log(`  FPR:               ${pct(report.production.falsePositiveRate)}`);
console.log(`  FNR:               ${pct(report.production.falseNegativeRate)}`);

console.log("\n── Weakest attack categories (lowest recall first) ──");
for (const cat of report.perCategory.slice(0, 8)) {
  console.log(`  ${pct(cat.recall).padStart(8)}  ${cat.category} (${cat.detected}/${cat.total})`);
}

console.log("\n── Latency (per-input, analyzer only) ──");
console.log(
  `  p50 ${report.latencyMs.p50.toFixed(2)}ms · p95 ${report.latencyMs.p95.toFixed(2)}ms · ` +
    `p99 ${report.latencyMs.p99.toFixed(2)}ms · max ${report.latencyMs.max.toFixed(2)}ms`,
);

console.log("\n── Multi-turn / adaptive (Crescendo) ──");
console.log(`  Sessions: ${multiTurn.total} (${multiTurn.attacks} attack, ${multiTurn.benign} benign)`);
console.log(`  Multi-turn recall:  ${pct(multiTurn.recall)}`);
console.log(`  Multi-turn FPR:     ${pct(multiTurn.falsePositiveRate)}`);
console.log(`  Mean turns to catch: ${multiTurn.meanTurnsToDetect.toFixed(2)}`);

const outPath = path.join(process.cwd(), "scripts", "guard-benchmark", "honest-results.json");
writeFileSync(outPath, `${JSON.stringify({ singleTurn: report, multiTurn }, null, 2)}\n`, "utf8");
console.log(`\nWrote ${outPath}\n`);
