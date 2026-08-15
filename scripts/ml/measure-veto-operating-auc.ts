/**
 * Does the semantic-benign veto discriminate ON THE ROWS IT ACTUALLY SEES?
 *
 * WHY THIS EXISTS
 *   `diagnose-veto-separation.ts` measured the veto's decision variable
 *   (`score - benignSimilarity`) over every eval row and got AUC 0.5187 — a coin
 *   flip. That is suggestive but NOT yet a verdict, because the veto never sees
 *   every row. It is the last gate in `passesPrecisionGate`, so it only judges
 *   rows that already survived the label allowlist, the abstention check and the
 *   confidence floor. Those gates are themselves selective, and it is entirely
 *   possible for a variable to be uninformative overall and informative on a
 *   filtered subpopulation. Reporting 0.5187 as the veto's AUC without this check
 *   would be the same class of error as measuring the ML tier through
 *   `analyzeText()` and calling the result "the ML tier".
 *
 * METHOD
 *   Run the REAL production path twice-in-one-pass logic: set the semantic margin
 *   to -10 so the veto can never fire. Then `isAttack` is true exactly when all
 *   the OTHER gates passed — i.e. the set of rows that would have been handed to
 *   the veto. For each such row, record the margin the veto would have thresholded
 *   and the ground-truth label, and compute AUC over that population alone.
 *
 *   AUC here answers: if you handed the veto one real attack and one real benign
 *   row, both of which reached it, how often does it rank the attack higher?
 *   0.5 = it cannot tell them apart and is discarding predictions at random.
 *
 * Read-only: writes an artifact, changes no threshold and no shipped default. The
 * -10 margin is set on this process only.
 */
import * as path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";
import { arg, loadEvalSet, type Row } from "./_evalset";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const file = arg("--file", "datasets/crossdist-eval-v3-sample.jsonl");
const limit = Number(arg("--limit", "0"));
const outPath = arg("--out", "artifacts/ml/veto-operating-auc.json");
process.env.SOTERAI_ML_AUGMENT = "enforce";
// Disable the veto so we can observe the population it would have judged.
process.env.SOTERAI_ML_SEMANTIC_MARGIN = "-10";

function sample(all: Row[], n: number): Row[] {
  if (!n || n >= all.length) return all;
  const byLabel = new Map<string, Row[]>();
  for (const r of all) {
    const list = byLabel.get(r.label) ?? [];
    list.push(r);
    byLabel.set(r.label, list);
  }
  const out: Row[] = [];
  const perLabel = Math.max(1, Math.floor(n / byLabel.size));
  for (const list of byLabel.values()) {
    const step = Math.max(1, Math.floor(list.length / perLabel));
    for (let i = 0; i < list.length && out.length < n; i += step) out.push(list[i]);
  }
  return out;
}

function auc(attack: number[], benign: number[]): number {
  if (!attack.length || !benign.length) return NaN;
  const all = [
    ...attack.map((v) => ({ v, a: 1 })),
    ...benign.map((v) => ({ v, a: 0 })),
  ].sort((x, y) => x.v - y.v);
  let rankSum = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j < all.length && all[j].v === all[i].v) j += 1;
    const avgRank = (i + j + 1) / 2; // ties average, so a tied pile scores as a coin flip
    for (let k = i; k < j; k += 1) if (all[k].a === 1) rankSum += avgRank;
    i = j;
  }
  const nA = attack.length;
  return (rankSum - (nA * (nA + 1)) / 2) / (nA * benign.length);
}

async function main(): Promise<void> {
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl, resolveMlAugmentMode } = await import("../../lib/guard/mlAugment");
  const { classifySemantic } = await import("../../lib/guard/semanticClassifier");

  if (resolveMlAugmentMode() === "off") {
    console.error("[FATAL] ML tier resolved to 'off'. Set ML_ONNX_MODEL_PATH; refusing to emit");
    console.error("        a number that would look like an ML measurement but is not.");
    process.exit(2);
  }

  const cases = sample(loadEvalSet(file), limit);
  // Margins of rows that REACHED the veto, split by ground truth.
  const reachedAttack: number[] = [];
  const reachedBenign: number[] = [];
  // Everything, for the population-level comparison.
  const allAttack: number[] = [];
  const allBenign: number[] = [];
  let mlRan = 0;
  let mlErrors = 0;

  for (let i = 0; i < cases.length; i++) {
    const r = cases[i];
    const isAttack = r.label !== "SAFE";
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    const ml = (after.metadata as { ml?: Record<string, unknown> } | undefined)?.ml;
    if (ml?.ran === true) mlRan++;
    if (typeof ml?.error === "string") mlErrors++;

    const s = classifySemantic(r.text);
    const margin = s.score - s.benignSimilarity;
    (isAttack ? allAttack : allBenign).push(margin);

    // With the veto disabled, a non-SAFE prediction with no `gatedBy` means every
    // other gate passed — so this row is exactly one the veto would have judged.
    const reachedVeto =
      ml?.ran === true && ml?.predictedLabel !== "SAFE" && ml?.gatedBy === undefined;
    if (reachedVeto) (isAttack ? reachedAttack : reachedBenign).push(margin);

    if ((i + 1) % 100 === 0) process.stderr.write(`\r[scan] ${i + 1}/${cases.length}`);
  }
  process.stderr.write(`\r[scan] ${cases.length}/${cases.length}\n`);

  const reachedAuc = auc(reachedAttack, reachedBenign);
  const allAuc = auc(allAttack, allBenign);

  // What the veto actually does at each threshold to the population it judges.
  const sweep = [0.02, 0.01, 0, -0.02, -0.05, -0.1].map((t) => ({
    margin: t,
    attacksKept: reachedAttack.filter((m) => m >= t).length,
    benignKept: reachedBenign.filter((m) => m >= t).length,
    attacksVetoed: reachedAttack.filter((m) => m < t).length,
    benignVetoed: reachedBenign.filter((m) => m < t).length,
  }));

  const report = {
    file,
    limit,
    sampled: cases.length,
    mlTierRan: mlRan,
    mlErrors,
    note: "semantic margin forced to -10 so the veto never fires; rows with no gatedBy are the veto's operating population",
    population: {
      reachedVetoAttacks: reachedAttack.length,
      reachedVetoBenign: reachedBenign.length,
      allAttacks: allAttack.length,
      allBenign: allBenign.length,
    },
    auc: {
      onVetoOperatingPopulation: Number(reachedAuc.toFixed(4)),
      onAllRows: Number(allAuc.toFixed(4)),
    },
    sweep,
  };

  console.log("\n================================================================");
  console.log(`  ml mode    enforce   ran on ${mlRan}/${cases.length} rows   errors ${mlErrors}`);
  console.log(`  population reaching the veto: ${reachedAttack.length} attacks, ${reachedBenign.length} benign`);
  console.log("----------------------------------------------------------------");
  console.log(`  AUC on the veto's operating population   ${reachedAuc.toFixed(4)}`);
  console.log(`  AUC on all rows                          ${allAuc.toFixed(4)}`);
  console.log("\n  what the veto does to the rows it judges:");
  console.log("    margin   attacks vetoed   benign vetoed");
  for (const s of sweep) {
    const aPct = reachedAttack.length ? (s.attacksVetoed / reachedAttack.length) * 100 : 0;
    const bPct = reachedBenign.length ? (s.benignVetoed / reachedBenign.length) * 100 : 0;
    console.log(
      `    ${s.margin.toFixed(2).padStart(6)}   ${String(s.attacksVetoed).padStart(6)} (${aPct.toFixed(1)}%)   ${String(s.benignVetoed).padStart(5)} (${bPct.toFixed(1)}%)`,
    );
  }

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`\n[write] ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
