/** Diagnostic: which untuned attacks are missed and why. TEMPORARY. */
import { analyzeText } from "../../lib/guard/analyze";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { classifySemantic } from "../../lib/guard/semanticClassifier";
import { HELDOUT_UNTUNED_ATTACKS } from "./_heldout-corpora";

const PROTECTIVE = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);
const RELIABLE = new Set(["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT"]);
const FLOOR = Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.9");
const MARGIN = Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0");

async function main() {
  const backend = new ONNXClassifierBackend({
    modelPath: "models/ml-classifier-v3/model.onnx",
    labelsPath: "models/ml-classifier-v3/labels.json",
  });
  for (const t of HELDOUT_UNTUNED_ATTACKS) {
    const rules = analyzeText(t, "INPUT").action;
    const rulesHit = PROTECTIVE.has(rules);
    const inf = await backend.infer(t, "INPUT");
    const s = classifySemantic(t);
    const semMargin = s.score - s.benignSimilarity;
    const mlHit = RELIABLE.has(inf.predictedLabel) && inf.confidence >= FLOOR && semMargin >= MARGIN;
    const caught = rulesHit || mlHit;
    if (!caught) {
      console.log(`MISS: "${t.slice(0, 70)}"`);
      console.log(`   rules=${rules} | ml=${inf.predictedLabel}@${inf.confidence.toFixed(3)} | reliable=${RELIABLE.has(inf.predictedLabel)} | semMargin=${semMargin.toFixed(3)} score=${s.score.toFixed(3)} benignSim=${s.benignSimilarity.toFixed(3)} semLabel=${s.label}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
