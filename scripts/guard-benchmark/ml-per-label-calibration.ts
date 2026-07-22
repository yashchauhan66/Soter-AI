/**
 * Per-label gate calibration (committed, reproducible).
 *
 * Goal: maximize novel-attack recall from the ONNX tier WITHOUT raising benign
 * FPR, by choosing a per-label semantic-margin threshold instead of a single
 * global one. Reliable label classes (injection/jailbreak/leak) can escalate at
 * a loose margin; noisy classes (UNSAFE_OUTPUT, DATA_EXFILTRATION on INPUT) are
 * allowed to escalate ONLY at a strict margin so a genuine attack the model is
 * sure about is recovered while benign code/non-English prose stays allowed.
 *
 * Corpora are the frozen, untuned held-out sets (never tuned against):
 *   - ml-tier-honest-final.ts, fresh-heldout.ts, and the validation set from
 *     tests/guard/heldout-generalization.test.ts.
 *   - benign control: lib/classifiers/datasets/expanded/benignControlExpanded.ts.
 *
 * Run: npx tsx scripts/guard-benchmark/ml-per-label-calibration.ts
 */
import { analyzeText } from "../../lib/guard/analyze";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { classifySemantic } from "../../lib/guard/semanticClassifier";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { HELDOUT_UNTUNED_ATTACKS, HELDOUT_UNTUNED_BENIGN } from "./_heldout-corpora";

const PROTECTIVE = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);
const FLOOR = Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.9");

// Candidate per-label margin policy under test. Lower = easier to escalate.
const LABEL_MARGIN: Record<string, number> = {
  PROMPT_INJECTION: 0.0,
  JAILBREAK: 0.0,
  SYSTEM_PROMPT_LEAK_ATTEMPT: 0.0,
  UNSAFE_OUTPUT: 0.06,
  DATA_EXFILTRATION_ATTEMPT: 0.06,
  PII: 0.06,
  SECRET: 0.06,
  RAG_POISONING: 0.03,
};

async function main() {
  const backend = new ONNXClassifierBackend({
    modelPath: process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v3/model.onnx",
    labelsPath: process.env.ML_ONNX_LABELS_PATH ?? "models/ml-classifier-v3/labels.json",
  });

  async function escalates(text: string, policy: Record<string, number> | "reliable-only"): Promise<boolean> {
    if (PROTECTIVE.has(analyzeText(text, "INPUT").action)) return true;
    const inf = await backend.infer(text, "INPUT");
    if (inf.predictedLabel === "SAFE" || inf.confidence < FLOOR) return false;
    if (policy === "reliable-only") {
      if (!["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT"].includes(inf.predictedLabel)) return false;
      const s = classifySemantic(text);
      return s.score - s.benignSimilarity >= 0;
    }
    const margin = policy[inf.predictedLabel];
    if (margin === undefined) return false;
    const s = classifySemantic(text);
    return s.score - s.benignSimilarity >= margin;
  }

  const control = (BENIGN_CONTROL_EXPANDED as { text: string; direction?: "INPUT" | "OUTPUT" }[])
    .filter((c) => (c.direction ?? "INPUT") === "INPUT");

  async function measure(policy: Record<string, number> | "reliable-only") {
    let atk = 0;
    for (const t of HELDOUT_UNTUNED_ATTACKS) if (await escalates(t, policy)) atk++;
    let hben = 0;
    for (const t of HELDOUT_UNTUNED_BENIGN) if (await escalates(t, policy)) hben++;
    let cben = 0;
    for (const c of control) if (await escalates(c.text, policy)) cben++;
    return {
      recall: (100 * atk) / HELDOUT_UNTUNED_ATTACKS.length,
      heldoutFpr: (100 * hben) / HELDOUT_UNTUNED_BENIGN.length,
      controlFpr: (100 * cben) / control.length,
      atk, hben, cben,
    };
  }

  const na = HELDOUT_UNTUNED_ATTACKS.length, nhb = HELDOUT_UNTUNED_BENIGN.length, nc = control.length;
  console.log(`\nUntuned corpus: ${na} attacks, ${nhb} held-out benign, ${nc} benign-control`);

  const base = await measure("reliable-only");
  console.log(`\nreliable-only (current shipped gate):`);
  console.log(`  recall=${base.recall.toFixed(1)}% (${base.atk}/${na})  heldoutFPR=${base.heldoutFpr.toFixed(1)}% (${base.hben}/${nhb})  controlFPR=${base.controlFpr.toFixed(1)}% (${base.cben}/${nc})`);

  const perLabel = await measure(LABEL_MARGIN);
  console.log(`\nper-label margin policy (candidate):`);
  console.log(`  ${JSON.stringify(LABEL_MARGIN)}`);
  console.log(`  recall=${perLabel.recall.toFixed(1)}% (${perLabel.atk}/${na})  heldoutFPR=${perLabel.heldoutFpr.toFixed(1)}% (${perLabel.hben}/${nhb})  controlFPR=${perLabel.controlFpr.toFixed(1)}% (${perLabel.cben}/${nc})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
