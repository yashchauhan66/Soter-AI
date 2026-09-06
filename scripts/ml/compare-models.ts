/**
 * Score TWO model versions on the IDENTICAL rows through the real production path
 * and report whether the difference is statistically real (McNemar) or noise.
 *
 * WHY THIS EXISTS
 *   A retrain always produces a different number. On a ~700-row battery a "+2 pts
 *   recall" gain is well inside sampling noise, and shipping it as an improvement is
 *   how unfalsifiable progress gets claimed. This repo already has the cautionary
 *   case: v14-vs-v12 looked better OOD until the paired test returned p=0.512, which
 *   REFUTED the frozen-encoder theory and redirected the whole effort to the corpus.
 *   That test is the difference between "we changed the model" and "we improved it".
 *
 *   McNemar is the correct test here because the two models see the SAME rows: it
 *   ignores the rows both get right and both get wrong (which carry no information
 *   about the difference) and asks only whether the DISAGREEMENTS are lopsided.
 *   b = rows only A caught, c = rows only B caught. Under the null (no difference)
 *   a disagreement is a coin flip, so b ~ Binomial(b+c, 0.5).
 *
 * HOW
 *   Each arm runs in a FRESH CHILD PROCESS with ML_ONNX_MODEL_PATH / LABELS_PATH
 *   pointed at that version, because the ONNX session and the label map are memoized
 *   per process — switching versions in-process would score the second arm with the
 *   first arm's weights and silently report "no change".
 *
 * USAGE
 *   npx tsx scripts/ml/compare-models.ts \
 *     --file datasets/v15-test-battery.jsonl \
 *     --a models/ml-classifier-v14 --b models/ml-classifier-v15 \
 *     --out artifacts/ml/v14-vs-v15-battery.json
 */
import * as path from "node:path";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Run tsx's entrypoint through process.execPath. Spawning the `npx.cmd` shim fails
// with EINVAL on Node >=20 (Windows will not spawnSync a .cmd without a shell) and
// reports it via res.error rather than a non-zero exit — i.e. EMPTY stdout that
// parses as an empty result. See measure-gate-widening.ts for the same fix.
const TSX_CLI = (() => {
  const req = createRequire(import.meta.url);
  const pkgPath = req.resolve("tsx/package.json");
  const bin = (req(pkgPath) as { bin?: string | Record<string, string> }).bin;
  const rel = typeof bin === "string" ? bin : (bin?.tsx ?? "./dist/cli.mjs");
  return path.resolve(path.dirname(pkgPath), rel);
})();

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

const file = arg("--file", "datasets/v15-test-battery.jsonl");
const dirA = arg("--a", "models/ml-classifier-v14");
const dirB = arg("--b", "models/ml-classifier-v15");
const outPath = arg("--out", "artifacts/ml/model-compare.json");

// The worker emits ONE per-row verdict array so the parent can pair rows by index.
// It deliberately reports the row's own index rather than its text: pairing by text
// would silently mis-pair if a model's arm dropped or reordered a row.
const WORKER = `
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";
loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.SOTERAI_ML_AUGMENT = "enforce";
const file = process.argv[2];
const mod = (rel) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
(async () => {
  const { analyzeText } = await import(mod("lib/guard/analyze.ts"));
  const { augmentWithMl, resolveMlAugmentMode } = await import(mod("lib/guard/mlAugment.ts"));
  if (resolveMlAugmentMode() === "off") { console.log(JSON.stringify({fatal:"ml resolved to off"})); return; }
  const rows = readFileSync(file, "utf8").split(/\\r?\\n/).filter(Boolean).map((l) => JSON.parse(l));
  const flagged = (v) => v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");
  const verdicts = [];
  let mlRan = 0;
  // Surface WHY the tier did not run. Without this, a config problem is
  // indistinguishable from a model that simply predicted SAFE everywhere.
  let firstMlError = "";
  for (const r of rows) {
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    const ml = after.metadata && after.metadata.ml;
    if (ml && ml.ran === true) mlRan++;
    else if (ml && ml.error && !firstMlError) firstMlError = String(ml.error);
    const hit = flagged(after);
    const isAttack = r.label !== "SAFE";
    verdicts.push({
      label: r.label,
      lang: r.language || "en",
      // "correct" unifies both directions: an attack must be flagged, a benign row
      // must NOT be. McNemar then operates on one boolean per row.
      correct: isAttack ? hit : !hit,
      isAttack,
      predicted: (ml && ml.predictedLabel) || null,
      gatedBy: (ml && ml.gatedBy) || null,
    });
  }
  console.log(JSON.stringify({ mlRan, mlError: firstMlError, verdicts }));
})().catch((e) => { console.log(JSON.stringify({ fatal: String((e && e.message) || e) })); });
`;

const workerPath = path.resolve(process.cwd(), "artifacts/ml/_compare-arm-worker.mts");

type Verdict = {
  label: string; lang: string; correct: boolean; isAttack: boolean;
  predicted: string | null; gatedBy: string | null;
};
type ArmOut = { mlRan?: number; mlError?: string; verdicts?: Verdict[]; fatal?: string };

function runArm(name: string, dir: string, expectRows: number): Verdict[] {
  const modelPath = path.join(dir, "model.onnx");
  const labelsPath = path.join(dir, "labels.json");
  for (const p of [modelPath, labelsPath]) {
    if (!existsSync(p)) {
      console.error(`[arm ${name}] missing ${p} — cannot score this version.`);
      process.exit(1);
    }
  }
  // Pin calibration to THIS version's directory so a stale calibration.json from the
  // other version cannot apply the wrong per-label thresholds. Two traps here:
  //
  //  1. An absent file is OMITTED, never passed as "": spawnSync would set the key to
  //     an empty string, and since dotenv does not overwrite an already-set key, that
  //     empty value SUPPRESSES the real path from .env.
  //  2. ML_ONNX_MANIFEST_PATH is deliberately NOT set. Despite the name it is the
  //     model INTEGRITY/provenance manifest (default `${modelPath}.manifest.json`,
  //     paired with SOTERAI_MODEL_TRUST_STORE), not the dataset manifest. Pointing it
  //     at dataset_manifest.json makes the integrity verifier throw
  //     "Cannot read properties of undefined (reading 'filename')" and the whole tier
  //     goes dark. Leave it to its default.
  const armEnv: Record<string, string> = { ...(process.env as Record<string, string>) };
  armEnv.ML_BACKEND = "onnx";
  armEnv.ML_ONNX_MODEL_PATH = modelPath;
  armEnv.ML_ONNX_LABELS_PATH = labelsPath;
  const calib = path.join(dir, "calibration.json");
  if (existsSync(calib)) armEnv.ML_ONNX_CALIBRATION_PATH = calib;
  else delete armEnv.ML_ONNX_CALIBRATION_PATH;

  const res = spawnSync(process.execPath, [TSX_CLI, workerPath, file], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: armEnv,
  });
  if (res.error) {
    console.error(`[arm ${name}] spawn failed: ${res.error.message}`);
    process.exit(1);
  }
  const line = (res.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() ?? "{}";
  let parsed: ArmOut;
  try {
    parsed = JSON.parse(line) as ArmOut;
  } catch {
    console.error(`[arm ${name}] unparseable output:\n${res.stdout?.slice(0, 800)}\n${res.stderr?.slice(0, 2000)}`);
    process.exit(1);
  }
  if (parsed.fatal) {
    console.error(`[arm ${name}] FATAL: ${parsed.fatal}`);
    process.exit(1);
  }
  // An arm that scored nothing, or a different number of rows, cannot be paired.
  // Reporting it as a result would compare a model against a partial run.
  if (!parsed.verdicts || parsed.verdicts.length !== expectRows) {
    console.error(
      `[arm ${name}] expected ${expectRows} per-row verdicts, got ${parsed.verdicts?.length ?? 0}.\n` +
        `            McNemar requires PAIRED rows; refusing to compare partial runs.\n` +
        `  stderr: ${(res.stderr || "").slice(0, 1500)}`,
    );
    process.exit(1);
  }
  if (!parsed.mlRan) {
    console.error(
      `[arm ${name}] the ML tier never ran (mlRan=0) — this would be a rules-only measurement.\n` +
        `            reported cause: ${parsed.mlError || "(none reported)"}\n` +
        `            model:  ${modelPath}\n            labels: ${labelsPath}`,
    );
    process.exit(1);
  }
  return parsed.verdicts;
}

/** Two-sided exact binomial p-value for b successes in n=b+c flips at p=0.5. */
function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  // log-space binomial to stay exact for large n
  const logFact: number[] = [0];
  for (let i = 1; i <= n; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  const logPmf = (k: number) => logFact[n] - logFact[k] - logFact[n - k] - n * Math.LN2;
  const kObs = Math.min(b, c);
  let tail = 0;
  for (let k = 0; k <= kObs; k++) tail += Math.exp(logPmf(k));
  return Math.min(1, 2 * tail);
}

const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);

function main(): void {
  mkdirSync(path.dirname(workerPath), { recursive: true });
  writeFileSync(workerPath, WORKER);

  const rows = readFileSync(path.resolve(process.cwd(), file), "utf8")
    .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as { label: string });
  console.log(`Comparing on ${file} (${rows.length} rows)\n  A = ${dirA}\n  B = ${dirB}\n`);

  const A = runArm("A", dirA, rows.length);
  const B = runArm("B", dirB, rows.length);

  // ── Paired disagreement table ────────────────────────────────────────────
  // Split by attack/benign: a model can gain recall while losing precision, and a
  // single pooled McNemar would let one hide the other.
  const cell = { bothRight: 0, bothWrong: 0, onlyA: 0, onlyB: 0 };
  const atk = { onlyA: 0, onlyB: 0 };
  const ben = { onlyA: 0, onlyB: 0 };
  const perLabel: Record<string, { n: number; aCorrect: number; bCorrect: number; onlyA: number; onlyB: number }> = {};
  const flips: Array<{ i: number; label: string; direction: string; aPred: string | null; bPred: string | null; aGate: string | null; bGate: string | null }> = [];

  for (let i = 0; i < rows.length; i++) {
    const a = A[i], b = B[i];
    const key = a.label;
    perLabel[key] ??= { n: 0, aCorrect: 0, bCorrect: 0, onlyA: 0, onlyB: 0 };
    const pl = perLabel[key];
    pl.n++;
    if (a.correct) { pl.aCorrect++; }
    if (b.correct) { pl.bCorrect++; }
    if (a.correct && b.correct) cell.bothRight++;
    else if (!a.correct && !b.correct) cell.bothWrong++;
    else if (a.correct && !b.correct) {
      cell.onlyA++; pl.onlyA++;
      (a.isAttack ? atk : ben).onlyA++;
      flips.push({ i, label: a.label, direction: "B_REGRESSED", aPred: a.predicted, bPred: b.predicted, aGate: a.gatedBy, bGate: b.gatedBy });
    } else {
      cell.onlyB++; pl.onlyB++;
      (a.isAttack ? atk : ben).onlyB++;
      flips.push({ i, label: a.label, direction: "B_IMPROVED", aPred: a.predicted, bPred: b.predicted, aGate: a.gatedBy, bGate: b.gatedBy });
    }
  }

  const attacks = A.filter((v) => v.isAttack).length;
  const benign = A.length - attacks;
  const recallA = pct(A.filter((v) => v.isAttack && v.correct).length, attacks);
  const recallB = pct(B.filter((v) => v.isAttack && v.correct).length, attacks);
  const fprA = pct(A.filter((v) => !v.isAttack && !v.correct).length, benign);
  const fprB = pct(B.filter((v) => !v.isAttack && !v.correct).length, benign);

  const pOverall = mcnemarExact(cell.onlyA, cell.onlyB);
  const pAttacks = mcnemarExact(atk.onlyA, atk.onlyB);
  const pBenign = mcnemarExact(ben.onlyA, ben.onlyB);

  const verdict =
    cell.onlyA + cell.onlyB === 0
      ? "IDENTICAL — the two models made the same call on every row"
      : pOverall < 0.05
        ? cell.onlyB > cell.onlyA
          ? "B IS BETTER (statistically significant, p<0.05)"
          : "B IS WORSE (statistically significant, p<0.05)"
        : "NO SIGNIFICANT DIFFERENCE — the delta is within sampling noise";

  const report = {
    file, rows: rows.length, modelA: dirA, modelB: dirB,
    a: { recall: recallA, fpr: fprA }, b: { recall: recallB, fpr: fprB },
    delta: { recallPoints: Number((recallB - recallA).toFixed(2)), fprPoints: Number((fprB - fprA).toFixed(2)) },
    mcnemar: {
      overall: { onlyA: cell.onlyA, onlyB: cell.onlyB, bothRight: cell.bothRight, bothWrong: cell.bothWrong, p: Number(pOverall.toFixed(6)) },
      attacksOnly: { onlyA: atk.onlyA, onlyB: atk.onlyB, p: Number(pAttacks.toFixed(6)) },
      benignOnly: { onlyA: ben.onlyA, onlyB: ben.onlyB, p: Number(pBenign.toFixed(6)) },
    },
    verdict,
    perLabel: Object.fromEntries(
      Object.entries(perLabel).sort().map(([k, v]) => [k, {
        n: v.n,
        aRecall: pct(v.aCorrect, v.n), bRecall: pct(v.bCorrect, v.n),
        deltaPoints: Number((pct(v.bCorrect, v.n) - pct(v.aCorrect, v.n)).toFixed(2)),
        onlyA: v.onlyA, onlyB: v.onlyB,
      }]),
    ),
    flips: flips.slice(0, 200),
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("=".repeat(76));
  console.log(`  A  recall ${recallA}%   FPR ${fprA}%`);
  console.log(`  B  recall ${recallB}%   FPR ${fprB}%`);
  console.log(`  delta  ${report.delta.recallPoints >= 0 ? "+" : ""}${report.delta.recallPoints} pts recall   ` +
    `${report.delta.fprPoints >= 0 ? "+" : ""}${report.delta.fprPoints} pts FPR`);
  console.log("-".repeat(76));
  console.log(`  McNemar paired test (only the ${cell.onlyA + cell.onlyB} DISAGREEMENTS carry information)`);
  console.log(`    only A correct: ${cell.onlyA}    only B correct: ${cell.onlyB}    p = ${pOverall.toFixed(6)}`);
  console.log(`    attacks only:   A ${atk.onlyA} / B ${atk.onlyB}   p = ${pAttacks.toFixed(6)}`);
  console.log(`    benign only:    A ${ben.onlyA} / B ${ben.onlyB}   p = ${pBenign.toFixed(6)}`);
  console.log("-".repeat(76));
  console.log(`  ${verdict}`);
  console.log("-".repeat(76));
  console.log("  per-label (negative delta = B regressed on that label)");
  for (const [k, v] of Object.entries(report.perLabel)) {
    const d = (v as { deltaPoints: number }).deltaPoints;
    const mark = d < 0 ? "  <-- REGRESSION" : "";
    console.log(`    ${k.padEnd(28)} n=${String((v as { n: number }).n).padStart(4)}  ` +
      `${String((v as { aRecall: number }).aRecall).padStart(6)}% -> ${String((v as { bRecall: number }).bRecall).padStart(6)}%  ` +
      `${d >= 0 ? "+" : ""}${d}${mark}`);
  }
  console.log(`\n[write] ${outPath}`);
}

main();
