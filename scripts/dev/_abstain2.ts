/**
 * Split the 40 abstentions by WHICH branch fired, using the real tokenizer and the
 * real entropy function rather than a chars/4 proxy. The two branches have different
 * fixes and only one of them is a training-data problem:
 *
 *   truncated-view  -> onnxBackend.ts:583 refused because the model saw only the
 *                      first 256 tokens of a longer input. The remedy the code itself
 *                      names (line 576) is ML_ONNX_SLIDING_WINDOW, a config change.
 *                      No GPU, no retrain.
 *   entropy-budget  -> shouldAbstain refused because binary entropy at the deployed
 *                      budget 0.40 was over budget. That IS model uncertainty, so it
 *                      is reachable by training data — subject to the label sanity
 *                      question, since "are you joking?" carries an attack label here.
 *
 * binaryEntropy is imported, not reimplemented: a hand-rolled copy that disagreed
 * with production would attribute rows to the wrong branch, which is the whole
 * question being asked.
 */
import { readFileSync } from "node:fs";
import { binaryEntropy } from "../../lib/ml/calibration";
import { encodeForModel } from "../../lib/ml/bertTokenizer";

type MissRow = { text: string; label: string; reason: string; attackProbability?: number; confidence?: number };
const rows: MissRow[] = readFileSync("artifacts/ml/crossdist-misses.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as MissRow);

const WINDOW = Number(process.env.ML_ONNX_MAX_LENGTH ?? "256");
const BUDGET = Number(process.env.SOTERAI_ML_ABSTAIN_ENTROPY ?? "0.40");

const abst = rows.filter((r) => r.reason === "abstention");

let truncOnly = 0, entropyOnly = 0, both = 0, neither = 0;
const entropyRows: { r: MissRow; H: number; toks: number }[] = [];

for (const r of abst) {
  // Content tokens only — the [CLS]/[SEP] pair is what the backend subtracts too.
  const toks = encodeForModel(r.text, WINDOW + 4096).inputIds.length;
  const truncated = toks > WINDOW;
  const H = typeof r.attackProbability === "number" ? binaryEntropy(r.attackProbability) : NaN;
  const overBudget = Number.isFinite(H) && H > BUDGET;
  if (truncated && overBudget) both++;
  else if (truncated) truncOnly++;
  else if (overBudget) { entropyOnly++; entropyRows.push({ r, H, toks }); }
  else {
    neither++;
    entropyRows.push({ r, H, toks });
  }
}

console.log(`window ${WINDOW} tokens   entropy budget ${BUDGET}   (ln2 = 0.6931 max)\n`);
console.log(`abstentions: ${abst.length}`);
console.log(`  truncated view only        ${truncOnly}   -> ML_ONNX_SLIDING_WINDOW, no retrain`);
console.log(`  over entropy budget only   ${entropyOnly}   -> real model uncertainty`);
console.log(`  both                       ${both}   -> sliding window may fix; entropy may still refuse`);
console.log(`  neither (unexplained)      ${neither}   -> attribution gap, investigate before trusting`);

console.log(`\nrows refused by ENTROPY on a complete view — these are the retrain candidates.`);
console.log(`Judge the LABEL as well as the text: an attack label on ordinary chat is an`);
console.log(`eval-set defect, and training on it teaches the model to accuse users.`);
for (const { r, H, toks } of entropyRows.sort((a, b) => a.H - b.H).slice(0, 20)) {
  console.log(`  H=${H.toFixed(3)} atkProb=${(r.attackProbability ?? 0).toFixed(3)} toks=${toks} [${r.label}]`);
  console.log(`    ${r.text.replace(/\s+/g, " ").slice(0, 160)}`);
}
