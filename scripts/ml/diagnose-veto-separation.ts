/**
 * Where do BENIGN rows sit in the same margin distribution the veto uses?
 *
 * WHY THIS EXISTS
 *   `diagnose-semantic-veto.ts` skips SAFE rows (`if (r.label === "SAFE") continue`),
 *   so it can measure how far attacks sit below the gate but not whether benign
 *   rows sit anywhere else. Those two worlds demand opposite fixes and the attack
 *   side alone cannot tell them apart:
 *
 *     MIS-CENTERED  attacks just below 0, benign well above  -> move the threshold.
 *                   Prototype work is wasted: the geometry is already right.
 *     NON-SEPARATING both piled on top of each other around 0 -> the embedding has
 *                   no discriminating power here and BOTH the threshold and learned
 *                   prototypes are rearranging noise. Needs a real encoder.
 *
 *   This is the deciding measurement for task #11 (learn prototypes over embed()).
 *   Cheap to run, and it can only save work.
 *
 * Read-only. Changes no thresholds, writes no seeds, touches no model.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { classifySemantic } from "../../lib/guard/semanticClassifier";

const EVAL = process.env.EVAL_PATH ?? "datasets/crossdist-eval-v3-sample.jsonl";
const OUT = process.env.OUT_PATH ?? "artifacts/ml/semantic-veto-separation.json";

type Row = { text: string; label: string };

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function describe(name: string, values: number[]): Record<string, number> {
  const sorted = [...values].sort((a, b) => a - b);
  const stats = {
    n: values.length,
    p05: Number(quantile(sorted, 0.05).toFixed(4)),
    p25: Number(quantile(sorted, 0.25).toFixed(4)),
    p50: Number(quantile(sorted, 0.5).toFixed(4)),
    p75: Number(quantile(sorted, 0.75).toFixed(4)),
    p95: Number(quantile(sorted, 0.95).toFixed(4)),
    mean: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4)),
  };
  console.log(
    `${name.padEnd(10)} n=${String(stats.n).padStart(5)}  p05=${stats.p05.toFixed(3)}  p25=${stats.p25.toFixed(3)}  ` +
      `p50=${stats.p50.toFixed(3)}  p75=${stats.p75.toFixed(3)}  p95=${stats.p95.toFixed(3)}  mean=${stats.mean.toFixed(3)}`,
  );
  return stats;
}

function main(): void {
  const rows: Row[] = readFileSync(EVAL, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const attackMargins: number[] = [];
  const benignMargins: number[] = [];
  // The SECOND consumer of this classifier: analyze.ts:432 uses `semantic.isAttack`
  // as a detector in its own right, not just as the veto's input. isAttack needs
  // `margin >= MARGIN_THRESHOLD` (0.07) — well above the p95 of the attack margins
  // measured here — so the same distribution bounds that tier too. Counted rather
  // than inferred from the constant, because the conjunction with
  // MIN_ATTACK_SIMILARITY could bind first.
  let attackIsAttack = 0;
  let benignIsAttack = 0;

  for (const r of rows) {
    const s = classifySemantic(r.text);
    const margin = s.score - s.benignSimilarity;
    if (r.label === "SAFE") {
      benignMargins.push(margin);
      if (s.isAttack) benignIsAttack += 1;
    } else {
      attackMargins.push(margin);
      if (s.isAttack) attackIsAttack += 1;
    }
  }

  console.log(`${EVAL}\nmargin = score - benignSimilarity, the exact quantity the veto thresholds\n`);
  const attack = describe("ATTACK", attackMargins);
  const benign = describe("BENIGN", benignMargins);

  // AUC via the Mann-Whitney U identity: the probability a random attack outranks
  // a random benign row. This is threshold-free, so it measures the EMBEDDING's
  // separating power rather than the operating point's. 0.5 = coin flip.
  const all = [
    ...attackMargins.map((v) => ({ v, a: 1 })),
    ...benignMargins.map((v) => ({ v, a: 0 })),
  ].sort((x, y) => x.v - y.v);
  let rankSum = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j < all.length && all[j].v === all[i].v) j += 1;
    // Average rank over ties, so a pile of exactly-equal margins scores as the
    // coin flip it actually is instead of being silently credited.
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k += 1) if (all[k].a === 1) rankSum += avgRank;
    i = j;
  }
  const nA = attackMargins.length;
  const nB = benignMargins.length;
  const auc = (rankSum - (nA * (nA + 1)) / 2) / (nA * nB);

  // How much of the pile is exactly tied? A bag-of-words embedding that finds no
  // feature overlap returns the same score for many different texts.
  const tiedAtZero = [...attackMargins, ...benignMargins].filter((m) => Math.abs(m) < 0.001).length;

  console.log(`\nAUC (threshold-free separating power)  ${auc.toFixed(4)}`);
  console.log(`rows with |margin| < 0.001              ${tiedAtZero} / ${all.length} (${((tiedAtZero / all.length) * 100).toFixed(1)}%)`);

  // What the two candidate fixes can reach. Sweeping the threshold over the SAME
  // distribution shows the whole achievable frontier; if the best point is barely
  // better than the shipped one, the geometry is the limit and prototypes are not.
  console.log(`\nthreshold sweep on this distribution (veto passes when margin >= t):`);
  console.log(`  t        attacks kept    benign kept (= FP exposure)`);
  for (const t of [0.02, 0.01, 0, -0.02, -0.05, -0.1, -0.15, -0.2]) {
    const a = attackMargins.filter((m) => m >= t).length;
    const b = benignMargins.filter((m) => m >= t).length;
    console.log(
      `  ${t.toFixed(2).padStart(6)}   ${String(a).padStart(5)} (${((a / nA) * 100).toFixed(1)}%)   ${String(b).padStart(5)} (${((b / nB) * 100).toFixed(1)}%)`,
    );
  }

  // The semantic DETECTION tier, measured rather than inferred. analyze.ts:432
  // trusts `isAttack`, which needs margin >= 0.07 while the attack margins above
  // top out near p95 = 0.05. If this rate is near zero, that tier is structurally
  // dark and no prototype work reaches it either.
  const isAttackRate = {
    attacksFlagged: attackIsAttack,
    attacks: attackMargins.length,
    attackRatePct: Number(((attackIsAttack / attackMargins.length) * 100).toFixed(2)),
    benignFlagged: benignIsAttack,
    benign: benignMargins.length,
    benignRatePct: Number(((benignIsAttack / benignMargins.length) * 100).toFixed(2)),
  };
  console.log(
    `\nsemantic isAttack (the DETECTION tier analyze.ts trusts, needs margin >= 0.07):`,
  );
  console.log(
    `  attacks flagged  ${isAttackRate.attacksFlagged}/${isAttackRate.attacks} (${isAttackRate.attackRatePct}%)   ` +
      `benign flagged ${isAttackRate.benignFlagged}/${isAttackRate.benign} (${isAttackRate.benignRatePct}%)`,
  );

  mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ eval: EVAL, attack, benign, auc: Number(auc.toFixed(4)), tiedAtZero, isAttackRate }, null, 2) + "\n",
  );
  console.log(`\n[write] ${OUT}`);
}

main();
