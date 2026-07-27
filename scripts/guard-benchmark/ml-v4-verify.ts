/**
 * Honest verification harness for SoterLLM v4 vs v3.
 *
 * Compares:
 *   - rules-only (analyzeText)
 *   - v3 ONNX (models/ml-classifier-v3)
 *   - v4 ONNX (models/ml-classifier-v4 or ML_ONNX_MODEL_PATH)
 *
 * on the frozen untuned held-out corpora. Does NOT tune anything.
 *
 * Run:
 *   npx tsx scripts/guard-benchmark/ml-v4-verify.ts
 *   ML_ONNX_MODEL_PATH=models/ml-classifier-v4/model.onnx \
 *   ML_ONNX_LABELS_PATH=models/ml-classifier-v4/labels.json \
 *   npx tsx scripts/guard-benchmark/ml-v4-verify.ts
 */
import { existsSync } from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { classifySemantic } from "../../lib/guard/semanticClassifier";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { HELDOUT_UNTUNED_ATTACKS, HELDOUT_UNTUNED_BENIGN } from "./_heldout-corpora";

const PROTECTIVE = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);
const RELIABLE = new Set(["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT"]);
const FLOOR = Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.9");
const ATK_FLOOR = Number(process.env.ML_ONNX_ATTACK_PROB_FLOOR ?? "0.85");
const MARGIN = Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0");

type BackendSpec = { name: string; modelPath: string; labelsPath: string; calibrationPath?: string };

async function gatedEscalate(
  backend: ONNXClassifierBackend,
  text: string,
): Promise<boolean> {
  if (PROTECTIVE.has(analyzeText(text, "INPUT").action)) return true;
  const inf = await backend.infer(text, "INPUT");
  const raw = (inf.raw ?? {}) as {
    attackProbability?: number;
    abstained?: boolean;
    rawPredictedLabel?: string;
  };
  if (raw.abstained) return false;
  const label =
    inf.predictedLabel !== "SAFE"
      ? inf.predictedLabel
      : typeof raw.rawPredictedLabel === "string"
        ? raw.rawPredictedLabel
        : inf.predictedLabel;
  const atk = typeof raw.attackProbability === "number" ? raw.attackProbability : 0;
  const confident = inf.confidence >= FLOOR || atk >= ATK_FLOOR;
  if (!RELIABLE.has(label) || !confident) return false;
  const s = classifySemantic(text);
  return s.score - s.benignSimilarity >= MARGIN;
}

async function evalBackend(spec: BackendSpec) {
  if (!existsSync(spec.modelPath) || !existsSync(spec.labelsPath)) {
    console.log(`\n[${spec.name}] SKIP — model not found at ${spec.modelPath}`);
    return null;
  }
  const backend = new ONNXClassifierBackend({
    modelPath: spec.modelPath,
    labelsPath: spec.labelsPath,
    calibrationPath: spec.calibrationPath,
    confidenceFloor: 0, // we gate ourselves
    enableAbstention: true,
  });

  let atkHit = 0;
  for (const t of HELDOUT_UNTUNED_ATTACKS) {
    if (await gatedEscalate(backend, t)) atkHit++;
  }
  let benFp = 0;
  for (const t of HELDOUT_UNTUNED_BENIGN) {
    if (await gatedEscalate(backend, t)) benFp++;
  }
  const control = BENIGN_CONTROL_EXPANDED.slice(0, 300);
  let ctrlFp = 0;
  for (const row of control) {
    const text = typeof row === "string" ? row : (row as { text?: string }).text ?? String(row);
    if (await gatedEscalate(backend, text)) ctrlFp++;
  }

  const result = {
    name: spec.name,
    attackRecall: {
      hits: atkHit,
      total: HELDOUT_UNTUNED_ATTACKS.length,
      pct: Number(((atkHit / HELDOUT_UNTUNED_ATTACKS.length) * 100).toFixed(1)),
    },
    heldoutBenignFPR: {
      fp: benFp,
      total: HELDOUT_UNTUNED_BENIGN.length,
      pct: Number(((benFp / Math.max(1, HELDOUT_UNTUNED_BENIGN.length)) * 100).toFixed(1)),
    },
    controlFPR: {
      fp: ctrlFp,
      total: control.length,
      pct: Number(((ctrlFp / Math.max(1, control.length)) * 100).toFixed(1)),
    },
  };
  console.log(`\n[${spec.name}]`);
  console.log(
    `  attack recall: ${result.attackRecall.hits}/${result.attackRecall.total} (${result.attackRecall.pct}%)`,
  );
  console.log(
    `  held-out benign FPR: ${result.heldoutBenignFPR.fp}/${result.heldoutBenignFPR.total} (${result.heldoutBenignFPR.pct}%)`,
  );
  console.log(
    `  control FPR: ${result.controlFPR.fp}/${result.controlFPR.total} (${result.controlFPR.pct}%)`,
  );
  await backend.dispose();
  return result;
}

async function main() {
  console.log("SoterLLM v4 honest verify");
  console.log(`floor=${FLOOR} attackProbFloor=${ATK_FLOOR} margin=${MARGIN}`);

  // Rules-only baseline
  let rulesHit = 0;
  for (const t of HELDOUT_UNTUNED_ATTACKS) {
    if (PROTECTIVE.has(analyzeText(t, "INPUT").action)) rulesHit++;
  }
  console.log(
    `\n[rules-only] attack recall: ${rulesHit}/${HELDOUT_UNTUNED_ATTACKS.length} (${((rulesHit / HELDOUT_UNTUNED_ATTACKS.length) * 100).toFixed(1)}%)`,
  );

  const specs: BackendSpec[] = [
    {
      name: "v3",
      modelPath: "models/ml-classifier-v3/model.onnx",
      labelsPath: "models/ml-classifier-v3/labels.json",
    },
    {
      name: "v4",
      modelPath: process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v4/model.onnx",
      labelsPath: process.env.ML_ONNX_LABELS_PATH ?? "models/ml-classifier-v4/labels.json",
      calibrationPath:
        process.env.ML_ONNX_CALIBRATION_PATH ?? "models/ml-classifier-v4/calibration.json",
    },
    {
      name: "v4-smoke",
      modelPath: "models/ml-classifier-v4-smoke/model.onnx",
      labelsPath: "models/ml-classifier-v4-smoke/labels.json",
      calibrationPath: "models/ml-classifier-v4-smoke/calibration.json",
    },
  ];

  const results = [];
  for (const s of specs) {
    results.push(await evalBackend(s));
  }
  console.log("\n--- summary ---");
  console.log(JSON.stringify({ rulesHit, results: results.filter(Boolean) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
