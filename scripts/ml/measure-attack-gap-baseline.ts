/**
 * Baseline: how well does the CURRENTLY DEPLOYED v12 enforce path handle the v13
 * attack-gap rows, BEFORE any retrain? This quantifies the real gap the retrain
 * targets (and confirms the benign confusables are not already over-blocked).
 *
 * detected(attack) = the guard takes a protective action on INPUT, whether from
 *   rules (base.action protective) or ML (metadata.ml.escalated). Both collapse to
 *   PROTECTIVE_ACTIONS.has(finalAction). A benign row "detected" is a false positive.
 *
 * Production config forced (v12, enforce, margin -0.10) so the numbers match live.
 */
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
// Defaults, not overrides. As plain assignments these clobbered a caller's env,
// so measuring a candidate model re-measured v12 and reported it under the
// candidate's name -- see the same fix in measure-veto-fix.ts.
process.env.ML_ONNX_MODEL_PATH ??= "models/ml-classifier-v12/model.onnx";
process.env.ML_ONNX_LABELS_PATH ??= "models/ml-classifier-v12/labels.json";
process.env.ML_ONNX_CALIBRATION_PATH ??= "models/ml-classifier-v12/calibration.json";
process.env.SOTERAI_ML_AUGMENT = "enforce";
process.env.SOTERAI_ML_SEMANTIC_MARGIN = "-0.10";

const PROTECTIVE = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);

type Row = { text: string; label: string; category: string };

function readJsonl(file: string): Row[] {
  return readFileSync(file, "utf-8").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}

async function main() {
  const { augmentWithMl } = await import("../../lib/guard/mlAugment");
  const { analyzeText } = await import("../../lib/guard/analyze");
  const rows = readJsonl("datasets/ml-v13-attack-gaps.jsonl");

  type Stat = { n: number; detected: number; rules: number; ml: number };
  const byCat: Record<string, Stat> = {};

  for (const r of rows) {
    const base = analyzeText(r.text, "INPUT");
    const res = await augmentWithMl(base, r.text, "INPUT");
    const ml = (res.metadata as { ml?: { escalated?: boolean } }).ml;
    const rulesDet = PROTECTIVE.has(base.action);
    const mlDet = ml?.escalated === true;
    const det = PROTECTIVE.has(res.action);
    const s = (byCat[r.category] ??= { n: 0, detected: 0, rules: 0, ml: 0 });
    s.n += 1;
    if (det) s.detected += 1;
    if (rulesDet) s.rules += 1;
    if (mlDet) s.ml += 1;
  }

  // Name the artifact actually scored. The header said "v12 baseline" literally,
  // which is the wrong caption the moment the env points elsewhere.
  const scored = path.basename(path.dirname(process.env.ML_ONNX_MODEL_PATH ?? "unknown/x"));
  console.log(`\n=== ${scored} on v13 attack-gap rows (${rows.length}) ===`);
  console.log(`    model: ${process.env.ML_ONNX_MODEL_PATH}`);
  console.log(`(detected = rules-protective OR ml-escalated on INPUT)\n`);
  const attackCats = Object.keys(byCat).filter((c) => c !== "contrastive_benign").sort();
  for (const c of attackCats) {
    const s = byCat[c];
    console.log(
      `  ${c.padEnd(22)} detected ${s.detected}/${s.n} (${(100 * s.detected / s.n).toFixed(1)}%)  ` +
      `[rules ${s.rules}, ml-only ${s.detected - s.rules}]  <- MISSED ${s.n - s.detected}`,
    );
  }
  const b = byCat["contrastive_benign"];
  if (b) {
    console.log(
      `\n  contrastive_benign     FALSE-POSITIVE ${b.detected}/${b.n} (${(100 * b.detected / b.n).toFixed(1)}%)  ` +
      `[rules ${b.rules}, ml ${b.ml}]  (want ~0)`,
    );
  }

  const atkN = attackCats.reduce((a, c) => a + byCat[c].n, 0);
  const atkDet = attackCats.reduce((a, c) => a + byCat[c].detected, 0);
  console.log(`\n  ATTACK families overall: ${atkDet}/${atkN} detected (${(100 * atkDet / atkN).toFixed(1)}%) — the gap the retrain must close`);
}

main().catch((e) => { console.error(e); process.exit(1); });
