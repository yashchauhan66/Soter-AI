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

  const rows: Row[] = readFileSync(path.resolve(process.cwd(), FILE), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const out: {
    i: number; isAttack: boolean; label: string; language?: string; category?: string;
    rulesFlagged: boolean; soterScore: number | null; soterAction: string; soterFlagged: boolean;
  }[] = [];

  let escalations = 0, missingScore = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const before = analyzeText(r.text, "INPUT");
    const rulesFlagged = flagged(before);
    const after = await augmentWithMl(before, r.text, "INPUT");
    if (!rulesFlagged && flagged(after)) escalations++;
    const inf = await backend.infer(r.text, "INPUT");
    const ap = inf.raw?.attackProbability;
    if (typeof ap !== "number" || Number.isNaN(ap)) missingScore++;
    out.push({
      i,
      isAttack: r.label !== "SAFE",
      label: r.label,
      language: r.language,
      category: r.category,
      rulesFlagged,
      soterScore: typeof ap === "number" && !Number.isNaN(ap) ? ap : null,
      soterAction: after.action ?? "?",
      soterFlagged: flagged(after),
    });
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
        note:
          "soterScore is raw P(attack) from the production backend; soterAction is the real " +
          "two-tier decision. Row order matches the battery file exactly, so `i` is the join key.",
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
