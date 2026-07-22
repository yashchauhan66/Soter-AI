/** Diagnostic: which benign inputs score highest (they set the 1%FPR threshold)? */
import { analyzeText } from "../../lib/guard/analyze";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { FRESH_BENIGN } from "./_fresh-heldout-2026-07-20";

async function main() {
  const backend = new ONNXClassifierBackend({
    modelPath: "models/ml-classifier-v3/model.onnx",
    labelsPath: "models/ml-classifier-v3/labels.json",
    confidenceFloor: 0,
  });
  const texts = [
    ...(BENIGN_CONTROL_EXPANDED as { text: string; direction?: string }[])
      .filter((c) => (c.direction ?? "INPUT") === "INPUT").map((c) => c.text),
    ...FRESH_BENIGN,
  ];
  const rows: { t: string; rules: number; ml: number; fused: number; label: string }[] = [];
  for (const t of texts) {
    const rules = Math.max(0, Math.min(100, analyzeText(t, "INPUT").riskScore)) / 100;
    const inf = await backend.infer(t, "INPUT");
    const probs = (inf.raw?.probabilities as number[] | undefined) ?? [];
    const ml = probs.length ? 1 - probs[0] : (inf.predictedLabel === "SAFE" ? 1 - inf.confidence : inf.confidence);
    rows.push({ t, rules, ml, fused: Math.max(rules, ml), label: inf.predictedLabel });
  }
  rows.sort((a, b) => b.fused - a.fused);
  console.log(`\nTop 12 highest-scoring BENIGN (these set the FPR threshold):`);
  for (const r of rows.slice(0, 12)) {
    console.log(`  fused ${r.fused.toFixed(3)} (rules ${r.rules.toFixed(2)} ml ${r.ml.toFixed(2)} ${r.label})  ${r.t.slice(0, 70)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
