/** Diagnostic: confidence distribution of UNSAFE_OUTPUT / DATA_EXFIL firings
 * on the benign control + held-out benign, vs the attack corpus. TEMPORARY. */
import { analyzeText } from "../../lib/guard/analyze";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { classifySemantic } from "../../lib/guard/semanticClassifier";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { HELDOUT_UNTUNED_ATTACKS, HELDOUT_UNTUNED_BENIGN } from "./_heldout-corpora";

const PROTECTIVE = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);
const NOISY = new Set(["UNSAFE_OUTPUT", "DATA_EXFILTRATION_ATTEMPT"]);

async function main() {
  const backend = new ONNXClassifierBackend({
    modelPath: "models/ml-classifier-v3/model.onnx",
    labelsPath: "models/ml-classifier-v3/labels.json",
  });
  const control = (BENIGN_CONTROL_EXPANDED as { text: string; direction?: "INPUT" | "OUTPUT" }[])
    .filter((c) => (c.direction ?? "INPUT") === "INPUT").map((c) => c.text);

  async function scan(name: string, texts: string[]) {
    console.log(`\n=== ${name} (${texts.length}) — noisy-label firings (rules-ALLOW only) ===`);
    const rows: { conf: number; label: string; sem: number; text: string }[] = [];
    for (const t of texts) {
      if (PROTECTIVE.has(analyzeText(t, "INPUT").action)) continue;
      const inf = await backend.infer(t, "INPUT");
      if (!NOISY.has(inf.predictedLabel)) continue;
      const s = classifySemantic(t);
      rows.push({ conf: inf.confidence, label: inf.predictedLabel, sem: s.score - s.benignSimilarity, text: t });
    }
    rows.sort((a, b) => b.conf - a.conf);
    for (const r of rows) {
      console.log(`  ${r.conf.toFixed(3)} ${r.label.padEnd(26)} sem=${r.sem.toFixed(3)}  "${r.text.slice(0, 60)}"`);
    }
    console.log(`  count=${rows.length}`);
  }

  await scan("ATTACKS", HELDOUT_UNTUNED_ATTACKS);
  await scan("HELDOUT_BENIGN", HELDOUT_UNTUNED_BENIGN);
  await scan("BENIGN_CONTROL", control);
}
main().catch((e) => { console.error(e); process.exit(1); });
