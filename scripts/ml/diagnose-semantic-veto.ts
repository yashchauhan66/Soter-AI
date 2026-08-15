/**
 * Diagnose WHY the semantic prototype gate vetoes attacks the ML tier caught.
 *
 * WHY THIS EXISTS
 *   476 of v7's 545 misses on the pg2scope rows are attributed `semantic-benign`:
 *   the model named a non-SAFE label and `passesPrecisionGate` threw it away
 *   because `score - benignSimilarity < margin`. Two very different fixes hide
 *   behind that one number:
 *
 *     (a) margin is only just below the gate  -> attack prototypes are close but
 *         not close enough. Adding seeds to the losing family fixes it.
 *     (b) margin is deeply negative          -> the text genuinely looks benign to
 *         a bag-of-words embedding. No seed count fixes that; it needs a real
 *         encoder, and pretending otherwise just moves the threshold.
 *
 *   This script measures which case we are actually in, per label, BEFORE anyone
 *   edits a seed list. It reads the eval rows for DIAGNOSIS only — seeds must be
 *   mined from the training corpus, never from these rows, or the next number is
 *   fitted to its own test set.
 *
 * It changes no thresholds and writes no seeds. Read-only measurement.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { classifySemantic } from "../../lib/guard/semanticClassifier";

const EVAL = process.env.EVAL_PATH ?? "datasets/crossdist-eval-v3-sample-pg2scope.jsonl";
const OUT = process.env.OUT_PATH ?? "artifacts/ml/semantic-veto-diagnosis.json";
const GATE = Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0");

type Row = { text: string; label: string };

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function main(): void {
  const rows: Row[] = readFileSync(EVAL, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const byLabel = new Map<string, number[]>();
  const familyWins = new Map<string, Map<string, number>>();

  for (const r of rows) {
    if (r.label === "SAFE") continue;
    const s = classifySemantic(r.text);
    const margin = s.score - s.benignSimilarity;

    if (!byLabel.has(r.label)) byLabel.set(r.label, []);
    byLabel.get(r.label)!.push(margin);

    // Which family the text landed nearest to. A label whose rows keep landing on
    // some OTHER family is a taxonomy mismatch, not a seed shortage.
    if (!familyWins.has(r.label)) familyWins.set(r.label, new Map());
    const fam = s.family ?? "(none/benign)";
    const m = familyWins.get(r.label)!;
    m.set(fam, (m.get(fam) ?? 0) + 1);
  }

  const report: Record<string, unknown> = {};
  console.log(`gate = ${GATE}  (vetoed when margin < gate)\n`);

  for (const [label, margins] of [...byLabel.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sorted = [...margins].sort((a, b) => a - b);
    const vetoed = margins.filter((m) => m < GATE);
    // How many vetoed rows sit within reach of a modest seed improvement. A seed
    // addition lifts `score`, so it can only rescue rows already close to the gate.
    const near = vetoed.filter((m) => m >= GATE - 0.05).length;
    const mid = vetoed.filter((m) => m < GATE - 0.05 && m >= GATE - 0.15).length;
    const far = vetoed.filter((m) => m < GATE - 0.15).length;

    const wins = [...familyWins.get(label)!.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    report[label] = {
      rows: margins.length,
      vetoed: vetoed.length,
      reachable_within_0_05: near,
      reachable_0_05_to_0_15: mid,
      unreachable_beyond_0_15: far,
      margin_p10: Number(quantile(sorted, 0.1).toFixed(4)),
      margin_p50: Number(quantile(sorted, 0.5).toFixed(4)),
      margin_p90: Number(quantile(sorted, 0.9).toFixed(4)),
      nearest_families: wins.map(([f, n]) => `${f}:${n}`),
    };

    console.log(
      `${label.padEnd(30)} rows=${String(margins.length).padStart(4)} vetoed=${String(vetoed.length).padStart(4)}` +
        `  near(<=.05)=${String(near).padStart(4)} mid=${String(mid).padStart(4)} far=${String(far).padStart(4)}` +
        `  p50=${quantile(sorted, 0.5).toFixed(3)}`,
    );
    console.log(`${" ".repeat(32)}nearest: ${wins.map(([f, n]) => `${f}:${n}`).join("  ")}`);
  }

  mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ gate: GATE, eval: EVAL, byLabel: report }, null, 2) + "\n");
  console.log(`\n[write] ${OUT}`);
}

main();
