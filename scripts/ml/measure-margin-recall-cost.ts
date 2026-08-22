/**
 * REALIZED attack-recall cost of loosening SOTERAI_ML_SEMANTIC_MARGIN.
 *
 * The raw semantic-veto vector (artifacts/ml/veto-fix-fixed.json) says how many
 * attacks the veto WOULD fire on at each margin, but that over-counts: an attack
 * the RULES already flag is detected no matter what the veto does, and the veto
 * only ever runs on rules-clean text (augmentWithMl escalates only when
 * !PROTECTIVE_ACTIONS.has(base.action) — mlAugment.ts:397,434). So the only
 * attacks a looser margin can actually lose are those that are ML-only-detected
 * today: escalated===true at the CURRENT margin (-0.10).
 *
 * REALIZED LOSS at margin m = attacks with gap in [-0.10, m) whose augmentWithMl
 * escalates at margin -0.10. Those are exactly the rows that flip detected->allowed
 * when the margin moves to m. We sample each newly-vetoed band, measure the
 * escalation rate through the REAL augmentWithMl path, and extrapolate to the band.
 *
 * Deterministic stride sampling (no RNG) so the number is reproducible.
 */
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.ML_ONNX_MODEL_PATH = "models/ml-classifier-v12/model.onnx";
process.env.ML_ONNX_LABELS_PATH = "models/ml-classifier-v12/labels.json";
process.env.ML_ONNX_CALIBRATION_PATH = "models/ml-classifier-v12/calibration.json";
process.env.SOTERAI_ML_AUGMENT = "enforce";

const arg = (flag: string, dflt: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const SAMPLE_PER_BAND = Number(arg("--sample", "220"));
const attackFile = arg("--attacks", "datasets/crossdist-eval-v3.jsonl");

// (lo, hi] gap bands. An attack in band (lo, hi] is newly vetoed the moment the
// margin rises above its gap; we attribute it to the smallest candidate >= hi.
const BANDS: Array<{ name: string; lo: number; hi: number; lostAtMargin: number }> = [
  { name: "(-0.10,-0.05]", lo: -0.10, hi: -0.05, lostAtMargin: -0.05 },
  { name: "(-0.05, 0.00]", lo: -0.05, hi: 0.0, lostAtMargin: 0.0 },
];

function readJsonl(file: string): Array<{ text: string; label: string }> {
  return readFileSync(file, "utf-8").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}

async function main() {
  const { augmentWithMl } = await import("../../lib/guard/mlAugment");
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { classifySemantic } = await import("../../lib/guard/semanticClassifier");

  const attacks = readJsonl(attackFile).filter((r) => r.label !== "SAFE");

  // Compute each attack's gap once (text-only, fast).
  const withGap = attacks.map((a) => {
    const s = classifySemantic(a.text);
    return { text: a.text, label: a.label, gap: s.score - s.benignSimilarity };
  });

  // Force the current (baseline) margin for the escalation probe: we want to know
  // whether the row is detected TODAY. Rules are margin-independent.
  process.env.SOTERAI_ML_SEMANTIC_MARGIN = "-0.10";

  console.log(`\n=== realized margin recall cost  (v12, ${attacks.length} attacks) ===`);
  console.log(`current margin -0.10; probing escalation at -0.10 on sampled newly-vetoed rows\n`);

  const perBandLoss: Record<string, { band: number; sampled: number; escalated: number; estLost: number; byClass: Record<string, number> }> = {};

  for (const band of BANDS) {
    const inBand = withGap.filter((r) => r.gap > band.lo && r.gap <= band.hi);
    const stride = Math.max(1, Math.floor(inBand.length / SAMPLE_PER_BAND));
    const sample = inBand.filter((_, i) => i % stride === 0).slice(0, SAMPLE_PER_BAND);
    let escalated = 0;
    const byClass: Record<string, number> = {};
    for (const r of sample) {
      const b = analyzeText(r.text, "INPUT");
      const res = await augmentWithMl(b, r.text, "INPUT");
      const ml = (res.metadata as { ml?: { escalated?: boolean } }).ml;
      if (ml?.escalated === true) {
        escalated += 1;
        byClass[r.label] = (byClass[r.label] ?? 0) + 1;
      }
    }
    const rate = sample.length ? escalated / sample.length : 0;
    const estLost = Math.round(rate * inBand.length);
    perBandLoss[band.name] = { band: inBand.length, sampled: sample.length, escalated, estLost, byClass };
    console.log(`band ${band.name}: ${inBand.length} attacks; sampled ${sample.length}, ${escalated} ML-only-detected (${(100 * rate).toFixed(1)}%)`);
    console.log(`  => est. REALIZED loss if margin rises to ${band.lostAtMargin}: ~${estLost} attacks  ${JSON.stringify(byClass)}`);
  }

  // Cumulative realized loss at each candidate margin.
  const lossAtMinus05 = perBandLoss["(-0.10,-0.05]"].estLost;
  const lossAt00 = lossAtMinus05 + perBandLoss["(-0.05, 0.00]"].estLost;
  console.log(`\ncumulative realized recall loss vs current -0.10:`);
  console.log(`  margin -0.05: ~${lossAtMinus05} attacks (${(100 * lossAtMinus05 / attacks.length).toFixed(2)}% of all attacks)`);
  console.log(`  margin  0.00: ~${lossAt00} attacks (${(100 * lossAt00 / attacks.length).toFixed(2)}% of all attacks)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
