/**
 * Turn the miss dump into a v8 dataset decision.
 *
 * WHY THIS IS A SEPARATE STEP — the reachable/unreachable ratio that
 * eval-crossdist-production.ts prints answers "is a retrain worth GPU time at all",
 * but it does NOT answer "what should v8 be trained on". Those are different
 * questions, and conflating them is how a retrain gets built out of rows the model
 * already scores correctly:
 *
 *   reachable  = the model was WRONG (safe-label / model-predicted-safe). More
 *                examples of this shape can move it. Training data is the fix.
 *   unreachable= the model was RIGHT and a gate discarded the prediction
 *                (semantic-benign, label-family, abstention, confidence-floor).
 *                Adding data cannot reach these — the model already predicts the
 *                attack. Only the gate can change, and that is a config/threshold
 *                change measured against FPR, not a GPU job.
 *
 * So this script reports the reachable rows BY LABEL and BY SHAPE, and prints their
 * texts. A v8 dataset is only justified where reachable rows cluster: 40 rows spread
 * across 9 labels is noise, 40 rows of one shape is a gap.
 *
 * It also reports, for each unreachable reason, what the model actually predicted —
 * because a `semantic-benign` block on a row the model scored at 0.98 attack
 * probability is the strongest possible argument for moving that gate, and it is
 * invisible in a count.
 *
 * USAGE
 *   npx tsx scripts/ml/triage-crossdist-misses.ts
 *   npx tsx scripts/ml/triage-crossdist-misses.ts --in artifacts/ml/crossdist-misses.jsonl --samples 6
 */
import { readFileSync, existsSync } from "node:fs";
import { arg } from "./_evalset";

const inPath = arg("--in", "artifacts/ml/crossdist-misses.jsonl");
const samples = Number(arg("--samples", "5"));

type MissRow = {
  text: string; label: string; reason: string;
  predictedLabel?: string; confidence?: number; attackProbability?: number;
  abstained?: boolean; wouldEscalate?: boolean; rulesFlagged?: boolean;
};

if (!existsSync(inPath)) {
  console.error(`[FATAL] ${inPath} not found. Run eval-crossdist-production.ts first —`);
  console.error("        it writes the dump on every run, no flag needed.");
  process.exit(2);
}

const rows: MissRow[] = readFileSync(inPath, "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as MissRow);

if (!rows.length) {
  console.log("dump is empty: every attack in the sample was caught. Nothing to triage.");
  process.exit(0);
}

// Kept in sync with MlGateReason (lib/guard/mlAugment.ts:228-239) plus the two
// synthetic reasons eval-crossdist-production.ts adds when `gatedBy` is absent.
// An unknown reason is printed rather than silently bucketed as unreachable —
// mis-bucketing here would understate what a retrain can fix.
const REACHABLE = new Set(["safe-label", "model-predicted-safe", "ml-did-not-run"]);
const KNOWN = new Set([...REACHABLE, "abstention", "confidence-floor", "label-family", "semantic-benign"]);

const unknown = [...new Set(rows.map((r) => r.reason))].filter((x) => !KNOWN.has(x));
if (unknown.length) {
  console.log(`[WARN] unrecognised gate reasons (not classified): ${unknown.join(", ")}`);
  console.log("       reconcile against MlGateReason before trusting the split below.\n");
}

const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : "0.0");
const oneLine = (t: string, n = 150) => t.replace(/\s+/g, " ").slice(0, n);
const tally = <T>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

const reachable = rows.filter((r) => REACHABLE.has(r.reason));
const gated = rows.filter((r) => !REACHABLE.has(r.reason));

console.log("=".repeat(72));
console.log(`  ${rows.length} misses in ${inPath}`);
console.log(`  ${reachable.length} model errors (${pct(reachable.length, rows.length)}%) — a retrain can reach these`);
console.log(`  ${gated.length} gate discards (${pct(gated.length, rows.length)}%) — a retrain CANNOT reach these`);
console.log("=".repeat(72));

console.log("\nMODEL ERRORS BY LABEL — a v8 dataset is justified where these CLUSTER:");
for (const [label, n] of tally(reachable, (r) => r.label)) {
  console.log(`  ${String(n).padStart(4)}  ${label}`);
}

console.log("\nMODEL ERRORS BY REASON:");
for (const [reason, n] of tally(reachable, (r) => r.reason)) {
  console.log(`  ${String(n).padStart(4)}  ${reason}`);
}

console.log("\nGATE DISCARDS — what the model actually predicted on rows a gate refused.");
console.log("A high attackProbability here argues for moving the GATE, not for a retrain:");
for (const [reason, n] of tally(gated, (r) => r.reason)) {
  const sub = gated.filter((r) => r.reason === reason);
  const probs = sub.map((r) => r.attackProbability).filter((p): p is number => typeof p === "number");
  const med = probs.length
    ? [...probs].sort((a, b) => a - b)[Math.floor(probs.length / 2)].toFixed(3)
    : "n/a";
  const would = sub.filter((r) => r.wouldEscalate === true).length;
  console.log(`  ${String(n).padStart(4)}  ${reason.padEnd(18)} median attackProb ${med}   wouldEscalate ${would}/${n}`);
}

console.log(`\n${"-".repeat(72)}`);
console.log(`MODEL-ERROR TEXTS (up to ${samples} per label) — the actual v8 candidates.`);
console.log("Read these before building anything: if they are near-duplicates of rows");
console.log("already in the training set, more of the same shape will not move them.");
for (const [label] of tally(reachable, (r) => r.label)) {
  const sub = reachable.filter((r) => r.label === label);
  console.log(`\n  [${label}] ${sub.length} rows`);
  for (const r of sub.slice(0, samples)) {
    const pl = r.predictedLabel ?? "(none)";
    const ap = typeof r.attackProbability === "number" ? r.attackProbability.toFixed(3) : "n/a";
    console.log(`    pred=${pl} attackProb=${ap} reason=${r.reason}`);
    console.log(`      ${oneLine(r.text, 190)}`);
  }
}
