/**
 * Which abstention branch discarded the 40 near-certain attacks?
 *
 * shouldAbstain cannot be the cause on its own: at the deployed budget 0.40, binary
 * entropy at P(attack)=0.966 is ~0.148, well inside budget, and the confidence floor
 * is inert below 0.50 (calibration.ts:207). So the only remaining branch is
 *   truncatedView && labelSpaceUncertain(...)
 * at onnxBackend.ts:583, which fires ONLY when tokensSeen < tokensTotal — i.e. the
 * input was longer than the model's window.
 *
 * That is a testable prediction with a clean falsifier: if these are truncation
 * abstentions, the abstained rows must be systematically LONGER than the rows the
 * pipeline caught. If their lengths look like everything else, the hypothesis is
 * wrong and the entropy path needs re-examining instead.
 *
 * Prints the distribution rather than a mean — one 40k-char contract would drag a
 * mean and prove nothing about the other 39.
 */
import { readFileSync } from "node:fs";

type MissRow = { text: string; label: string; reason: string; attackProbability?: number };
const rows: MissRow[] = readFileSync("artifacts/ml/crossdist-misses.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as MissRow);

// Rough token proxy. The real tokenizer is lib/ml/bertTokenizer.ts, but the question
// here is only "is this over the window", and a 4-chars-per-token proxy answers that
// with room to spare at the 256/512 boundary.
const approxTokens = (t: string) => Math.ceil(t.length / 4);

const groups = new Map<string, MissRow[]>();
for (const r of rows) {
  const g = groups.get(r.reason) ?? [];
  g.push(r);
  groups.set(r.reason, g);
}

const quantiles = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return { min: s[0], p25: at(0.25), median: at(0.5), p75: at(0.75), max: s[s.length - 1] };
};

console.log("reason              n     chars: min/p25/med/p75/max        approx tokens (med)");
for (const [reason, g] of groups) {
  const q = quantiles(g.map((r) => r.text.length));
  console.log(
    `${reason.padEnd(18)}${String(g.length).padStart(3)}     ` +
      `${q.min}/${q.p25}/${q.median}/${q.p75}/${q.max}`.padEnd(30) +
      // Ceil of a CHAR COUNT, not of a string: approxTokens takes text, and passing
      // the median length gave (1258).length === undefined -> NaN.
      `${Math.ceil(q.median / 4)}`,
  );
}

const abst = groups.get("abstention") ?? [];
const over = abst.filter((r) => approxTokens(r.text) > 256).length;
console.log(`\nabstention rows over a 256-token window (proxy): ${over}/${abst.length}`);
console.log(`abstention rows over 512 tokens (proxy):         ${abst.filter((r) => approxTokens(r.text) > 512).length}/${abst.length}`);

console.log("\nshortest abstention rows — if these exist, truncation is NOT the whole story:");
for (const r of [...abst].sort((a, b) => a.text.length - b.text.length).slice(0, 5)) {
  console.log(`  ${String(r.text.length).padStart(6)} chars  atkProb=${r.attackProbability ?? "n/a"}  [${r.label}]`);
  console.log(`    ${r.text.replace(/\s+/g, " ").slice(0, 140)}`);
}
