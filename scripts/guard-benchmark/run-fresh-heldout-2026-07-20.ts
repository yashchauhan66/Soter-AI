/**
 * Runs the shipped precision-gate design against the FRESH 2026-07-20 held-out
 * corpus. Gating logic is copied verbatim from ml-ensemble-gate-benchmark.ts so
 * the numbers are directly comparable — only the corpus differs.
 *
 *   npx tsx scripts/guard-benchmark/run-fresh-heldout-2026-07-20.ts
 */
import { analyzeText } from "../../lib/guard/analyze";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { classifySemantic } from "../../lib/guard/semanticClassifier";
import { FRESH_ATTACKS, FRESH_BENIGN } from "./_fresh-heldout-2026-07-20";

const PROTECTIVE = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);
const RELIABLE_LABELS = new Set(["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT"]);
const FLOOR = Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.9");
const MARGIN = Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0");

async function main() {
  const backend = new ONNXClassifierBackend({
    modelPath: process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v3/model.onnx",
    labelsPath: process.env.ML_ONNX_LABELS_PATH ?? "models/ml-classifier-v3/labels.json",
  });

  async function escalates(text: string): Promise<boolean> {
    if (PROTECTIVE.has(analyzeText(text, "INPUT").action)) return true;
    const inf = await backend.infer(text, "INPUT");
    if (!RELIABLE_LABELS.has(inf.predictedLabel) || inf.confidence < FLOOR) return false;
    const s = classifySemantic(text);
    return s.score - s.benignSimilarity >= MARGIN;
  }

  const rulesOnly = FRESH_ATTACKS.filter((t) => PROTECTIVE.has(analyzeText(t, "INPUT").action)).length;

  let atk = 0;
  const missed: string[] = [];
  for (const t of FRESH_ATTACKS) {
    if (await escalates(t)) atk++;
    else missed.push(t);
  }
  let fp = 0;
  const fps: string[] = [];
  for (const t of FRESH_BENIGN) {
    if (await escalates(t)) { fp++; fps.push(t); }
  }

  console.log(`\nFRESH held-out (2026-07-20)  floor=${FLOOR} margin=${MARGIN}`);
  console.log(`  corpus: ${FRESH_ATTACKS.length} fresh attacks, ${FRESH_BENIGN.length} fresh near-miss benign`);
  console.log(`  rules-only recall:   ${((100 * rulesOnly) / FRESH_ATTACKS.length).toFixed(1)}% (${rulesOnly}/${FRESH_ATTACKS.length})`);
  console.log(`  gated-ML recall:     ${((100 * atk) / FRESH_ATTACKS.length).toFixed(1)}% (${atk}/${FRESH_ATTACKS.length})`);
  console.log(`  benign FPR:          ${((100 * fp) / FRESH_BENIGN.length).toFixed(1)}% (${fp}/${FRESH_BENIGN.length})`);
  if (missed.length) {
    console.log(`\n  MISSED attacks (${missed.length}):`);
    for (const m of missed) console.log(`   - ${m}`);
  }
  if (fps.length) {
    console.log(`\n  FALSE POSITIVES (${fps.length}):`);
    for (const f of fps) console.log(`   - ${f}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
