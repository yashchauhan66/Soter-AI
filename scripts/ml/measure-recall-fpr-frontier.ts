/**
 * AC6 step 5: the achievable recall/FPR FRONTIER, so "1% is unreachable" becomes a
 * curve the target can be chosen from rather than an assertion.
 *
 * WHY A FRONTIER AND NOT A FLOOR SWEEP
 *   The obvious move -- sweep ML_ONNX_CONFIDENCE_FLOOR and ML_ONNX_ATTACK_PROB_FLOOR
 *   -- is a trap twice over:
 *     1. ML_ONNX_CONFIDENCE_FLOOR is INERT. onnxBackend.ts:699-703 states that a
 *        label WITH a per-label threshold bypasses the floor, and both shipped
 *        artifacts define one for every label. Sweeping it draws a flat line, and
 *        artifacts/ml/v12-threshold-clamp-sweep.json already measured that flatness
 *        (verify-half FPR 0.72% for every floor from 0.05 to 0.50).
 *     2. The same env var is read in TWO places with DIFFERENT defaults -- 0.5 at
 *        onnxBackend.ts:326 (inert) and 0.9 at mlAugment.ts:386 (live) -- and the
 *        backend freezes its copy at construction, so an in-process sweep changes
 *        one reader and not the other.
 *
 *   Collecting the score once and sweeping it OFFLINE avoids both, costs one
 *   inference pass instead of one per arm, and yields every operating point.
 *
 * WHAT THE TWO CURVES MEAN
 *   ML-ONLY is an UPPER BOUND on the ML tier, not its behaviour. A pure threshold on
 *   P(attack) ignores everything production puts in the way: the INPUT label gate
 *   (DEFAULT_INPUT_RELIABLE_LABELS admits 8 of 13 labels), the abstain path, the
 *   precision gate. Production can only do WORSE than this curve. That is what makes
 *   it decisive: if even the upper bound cannot reach FPR 1% at recall 99%, no gate
 *   tuning gets there, and the target itself is the thing that has to move.
 *
 *   SYSTEM is `rulesFlagged OR score >= t`, which is what escalate-only actually
 *   computes. Its FPR can never fall below the rules-only FPR however high t goes,
 *   because the rules tier has already acted. That floor is the headline number.
 *
 *   npx tsx scripts/ml/measure-recall-fpr-frontier.ts
 */
import * as path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.SOTERAI_ML_AUGMENT = "enforce";

const mod = (rel: string) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
const FILE = "artifacts/ml/v18-balanced-comparison-rows.jsonl";
const OUT = "artifacts/ml/recall-fpr-frontier-2026-10-02.json";

type Row = { text: string; label: string; language?: string };
type Verdict = { allowed?: boolean; action?: string };
const flagged = (v: Verdict): boolean =>
  v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

type Scored = { isAttack: boolean; rulesFlagged: boolean; score: number };

async function main(): Promise<void> {
  const { analyzeText } = (await import(mod("lib/guard/analyze.ts"))) as {
    analyzeText: (t: string, d: string) => Verdict;
  };
  // Construct the backend exactly the way the guard path does. mlAugment's own
  // getBackend() is module-private, and it does NOT just call
  // createOnnxBackendFromEnv(): that factory returns null unless ML_BACKEND=onnx,
  // while the guard path keys off ML_ONNX_MODEL_PATH and constructs directly
  // (mlAugment.ts:288-299). Mirroring that branch is what makes this the production
  // model rather than a lookalike.
  const { ONNXClassifierBackend, createOnnxBackendFromEnv } = (await import(
    mod("lib/ml/onnxBackend.ts"),
  )) as {
    ONNXClassifierBackend: new () => {
      infer: (t: string, d: string) => Promise<{
        predictedLabel: string;
        confidence: number;
        raw?: { attackProbability?: number };
      }>;
    };
    createOnnxBackendFromEnv: () => {
      infer: (t: string, d: string) => Promise<{
        predictedLabel: string;
        confidence: number;
        raw?: { attackProbability?: number };
      }>;
    } | null;
  };

  const backend = process.env.ML_ONNX_MODEL_PATH
    ? new ONNXClassifierBackend()
    : createOnnxBackendFromEnv();
  if (!backend) {
    console.error("[FATAL] no ML backend could be constructed; there is no score to sweep.");
    console.error("        ML_ONNX_MODEL_PATH is " + (process.env.ML_ONNX_MODEL_PATH ? "set" : "NOT set") + ". Refusing.");
    process.exit(2);
  }

  const rows: Row[] = readFileSync(path.resolve(process.cwd(), FILE), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const scored: Scored[] = [];
  let missingScore = 0;
  for (const r of rows) {
    const rulesFlagged = flagged(analyzeText(r.text, "INPUT"));
    const inf = await backend.infer(r.text, "INPUT");
    const ap = inf.raw?.attackProbability;
    if (typeof ap !== "number" || Number.isNaN(ap)) { missingScore++; continue; }
    scored.push({ isAttack: r.label !== "SAFE", rulesFlagged, score: ap });
  }

  if (missingScore > rows.length * 0.02) {
    console.error(`[FATAL] ${missingScore}/${rows.length} rows had no attackProbability.`);
    console.error("        A curve built on the remainder would not describe this battery. Refusing.");
    process.exit(2);
  }
  const distinct = new Set(scored.map((s) => s.score.toFixed(6))).size;
  if (distinct < 50) {
    console.error(`[FATAL] only ${distinct} distinct scores across ${scored.length} rows; the score is`);
    console.error("        too degenerate to form a frontier. A flat curve here would be an artifact. Refusing.");
    process.exit(2);
  }

  const attacks = scored.filter((s) => s.isAttack);
  const benign = scored.filter((s) => !s.isAttack);
  const pct = (a: number, b: number) => Number(((a / b) * 100).toFixed(2));

  // Rules-only operating point: the floor the SYSTEM curve can never go below.
  const rulesFpr = pct(benign.filter((s) => s.rulesFlagged).length, benign.length);
  const rulesRecall = pct(attacks.filter((s) => s.rulesFlagged).length, attacks.length);

  const thresholds = [...new Set(scored.map((s) => s.score))].sort((a, b) => a - b);
  type Point = { t: number; mlRecall: number; mlFpr: number; sysRecall: number; sysFpr: number };
  const curve: Point[] = thresholds.map((t) => ({
    t: Number(t.toFixed(6)),
    mlRecall: pct(attacks.filter((s) => s.score >= t).length, attacks.length),
    mlFpr: pct(benign.filter((s) => s.score >= t).length, benign.length),
    sysRecall: pct(attacks.filter((s) => s.rulesFlagged || s.score >= t).length, attacks.length),
    sysFpr: pct(benign.filter((s) => s.rulesFlagged || s.score >= t).length, benign.length),
  }));

  // AUC by rank (Mann-Whitney), on the raw score.
  const sortedAll = [...scored].sort((a, b) => a.score - b.score);
  let rankSum = 0;
  for (let i = 0; i < sortedAll.length; i++) if (sortedAll[i].isAttack) rankSum += i + 1;
  const nA = attacks.length, nB = benign.length;
  const auc = Number(((rankSum - (nA * (nA + 1)) / 2) / (nA * nB)).toFixed(4));

  const bestRecallAt1Fpr = curve.filter((p) => p.mlFpr <= 1.0)
    .reduce((b, p) => (p.mlRecall > b ? p.mlRecall : b), 0);
  const minFprAt99Recall = curve.filter((p) => p.mlRecall >= 99.0)
    .reduce((b, p) => (p.mlFpr < b ? p.mlFpr : b), 100);
  const sysBestRecallAt1Fpr = curve.filter((p) => p.sysFpr <= 1.0)
    .reduce((b, p) => (p.sysRecall > b ? p.sysRecall : b), 0);

  console.log(`\nRecall/FPR frontier on ${scored.length} rows (${nA} attacks / ${nB} benign), AUC ${auc}\n`);
  console.log(`  RULES-ONLY operating point   FPR ${rulesFpr}%   recall ${rulesRecall}%`);
  console.log(`  >> the SYSTEM curve can never go below FPR ${rulesFpr}%: all tiers are`);
  console.log(`     escalate-only, so the rules tier has already acted.\n`);
  console.log(`  ML-ONLY upper bound (pure threshold, no label gate / abstain / precision gate):`);
  console.log(`     max recall at FPR <= 1%        ${bestRecallAt1Fpr}%     (AC6 wants >= 99%)`);
  console.log(`     min FPR at recall >= 99%       ${minFprAt99Recall === 100 ? "unreachable at any threshold" : minFprAt99Recall + "%"}   (AC6 wants < 1%)\n`);
  console.log(`  SYSTEM (rules OR score>=t):`);
  console.log(`     max recall at FPR <= 1%        ${sysBestRecallAt1Fpr}%   ${rulesFpr > 1 ? "<- impossible: rules alone exceed 1% FPR" : ""}\n`);
  console.log(`  selected operating points:`);
  console.log(`     ${"thr".padStart(8)} ${"ML recall".padStart(10)} ${"ML FPR".padStart(8)}   ${"SYS recall".padStart(10)} ${"SYS FPR".padStart(8)}`);
  for (const target of [0.5, 1, 2, 5, 10, 15, 20, 30]) {
    const p = curve.filter((x) => x.mlFpr <= target).sort((a, b) => b.mlRecall - a.mlRecall)[0];
    if (p) console.log(`     ${String(p.t).padStart(8)} ${String(p.mlRecall).padStart(10)} ${String(p.mlFpr).padStart(8)}   ${String(p.sysRecall).padStart(10)} ${String(p.sysFpr).padStart(8)}   (ML FPR <= ${target}%)`);
  }
  console.log("");

  mkdirSync(path.dirname(path.resolve(process.cwd(), OUT)), { recursive: true });
  writeFileSync(
    path.resolve(process.cwd(), OUT),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        file: FILE,
        rows: scored.length,
        attacks: nA,
        benign: nB,
        aucRaw: auc,
        rulesOnly: { fprPct: rulesFpr, recallPct: rulesRecall },
        systemFprFloorPct: rulesFpr,
        mlOnlyUpperBound: {
          note:
            "Pure threshold on P(attack). Ignores the INPUT label gate (8 of 13 labels admitted), " +
            "the abstain path and the precision gate, so PRODUCTION CAN ONLY DO WORSE. An upper " +
            "bound that misses the target proves no gate tuning reaches it.",
          maxRecallAtFpr1Pct: bestRecallAt1Fpr,
          minFprAtRecall99Pct: minFprAt99Recall === 100 ? null : minFprAt99Recall,
        },
        ac6Targets: { recallPct: 99, fprPct: 1 },
        curve,
      },
      null,
      2,
    ),
  );
  console.log(`wrote ${OUT}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
