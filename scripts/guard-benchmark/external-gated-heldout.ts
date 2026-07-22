/**
 * HONEST external-benchmark evaluation of SoterLLM (ml-classifier-v3) against
 * genuinely out-of-distribution public sets: HarmBench + JailbreakBench.
 *
 * These prompts were NEVER in the training data (datasets/ml-augmented-v4.jsonl
 * is built from SoterAI's own templates). This is therefore a true novel-attack
 * generalization reading — the real "world best" yardstick, not val F1.
 *
 * The gate logic is copied VERBATIM from run-fresh-heldout-2026-07-20.ts so the
 * numbers are directly comparable to the shipped precision gate:
 *   - rules protective action  → escalate
 *   - else ML: reliable label class + confidence >= FLOOR + semantic-not-benign
 *
 * Crucially it splits ATTACK vs SAFE rows so we report attack-RECALL and
 * benign-FPR SEPARATELY (JailbreakBench ships 100 attack + 100 benign; scoring
 * them all as attacks — as evaluate-public.ts does — is misleading).
 *
 *   npx tsx scripts/guard-benchmark/external-gated-heldout.ts
 */
import * as fs from "fs";
import { analyzeText } from "../../lib/guard/analyze";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
import { classifySemantic } from "../../lib/guard/semanticClassifier";

const PROTECTIVE = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);
const RELIABLE_LABELS = new Set(["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT"]);
const FLOOR = Number(process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "0.9");
const MARGIN = Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0");

const backend = new ONNXClassifierBackend({
  modelPath: process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v3/model.onnx",
  labelsPath: process.env.ML_ONNX_LABELS_PATH ?? "models/ml-classifier-v3/labels.json",
});

async function rulesEscalates(text: string): Promise<boolean> {
  return PROTECTIVE.has(analyzeText(text, "INPUT").action);
}

async function gatedEscalates(text: string): Promise<boolean> {
  if (PROTECTIVE.has(analyzeText(text, "INPUT").action)) return true;
  const inf = await backend.infer(text, "INPUT");
  if (!RELIABLE_LABELS.has(inf.predictedLabel) || inf.confidence < FLOOR) return false;
  const s = classifySemantic(text);
  return s.score - s.benignSimilarity >= MARGIN;
}

type Row = { text: string; isAttack: boolean; category?: string };

function loadRows(path: string): Row[] {
  const lines = fs.readFileSync(path, "utf8").split("\n").filter(Boolean);
  return lines.map((l) => {
    const o = JSON.parse(l);
    const text = o.prompt || o.text || o.data || String(Object.values(o)[0]);
    // Default to ATTACK when no explicit label (HarmBench is all-attack).
    const isAttack = (o.label ?? "ATTACK").toUpperCase() === "ATTACK";
    return { text, isAttack, category: o.category };
  });
}

async function evalSet(name: string, path: string) {
  if (!fs.existsSync(path)) {
    console.log(`\n[SKIP] ${name}: not found at ${path}`);
    return;
  }
  const rows = loadRows(path);
  const attacks = rows.filter((r) => r.isAttack);
  const benign = rows.filter((r) => !r.isAttack);

  let rulesHit = 0;
  let gatedHit = 0;
  const missedCats: Record<string, number> = {};
  for (const r of attacks) {
    if (await rulesEscalates(r.text)) rulesHit++;
    if (await gatedEscalates(r.text)) gatedHit++;
    else missedCats[r.category ?? "?"] = (missedCats[r.category ?? "?"] ?? 0) + 1;
  }

  let fp = 0;
  for (const r of benign) if (await gatedEscalates(r.text)) fp++;

  console.log(`\n── ${name} ── (${attacks.length} attack, ${benign.length} benign)`);
  console.log(`  rules-only attack recall : ${pct(rulesHit, attacks.length)}  (${rulesHit}/${attacks.length})`);
  console.log(`  gated-ML  attack recall  : ${pct(gatedHit, attacks.length)}  (${gatedHit}/${attacks.length})`);
  if (benign.length) console.log(`  benign FPR               : ${pct(fp, benign.length)}  (${fp}/${benign.length})`);
  const missKeys = Object.keys(missedCats).sort((a, b) => missedCats[b] - missedCats[a]);
  if (missKeys.length) {
    console.log(`  missed-by-category:`);
    for (const k of missKeys) console.log(`     ${k.padEnd(34)} ${missedCats[k]}`);
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`;
}

async function main() {
  console.log(`SoterLLM external held-out  floor=${FLOOR} margin=${MARGIN}`);
  console.log(`model=${process.env.ML_ONNX_MODEL_PATH ?? "models/ml-classifier-v3/model.onnx"}`);
  await evalSet("HarmBench", "datasets/external/harmbench.jsonl");
  await evalSet("JailbreakBench", "datasets/external/jailbreakbench.jsonl");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
