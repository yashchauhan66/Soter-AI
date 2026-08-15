/**
 * Measure whether the analytic continual-learning head ADDS DETECTION, or only
 * adds an architecture diagram.
 *
 * WHY THIS EXISTS
 *   tests/ml/analytic-head.test.ts proves the head is mathematically what it
 *   claims: incremental RLS == ridge regression retrained on everything, to 1e-9.
 *   That is a correctness proof, not a detection result. A head can be provably
 *   equal to joint training and still be useless, because "equal to retraining on
 *   this data" says nothing about whether the data or the feature space carry the
 *   signal.
 *
 *   This repo has already been burned by exactly that gap: v7 "reproduced the v4
 *   baseline byte-for-byte" because neither model was in the code path, and the
 *   world-ranking doc carries five claims that no artifact supports. So the head
 *   gets the same treatment every other tier got — measured on frozen rows, in the
 *   real production composition, or it does not ship.
 *
 * WHAT IS MEASURED
 *   1. The head ALONE on the frozen crossdist rows (recall/FPR). Expected to be
 *      weak: it is a linear model over hashed n-grams, not a transformer.
 *   2. The head as an ADDITIVE tier on top of the real production stack
 *      (analyzeText -> augmentWithMl at the given margin). This is the only number
 *      that answers "did the model get stronger": union recall vs production
 *      recall, and what it cost in benign false positives.
 *   3. The verdict from lib/ml/continuousLearning/promotionGate.ts, so the answer
 *      arrives in the same form every other candidate's does.
 *
 * ANTI-FITTING
 *   The head's decision threshold is SELECTED on even-indexed eval rows and
 *   REPORTED on odd-indexed rows, so the headline number is not fitted to its own
 *   test. Both halves are printed. Training rows that collide with an eval row by
 *   fingerprint are dropped and counted, never silently included.
 *
 * USAGE
 *   npx tsx scripts/ml/eval-analytic-head.ts --margin -0.10
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { config as loadEnvFile } from "dotenv";
import { arg, loadEvalSet } from "./_evalset";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const trainFile = arg("--train", "datasets/ml-augmented-v7.jsonl");
const evalFile = arg("--eval", "datasets/crossdist-eval-v3-sample.jsonl");
const marginArg = arg("--margin", "-0.10");
const outPath = arg("--out", "artifacts/ml/analytic-head-eval.json");
const maxTrain = Number(arg("--max-train", "0"));

// Exercise the real production composition, at the margin under evaluation.
process.env.SOTERAI_ML_AUGMENT = "enforce";
process.env.SOTERAI_ML_SEMANTIC_MARGIN = marginArg;

/** Same normalization harvest.ts uses, so leak detection matches the loop's dedup. */
function fingerprintOf(text: string): string {
  const normalized = text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);

type Scored = { isAttack: boolean; headScore: number; prodHit: boolean; label: string };

/** recall/FPR for "production hit OR head score >= threshold". */
function unionAt(rows: readonly Scored[], threshold: number) {
  let attacks = 0;
  let caught = 0;
  let benign = 0;
  let fp = 0;
  for (const r of rows) {
    const hit = r.prodHit || r.headScore >= threshold;
    if (r.isAttack) {
      attacks += 1;
      if (hit) caught += 1;
    } else {
      benign += 1;
      if (hit) fp += 1;
    }
  }
  return { attacks, caught, benign, fp, recall: pct(caught, attacks), fpr: pct(fp, benign) };
}

/** The head judged on its own, with no production tier underneath it. */
function headAloneAt(rows: readonly Scored[], threshold: number) {
  let attacks = 0;
  let caught = 0;
  let benign = 0;
  let fp = 0;
  for (const r of rows) {
    const hit = r.headScore >= threshold;
    if (r.isAttack) {
      attacks += 1;
      if (hit) caught += 1;
    } else {
      benign += 1;
      if (hit) fp += 1;
    }
  }
  return { attacks, caught, benign, fp, recall: pct(caught, attacks), fpr: pct(fp, benign) };
}

async function main(): Promise<void> {
  const { AnalyticHead } = await import("../../lib/ml/continuousLearning/analyticHead");
  const { embed } = await import("../../lib/guard/semanticClassifier");
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl, resolveMlAugmentMode } = await import("../../lib/guard/mlAugment");
  const { evaluatePromotion } = await import("../../lib/ml/continuousLearning/promotionGate");

  if (resolveMlAugmentMode() === "off") {
    console.error("[FATAL] ML tier resolved to 'off' — the production baseline would be rules-only,");
    console.error("        which is the exact bug eval-crossdist-production.ts exists to expose.");
    process.exit(2);
  }

  // ---- frozen eval rows ----------------------------------------------------
  const evalRows = loadEvalSet(evalFile);
  const goldenSetHash = createHash("sha256").update(readFileSync(evalFile)).digest("hex").slice(0, 16);
  const evalFingerprints = new Set(evalRows.map((r) => fingerprintOf(r.text)));
  console.log(`eval:  ${evalRows.length} rows from ${evalFile} (hash ${goldenSetHash})`);

  // ---- training rows, leak-guarded ----------------------------------------
  const trainRaw = readFileSync(trainFile, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { text: string; label: string });

  const trainRows: typeof trainRaw = [];
  let leaked = 0;
  for (const row of trainRaw) {
    if (evalFingerprints.has(fingerprintOf(row.text))) {
      leaked += 1;
      continue;
    }
    trainRows.push(row);
    if (maxTrain && trainRows.length >= maxTrain) break;
  }
  console.log(`train: ${trainRows.length} rows from ${trainFile} (${leaked} dropped: present in the eval set)`);

  // ---- train the head ------------------------------------------------------
  // Two classes, one-hot: [attack, benign]. The head is a scorer; the decision is
  // score[attack] - score[benign], thresholded below.
  const head = new AnalyticHead(512, 2);
  const startedTrain = Date.now();
  for (let i = 0; i < trainRows.length; i += 1) {
    const row = trainRows[i];
    const isAttack = row.label !== "SAFE";
    head.learn(embed(row.text), isAttack ? [1, 0] : [0, 1]);
    if ((i + 1) % 20000 === 0) console.log(`  learned ${i + 1}/${trainRows.length}`);
  }
  const trainMs = Date.now() - startedTrain;
  console.log(`head trained on ${head.samplesSeen} samples in ${(trainMs / 1000).toFixed(1)}s ` +
    `(${(trainMs / Math.max(1, head.samplesSeen)).toFixed(3)} ms/sample)`);

  // ---- score every eval row through BOTH paths ----------------------------
  const flagged = (v: { allowed?: boolean; action?: string }) =>
    v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

  const scored: Scored[] = [];
  let mlRan = 0;
  let mlErrors = 0;
  for (let i = 0; i < evalRows.length; i += 1) {
    const row = evalRows[i];
    const before = analyzeText(row.text, "INPUT");
    const after = await augmentWithMl(before, row.text, "INPUT");
    const ml = (after.metadata as { ml?: Record<string, unknown> } | undefined)?.ml;
    if (ml?.ran === true) mlRan += 1;
    if (typeof ml?.error === "string") mlErrors += 1;

    const out = head.predict(embed(row.text));
    scored.push({
      isAttack: row.label !== "SAFE",
      headScore: out[0] - out[1],
      prodHit: flagged(after),
      label: row.label,
    });
    if ((i + 1) % 500 === 0) console.log(`  scored ${i + 1}/${evalRows.length}`);
  }

  if (mlRan === 0) {
    console.error("[FATAL] the ML tier never ran — this would be a rules-only measurement.");
    process.exit(2);
  }

  // ---- threshold SELECTED on one half, REPORTED on the other --------------
  const selection = scored.filter((_, i) => i % 2 === 0);
  const holdout = scored.filter((_, i) => i % 2 === 1);

  const production = {
    all: unionAt(scored, Infinity),
    selection: unionAt(selection, Infinity),
    holdout: unionAt(holdout, Infinity),
  };

  // Candidate thresholds: every distinct head score in the selection half is a
  // possible operating point; sweeping them all is cheap at this row count.
  const candidateThresholds = [...new Set(selection.map((r) => r.headScore))].sort((a, b) => b - a);
  // The ceiling is measured on the SAME half the threshold is selected on. Using
  // the all-rows FPR here would compare a selection-half numerator against an
  // all-rows denominator and quietly buy extra FPR budget.
  const fprCeiling = production.selection.fpr + 0.5;

  let best: { threshold: number; recall: number; fpr: number } | null = null;
  for (const threshold of candidateThresholds) {
    const u = unionAt(selection, threshold);
    if (u.fpr > fprCeiling) continue;
    if (!best || u.recall > best.recall) best = { threshold, recall: u.recall, fpr: u.fpr };
  }

  const chosen = best?.threshold ?? Infinity;
  const candidateHoldout = unionAt(holdout, chosen);
  const candidateAll = unionAt(scored, chosen);
  const aloneHoldout = headAloneAt(holdout, chosen);
  const aloneAtZero = headAloneAt(scored, 0);

  // How many attacks production misses does the head actually rescue, and how
  // many benign rows does it newly break? These are the two numbers that matter,
  // so they are computed on the HELD-OUT half. Computing them over all rows would
  // include the half `chosen` was fitted on and overstate the rescue — the exact
  // shape of overstatement this script exists to avoid. The fitted figure is
  // reported too, labelled, so the gap between them is visible.
  function additiveValue(rows: readonly Scored[]) {
    let rescued = 0;
    let newFp = 0;
    const rescuedByLabel = new Map<string, number>();
    for (const r of rows) {
      if (r.prodHit || r.headScore < chosen) continue;
      if (r.isAttack) {
        rescued += 1;
        rescuedByLabel.set(r.label, (rescuedByLabel.get(r.label) ?? 0) + 1);
      } else {
        newFp += 1;
      }
    }
    return {
      attacksRescuedFromProductionMisses: rescued,
      newFalsePositives: newFp,
      rescuedByLabel: Object.fromEntries([...rescuedByLabel].sort((a, b) => b[1] - a[1])),
    };
  }

  const additiveHoldout = additiveValue(holdout);
  const additiveFitted = additiveValue(selection);

  const decision = evaluatePromotion({
    candidateId: `analytic-head-d512-margin${marginArg}`,
    frozenGoldenSetHash: goldenSetHash,
    baseline: {
      goldenSetId: path.basename(evalFile),
      goldenSetHash,
      rows: holdout.length,
      attacks: production.holdout.attacks,
      benign: production.holdout.benign,
      recall: production.holdout.recall / 100,
      fpr: production.holdout.fpr / 100,
    },
    candidate: {
      goldenSetId: path.basename(evalFile),
      goldenSetHash,
      rows: holdout.length,
      attacks: candidateHoldout.attacks,
      benign: candidateHoldout.benign,
      recall: candidateHoldout.recall / 100,
      fpr: candidateHoldout.fpr / 100,
    },
    // Leak-guarded above; assert it here rather than assume it.
    trainingOverlapsGoldenSet: false,
    // No shadow deployment exists for this head. Reporting it as if it did would
    // be the exact dishonesty the gate is built to refuse.
    shadowRequests: 0,
    shadowRunMs: 0,
  });

  const artifact = {
    generatedBy: "scripts/ml/eval-analytic-head.ts",
    trainFile,
    trainRows: head.samplesSeen,
    trainRowsDroppedAsEvalLeak: leaked,
    trainMsTotal: trainMs,
    evalFile,
    goldenSetHash,
    evalRows: evalRows.length,
    semanticMargin: Number(marginArg),
    mlTierRan: mlRan,
    mlErrors,
    thresholdSelectedOnEvenRows: chosen === Infinity ? null : Number(chosen.toFixed(6)),
    production,
    candidateUnion: { all: candidateAll, holdout: candidateHoldout },
    headAlone: { atSelectedThresholdHoldout: aloneHoldout, atZeroAllRows: aloneAtZero },
    additive: { holdout: additiveHoldout, fittedHalf: additiveFitted },
    promotion: decision,
    caveats: [
      "The head is a linear model over 512-dim hashed n-grams (lib/guard/semanticClassifier embed). It is a complement to the v7 transformer, never a replacement.",
      "Threshold was selected on even-indexed rows and reported on odd-indexed rows. `candidateUnion.all` and `additive.fittedHalf` are FITTED and must not be quoted as held-out; quote `candidateUnion.holdout` and `additive.holdout`.",
      "shadowRequests/shadowRunMs are 0 because no shadow deployment exists. The gate is expected to HOLD on that alone even if the deltas are good.",
    ],
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log("\n=== production baseline (held-out half) ===");
  console.log(`  recall ${production.holdout.recall}%  fpr ${production.holdout.fpr}%`);
  console.log("=== + analytic head (held-out half) ===");
  console.log(`  recall ${candidateHoldout.recall}%  fpr ${candidateHoldout.fpr}%  @threshold ${chosen}`);
  console.log("=== head ALONE ===");
  console.log(`  held-out @selected: recall ${aloneHoldout.recall}%  fpr ${aloneHoldout.fpr}%`);
  console.log(`  all rows  @0:       recall ${aloneAtZero.recall}%  fpr ${aloneAtZero.fpr}%`);
  console.log("=== additive value (HELD-OUT half — the honest one) ===");
  console.log(`  rescued ${additiveHoldout.attacksRescuedFromProductionMisses} production misses, ` +
    `added ${additiveHoldout.newFalsePositives} false positives`);
  console.log(`  by label: ${JSON.stringify(additiveHoldout.rescuedByLabel)}`);
  console.log(`  (fitted half, for comparison: ${additiveFitted.attacksRescuedFromProductionMisses} rescued / ` +
    `${additiveFitted.newFalsePositives} new FPs)`);
  console.log(`\n${decision.summary}`);
  for (const b of decision.blockers) console.log(`  [${b.severity}] ${b.code}: ${b.message}`);
  console.log(`\nwrote ${outPath}`);
}

void main();
