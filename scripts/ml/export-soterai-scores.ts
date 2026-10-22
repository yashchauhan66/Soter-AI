/**
 * AC2 support: dump SoterAI's PER-ROW scores so a competitor harness can do a
 * like-for-like comparison without re-implementing any of the guard.
 *
 * WHY A DUMP AND NOT A SHARED LIBRARY
 *   The competitors are PyTorch/transformers models, so the comparison has to run in
 *   Python. Re-implementing SoterAI's decision there would compare the competitor
 *   against a lookalike, which is exactly how the two in-repo ranking documents got
 *   withdrawn. Production computes SoterAI's numbers here; Python only reads them.
 *
 * WHAT IS DUMPED PER ROW
 *   rulesFlagged  - rules tier alone (analyzeText; sync, never calls augmentWithMl)
 *   soterScore    - the model's P(attack), the same score measure-recall-fpr-frontier
 *                   sweeps, so a competitor ROC is comparable to SoterAI's
 *   soterAction   - the real two-tier action, so the deployed operating point is
 *                   comparable too, not just the curve
 *
 *   Both are needed: AUC answers "who separates better", the action answers "who is
 *   better AS CONFIGURED". A competitor can win one and lose the other.
 *
 *   npx tsx scripts/ml/export-soterai-scores.ts
 */
import * as path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.SOTERAI_ML_AUGMENT = "enforce";

const mod = (rel: string) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
const FILE = "artifacts/ml/v18-balanced-comparison-rows.jsonl";
const OUT = "artifacts/ml/soterai-per-row-scores-2026-10-02.json";

type Row = { text: string; label: string; language?: string; category?: string };
type Verdict = { allowed?: boolean; action?: string };
const flagged = (v: Verdict): boolean =>
  v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

async function main(): Promise<void> {
  const { analyzeText } = (await import(mod("lib/guard/analyze.ts"))) as {
    analyzeText: (t: string, d: string) => Verdict;
  };
  const { augmentWithMl, resolveMlAugmentMode } = (await import(mod("lib/guard/mlAugment.ts"))) as {
    augmentWithMl: (v: Verdict, t: string, d: string) => Promise<Verdict>;
    resolveMlAugmentMode: () => string;
  };
  const { ONNXClassifierBackend, createOnnxBackendFromEnv } = (await import(
    mod("lib/ml/onnxBackend.ts"),
  )) as {
    ONNXClassifierBackend: new () => { infer: (t: string, d: string) => Promise<{ raw?: { attackProbability?: number } }> };
    createOnnxBackendFromEnv: () => { infer: (t: string, d: string) => Promise<{ raw?: { attackProbability?: number } }> } | null;
  };

  const mode = resolveMlAugmentMode();
  if (mode === "off") {
    console.error("[FATAL] ML augment is 'off'; the dumped actions would be rules-only. Refusing.");
    process.exit(2);
  }
  // mlAugment.ts:288-299: the guard path keys off ML_ONNX_MODEL_PATH and constructs
  // directly; createOnnxBackendFromEnv returns null unless ML_BACKEND=onnx.
  const backend = process.env.ML_ONNX_MODEL_PATH
    ? new ONNXClassifierBackend()
    : createOnnxBackendFromEnv();
  if (!backend) {
    console.error("[FATAL] no ML backend; there would be no SoterAI score to compare. Refusing.");
    process.exit(2);
  }

  // 🪤 PRODUCTION ROUNDS THE SCORE TO 4 DECIMALS (onnxBackend.ts:673,
  // `attackProbability: Number(atkProb.toFixed(4))`), and so does every other
  // field in `raw`. Harmless for the live gate, which compares against 0.85. Fatal
  // for a low-FPR benchmark: SoterAI's 1%-FPR threshold sits at 0.9995, inside the
  // band the rounding collapses -- the first export had only 903 distinct scores
  // across 4000 rows and 32 benign rows tied at or above the 20th-highest, so the
  // threshold could not be placed between them. ProtectAI's unrounded scores had
  // 3304 distinct values. The comparison was measuring this export's quantisation
  // as much as either model.
  //
  // Production code is NOT changed to win a benchmark. Instead this instance's
  // decide() -- which every non-trivial infer() path calls with the UNROUNDED
  // softmax (single window and every sliding window) -- is wrapped, and the exact
  // value rides out on the decision object production itself selects. It is
  // computed with production's own attackProbability(), not a replica, and is
  // checked below to round back to exactly what production reported.
  const { attackProbability } = (await import(mod("lib/ml/calibration.ts"))) as {
    attackProbability: (p: number[], safeIndex?: number) => number;
  };
  type Exact = { atk: number; pSafe: number };
  const EXACT = Symbol("exact");
  const b = backend as unknown as {
    decide: (p: number[], span: unknown) => Record<PropertyKey, unknown>;
    safeIndex: number;
  };
  const origDecide = b.decide.bind(backend);
  b.decide = (probabilities: number[], span: unknown) => {
    const d = origDecide(probabilities, span);
    const exact: Exact = { atk: attackProbability(probabilities, b.safeIndex), pSafe: probabilities[b.safeIndex] };
    Object.defineProperty(d, EXACT, { value: exact, enumerable: false });
    return d;
  };

  const rows: Row[] = readFileSync(path.resolve(process.cwd(), FILE), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const out: {
    i: number; isAttack: boolean; label: string; language?: string; category?: string;
    rulesFlagged: boolean; soterScore: number | null; soterScoreExact: number | null;
    soterPSafeExact: number | null; soterAction: string; soterFlagged: boolean;
  }[] = [];

  let escalations = 0, missingScore = 0, exactMismatch = 0, tooShort = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const before = analyzeText(r.text, "INPUT");
    const rulesFlagged = flagged(before);
    const after = await augmentWithMl(before, r.text, "INPUT");
    if (!rulesFlagged && flagged(after)) escalations++;
    const inf = await backend.infer(r.text, "INPUT");
    const ap = inf.raw?.attackProbability;
    if (typeof ap !== "number" || Number.isNaN(ap)) missingScore++;

    // The too-short path (infer() returns before decide() for < 3 chars) carries
    // no exact value; production reports 0 there, so the exact score is 0 too.
    const ex = (inf as unknown as Record<PropertyKey, unknown>)[EXACT] as Exact | undefined;
    let atkExact: number | null = null, pSafeExact: number | null = null;
    if (ex) {
      atkExact = ex.atk;
      pSafeExact = ex.pSafe;
      if (typeof ap === "number" && Number(ex.atk.toFixed(4)) !== ap) exactMismatch++;
    } else if (ap === 0) {
      tooShort++;
      atkExact = 0;
      pSafeExact = 1;
    }
    out.push({
      i,
      isAttack: r.label !== "SAFE",
      label: r.label,
      language: r.language,
      category: r.category,
      rulesFlagged,
      soterScore: typeof ap === "number" && !Number.isNaN(ap) ? ap : null,
      soterScoreExact: atkExact,
      soterPSafeExact: pSafeExact,
      soterAction: after.action ?? "?",
      soterFlagged: flagged(after),
    });
  }

  // The exact value must round back to EXACTLY what production reported, for every
  // row. Anything else means the wrapper captured a different window or a different
  // computation than the one production used, and the "exact" scores would describe
  // a lookalike -- the failure that got two in-repo ranking documents withdrawn.
  if (exactMismatch > 0) {
    console.error(`[FATAL] ${exactMismatch} row(s): exact score does not round to production's`);
    console.error("        reported attackProbability. The wrapper is not capturing production's");
    console.error("        own value. Refusing to write a score file that would mislabel itself.");
    process.exit(2);
  }
  const missingExact = out.filter((o) => o.soterScoreExact === null).length;
  if (missingExact > 0) {
    console.error(`[FATAL] ${missingExact} row(s) carry no exact score and are not the too-short path. Refusing.`);
    process.exit(2);
  }

  if (escalations === 0) {
    console.error("[FATAL] the ML tier escalated 0 rows; the dumped actions are effectively");
    console.error("        rules-only and any comparison built on them would be mislabelled. Refusing.");
    process.exit(2);
  }
  if (missingScore > rows.length * 0.02) {
    console.error(`[FATAL] ${missingScore}/${rows.length} rows had no attackProbability. Refusing.`);
    process.exit(2);
  }

  mkdirSync(path.dirname(path.resolve(process.cwd(), OUT)), { recursive: true });
  writeFileSync(
    path.resolve(process.cwd(), OUT),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        file: FILE,
        mlAugmentMode: mode,
        rows: out.length,
        attacks: out.filter((r) => r.isAttack).length,
        benign: out.filter((r) => !r.isAttack).length,
        mlEscalations: escalations,
        rowsMissingScore: missingScore,
        rowsTooShort: tooShort,
        exactRoundsToReportedOnEveryRow: true,
        distinctReportedScores: new Set(out.map((o) => o.soterScore)).size,
        distinctExactScores: new Set(out.map((o) => o.soterScoreExact)).size,
        note:
          "soterScore is P(attack) AS PRODUCTION REPORTS IT, rounded to 4 decimals " +
          "(onnxBackend.ts:673). soterScoreExact is the same value before rounding, captured " +
          "from production's own decide()/attackProbability() for the window production " +
          "selected, and verified to round back to soterScore on every row. Use the exact score " +
          "for any low-FPR comparison. soterAction is the real two-tier decision. Row order " +
          "matches the battery file exactly, so `i` is the join key.",
        perRow: out,
      },
      null,
      2,
    ),
  );
  console.log(`\nwrote ${OUT}`);
  console.log(`  ${out.length} rows, ${out.filter((r) => r.isAttack).length} attacks, ML escalations ${escalations}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
