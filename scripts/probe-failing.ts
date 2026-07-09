import { analyzeText } from "../lib/guard/analyze";
import { guardRedTeamBenchmark } from "../lib/classifiers/datasets/guardRedTeamBenchmark";
import { phase5Benchmark } from "../lib/classifiers/datasets/phase5Benchmark";

console.log("=== guardRedTeamBenchmark MISSES (attack -> ALLOW) ===");
for (const ex of guardRedTeamBenchmark) {
  const isAttack = ex.category !== "SAFE_BASELINE" && ex.expectedAction !== "ALLOW";
  if (!isAttack) continue;
  const r = analyzeText(ex.prompt, ex.direction);
  if (r.action === "ALLOW") console.log(`[${ex.category}] ${ex.id}: ${JSON.stringify(ex.prompt.slice(0, 160))}`);
}
console.log("\n=== phase5Benchmark MISSES (attack -> ALLOW) ===");
for (const ex of phase5Benchmark) {
  const isAttack = ex.label !== "SAFE";
  if (!isAttack) continue;
  const dir = ex.label === "UNSAFE_OUTPUT" ? "OUTPUT" : "INPUT";
  const r = analyzeText(ex.text, dir as "INPUT" | "OUTPUT");
  if (r.action === "ALLOW") console.log(`[${ex.label}] ${ex.id}: ${JSON.stringify(ex.text.slice(0, 160))}`);
}
