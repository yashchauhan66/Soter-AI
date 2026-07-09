/**
 * Diagnostic: prints every ATTACK case the live guard fails to mitigate (ALLOW),
 * grouped by category, using the exact honest-benchmark corpus. Evidence tool
 * for the 100% readiness detection work — NOT a product artifact.
 *
 * Run: npx tsx scripts/guard-benchmark/diag-missed.ts
 */
import { assembleGuardCorpus, scoreWithGuard } from "../../lib/benchmarks/honestBenchmark";

const corpus = assembleGuardCorpus();
const attacks = corpus.filter((c) => c.isAttack);
const missed: Array<{ id: string; cat: string; action: string; score: number; text: string }> = [];

for (const c of attacks) {
  const r = scoreWithGuard(c.text, c.direction);
  if (!r.mitigated) {
    missed.push({ id: c.id, cat: c.category, action: r.action, score: r.score, text: c.text.slice(0, 200) });
  }
}

console.log(`Attacks: ${attacks.length}  |  Missed (ALLOW): ${missed.length}`);
const byCat: Record<string, typeof missed> = {};
for (const m of missed) (byCat[m.cat] = byCat[m.cat] || []).push(m);
for (const [cat, arr] of Object.entries(byCat)) {
  console.log(`\n=== ${cat} (${arr.length}) ===`);
  for (const m of arr) console.log(`  ${m.id} [${m.action} score=${m.score}]\n    ${JSON.stringify(m.text)}`);
}
