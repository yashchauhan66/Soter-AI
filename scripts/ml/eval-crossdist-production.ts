/**
 * Measure the REAL production path on the cross-distribution eval: rules THEN ML.
 *
 * WHY THIS EXISTS — read this before trusting any earlier crossdist number.
 *   eval-crossdist.ts and eval-crossdist-bylabel.ts both score `analyzeText()`.
 *   `analyzeText` is synchronous and does NOT call `augmentWithMl` — grep it: the
 *   ML tier is applied one layer up, in the app/api/guard route handlers and
 *   lib/gateway/core.ts. So those harnesses measure the RULES TIER ONLY. The
 *   `await` in front of the synchronous call hid it, and the docstring's promise to
 *   report "rules-only, ML-only and end-to-end separately" was never implemented.
 *
 *   That is the whole explanation for why v7 reproduced the v4 baseline
 *   byte-for-byte (1273/3188 attacks, 24/347 benign): neither model was ever in the
 *   code path. The retrain was not measured and found equal; it was not measured.
 *
 *   This harness composes the two tiers the way a request does, so the ML delta is
 *   observable: rulesRecall -> endToEndRecall. If those two are equal HERE, with
 *   the model provably loaded (mlTierRan > 0), then the model genuinely adds
 *   nothing and the gates or the training data are the problem.
 *
 * WHAT IT ALSO REPORTS
 *   Every attack the ML tier predicted but a gate refused, attributed to the gate
 *   (MlGateReason from mlAugment). That distinguishes "the model missed it" from
 *   "the model caught it and INPUT_RELIABLE_LABELS dropped it" — different bugs,
 *   different fixes, and indistinguishable in a plain recall number.
 *
 * USAGE
 *   npx tsx scripts/ml/eval-crossdist-production.ts \
 *     --file datasets/crossdist-eval-v3.jsonl --limit 1200
 */
import * as path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";
import { arg, loadEvalSet, type Row } from "./_evalset";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const file = arg("--file", "datasets/crossdist-eval-v3.jsonl");
const limit = Number(arg("--limit", "1200"));
const outPath = arg("--out", "artifacts/ml/crossdist-production.json");
// Written unconditionally, not behind an opt-in flag. The counts in the JSON report
// are a summary OF these rows; making the rows optional means the default run emits
// a number nobody can check and the dump only exists when someone already suspected
// something. Every field in the report above is re-derivable from these two files.
const missPath = arg("--dump-misses", "artifacts/ml/crossdist-misses.jsonl");
const fpPath = arg("--dump-fps", "artifacts/ml/crossdist-false-positives.jsonl");
// Default to enforce so the ML tier is actually exercised; .env may say shadow,
// which would silently reproduce the rules-only bug this script exists to expose.
process.env.SOTERAI_ML_AUGMENT = arg("--mode", "enforce");

/** Stratified subsample; SAFE dominates the file, so first-N would skew benign. */
function sample(all: Row[], n: number): Row[] {
  if (!n || n >= all.length) return all;
  const byLabel = new Map<string, Row[]>();
  for (const r of all) {
    const list = byLabel.get(r.label) ?? [];
    list.push(r);
    byLabel.set(r.label, list);
  }
  const out: Row[] = [];
  const perLabel = Math.max(1, Math.floor(n / byLabel.size));
  for (const list of byLabel.values()) {
    const step = Math.max(1, Math.floor(list.length / perLabel));
    for (let i = 0; i < list.length && out.length < n; i += step) out.push(list[i]);
  }
  return out;
}

type Tally = { attacks: number; caught: number; benign: number; fp: number };
const blank = (): Tally => ({ attacks: 0, caught: 0, benign: 0, fp: 0 });
const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);

async function main(): Promise<void> {
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl, resolveMlAugmentMode } = await import("../../lib/guard/mlAugment");

  const mode = resolveMlAugmentMode();
  if (mode === "off") {
    console.error("[FATAL] ML tier resolved to 'off'. Set ML_ONNX_MODEL_PATH; refusing to");
    console.error("        emit a number that would look like an ML measurement but is not.");
    process.exit(2);
  }

  const cases = sample(loadEvalSet(file), limit);
  const rules = blank();
  const e2e = blank();
  const byLabel = new Map<string, Tally>();
  const gateCounts = new Map<string, number>();
  const gateByLabel = new Map<string, Map<string, number>>();
  let mlRan = 0;
  let mlErrors = 0;
  let rescuedByMl = 0;
  let newFpFromMl = 0;
  // Gate-reason COUNTS say how many rows were missed and why, but not which rows.
  // "add data for label X" cannot be acted on from a count: building a v8 training
  // set requires the miss texts themselves, and re-deriving them by hand from a
  // count is guesswork. Recorded per row with its gate reason so the reason stays
  // attached to the text — a `semantic-benign` miss and a `safe-label` miss need
  // opposite fixes, and only the latter is reachable by more training data.
  // Field names mirror MlAugmentDetail (mlAugment.ts:241) exactly. Inventing a key
  // here would dump `undefined` for every row and read as "the model never scored
  // it", which is the same class of false negative the `ml` vs `mlAugment` note
  // above records. predictedLabel + attackProbability are what separate "the model
  // never saw this attack shape" (reachable by training data) from "the model
  // scored it correctly and a gate discarded the prediction" (not reachable).
  type MissRow = {
    text: string; label: string; reason: string;
    predictedLabel?: string; confidence?: number; attackProbability?: number;
    abstained?: boolean; wouldEscalate?: boolean; rulesFlagged: boolean;
  };
  const missRows: MissRow[] = [];
  const fpRows: { text: string; label: string; fromMl: boolean;
    predictedLabel?: string; confidence?: number }[] = [];

  const flagged = (v: { allowed?: boolean; action?: string }) =>
    v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

  for (let i = 0; i < cases.length; i++) {
    const r = cases[i];
    const isAttack = r.label !== "SAFE";
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");

    // NOTE: the key is `ml`, not `mlAugment` — withMlMetadata (mlAugment.ts:352)
    // writes `metadata.ml`. Reading the wrong key here would report mlTierRan: 0
    // on a perfectly working tier, i.e. the same false negative this file exists
    // to expose. Keep this in sync with MlAugmentDetail.
    const ml = (after.metadata as { ml?: Record<string, unknown> } | undefined)?.ml;
    if (ml?.ran === true) mlRan++;
    if (typeof ml?.error === "string") mlErrors++;

    const rulesHit = flagged(before);
    const e2eHit = flagged(after);
    const lt = byLabel.get(r.label) ?? blank();

    if (isAttack) {
      rules.attacks++; e2e.attacks++; lt.attacks++;
      if (rulesHit) rules.caught++;
      if (e2eHit) { e2e.caught++; lt.caught++; }
      if (!rulesHit && e2eHit) rescuedByMl++;
      if (!e2eHit) {
        const reason = (ml?.gatedBy as string) ?? (ml?.ran ? "model-predicted-safe" : "ml-did-not-run");
        gateCounts.set(reason, (gateCounts.get(reason) ?? 0) + 1);
        // Per-label too: "add more data for label X" is only the right fix when X's
        // misses are actually `safe-label` (the model did not see the attack). If
        // they are `label-family` or `semantic-benign`, more data cannot reach them
        // at all, because the gate discards the prediction after the model made it.
        const byLbl = gateByLabel.get(r.label) ?? new Map<string, number>();
        byLbl.set(reason, (byLbl.get(reason) ?? 0) + 1);
        gateByLabel.set(r.label, byLbl);
        missRows.push({
          text: r.text, label: r.label, reason,
          predictedLabel: ml?.predictedLabel as string | undefined,
          confidence: ml?.confidence as number | undefined,
          attackProbability: ml?.attackProbability as number | undefined,
          abstained: ml?.abstained as boolean | undefined,
          wouldEscalate: ml?.wouldEscalate as boolean | undefined,
          // Always false here by construction (this branch is `!e2eHit`, and rules
          // run first), but recorded so the dump is self-describing: a reader can
          // confirm from the file alone that no miss was a rules hit the ML tier
          // then un-flagged, rather than having to trust that augmentWithMl is
          // monotonic.
          rulesFlagged: rulesHit,
        });
      }
    } else {
      rules.benign++; e2e.benign++; lt.benign++;
      if (rulesHit) rules.fp++;
      if (e2eHit) { e2e.fp++; lt.fp++; }
      if (!rulesHit && e2eHit) newFpFromMl++;
      // Dumped for the same reason as the misses: an FPR figure cannot be acted on,
      // and the two causes need opposite fixes. `fromMl` false means a rule accused
      // the row (fix the rule); true means the model did (fix the training data).
      if (e2eHit) {
        fpRows.push({
          text: r.text, label: r.label, fromMl: !rulesHit,
          predictedLabel: ml?.predictedLabel as string | undefined,
          confidence: ml?.confidence as number | undefined,
        });
      }
    }
    byLabel.set(r.label, lt);
    if ((i + 1) % 100 === 0) process.stderr.write(`\r[scan] ${i + 1}/${cases.length}`);
  }
  process.stderr.write(`\r[scan] ${cases.length}/${cases.length}\n`);

  const report = {
    file, sampled: cases.length, mlMode: mode,
    // RECORD THE INPUT BOUND, NOT JUST THE OUTPUT COUNT. `--limit` is an input
    // bound: sample() strides per label at `floor(list.length / floor(limit/labels))`,
    // so a different --limit produces a different STRIDE, not a subset. --limit 3987
    // yields 3,636 rows on rows that are NOT a subset of what --limit 4250 yields
    // (which is the canonical 3,987-row sample). Two artifacts can therefore agree
    // on `sampled` and still be scored on different rows. Without this field the
    // only way to tell was per-label counts, and a v3 run was silently
    // non-comparable until those exposed it.
    limit,
    semanticMargin: Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0"),
    // The abstention operating points, for the same reason `limit` is here: two
    // runs can agree on every other field and still be different experiments.
    // null means "unset, so calibration.json's fitted value applies" — which is
    // what production does. See lib/ml/calibration.ts resolveOverride.
    abstainEntropyOverride: process.env.SOTERAI_ML_ABSTAIN_ENTROPY
      ? Number(process.env.SOTERAI_ML_ABSTAIN_ENTROPY)
      : null,
    abstainFloorOverride: process.env.SOTERAI_ML_ABSTAIN_FLOOR
      ? Number(process.env.SOTERAI_ML_ABSTAIN_FLOOR)
      : null,
    // The semantic recall booster lives INSIDE analyzeText, so this flag moves the
    // `rulesOnly` column, not the ML delta — two runs at different tiers are
    // different experiments even though neither touches the model. Recorded for the
    // same reason as `limit` and `semanticMargin`. null means unset -> "hybrid".
    detectionTier: process.env.SOTERAI_DETECTION_TIER ?? null,
    modelPath: process.env.ML_ONNX_MODEL_PATH ?? null,
    mlTierRan: mlRan, mlErrors,
    rulesOnly: { recall: pct(rules.caught, rules.attacks), fpr: pct(rules.fp, rules.benign),
      caught: rules.caught, attacks: rules.attacks, fp: rules.fp, benign: rules.benign },
    endToEnd: { recall: pct(e2e.caught, e2e.attacks), fpr: pct(e2e.fp, e2e.benign),
      caught: e2e.caught, attacks: e2e.attacks, fp: e2e.fp, benign: e2e.benign },
    mlDelta: {
      recallPoints: Number((pct(e2e.caught, e2e.attacks) - pct(rules.caught, rules.attacks)).toFixed(2)),
      fprPoints: Number((pct(e2e.fp, e2e.benign) - pct(rules.fp, rules.benign)).toFixed(2)),
      attacksRescuedByMl: rescuedByMl, newFalsePositivesFromMl: newFpFromMl,
    },
    gateAttributionForMisses: Object.fromEntries([...gateCounts].sort((a, b) => b[1] - a[1])),
    gateAttributionByLabel: Object.fromEntries(
      [...gateByLabel].map(([label, m]) => [
        label,
        Object.fromEntries([...m].sort((a, b) => b[1] - a[1])),
      ]),
    ),
    byLabel: Object.fromEntries([...byLabel].map(([k, v]) => [k,
      { recall: pct(v.caught, v.attacks), attacks: v.attacks, caught: v.caught,
        fpr: pct(v.fp, v.benign), benign: v.benign }])),
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  // Sorted by gate reason so the file groups the way the fix does: all `safe-label`
  // rows together (candidates for v8 training data), all `semantic-benign` and
  // `label-family` rows together (the model already scored these correctly — adding
  // data cannot reach them, the gate has to change). Unsorted, the two are
  // interleaved and the file invites building a dataset out of unreachable rows.
  const missSorted = [...missRows].sort(
    (a, b) => a.reason.localeCompare(b.reason) || a.label.localeCompare(b.label),
  );
  // `[].join("\n") + "\n"` is a one-byte file that reads as one blank JSONL record,
  // so a perfect run would look like a corrupt dump. Empty means empty.
  const jsonl = (xs: unknown[]) => (xs.length ? xs.map((x) => JSON.stringify(x)).join("\n") + "\n" : "");
  mkdirSync(path.dirname(missPath), { recursive: true });
  writeFileSync(missPath, jsonl(missSorted), "utf8");
  mkdirSync(path.dirname(fpPath), { recursive: true });
  writeFileSync(fpPath, jsonl(fpRows), "utf8");

  console.log("\n" + "=".repeat(64));
  console.log(`  model      ${report.modelPath ?? "(none)"}`);
  console.log(`  ml mode    ${mode}   ran on ${mlRan}/${cases.length} rows   errors ${mlErrors}`);
  console.log(`  --limit    ${limit} -> ${cases.length} rows   semantic margin ${report.semanticMargin}`);
  console.log(`  tier       ${report.detectionTier ?? "(default hybrid)"}`);
  console.log(`  abstain    entropy ${report.abstainEntropyOverride ?? "(calibration)"}   ` +
    `floor ${report.abstainFloorOverride ?? "(calibration)"}`);
  console.log("-".repeat(64));
  console.log(`  rules only   recall ${report.rulesOnly.recall}%   FPR ${report.rulesOnly.fpr}%`);
  console.log(`  rules + ML   recall ${report.endToEnd.recall}%   FPR ${report.endToEnd.fpr}%`);
  console.log(`  ML delta     ${report.mlDelta.recallPoints >= 0 ? "+" : ""}${report.mlDelta.recallPoints} pts recall   ` +
    `${report.mlDelta.fprPoints >= 0 ? "+" : ""}${report.mlDelta.fprPoints} pts FPR`);
  console.log(`               rescued ${rescuedByMl} attacks, added ${newFpFromMl} false positives`);
  if (mlRan === 0) {
    console.log("\n  [WARNING] the ML tier never ran. This is a rules-only number.");
  }
  console.log("\n  gate attribution for remaining misses:");
  for (const [k, v] of report.gateAttributionForMisses ? Object.entries(report.gateAttributionForMisses) : []) {
    console.log(`    ${k.padEnd(26)} ${v}`);
  }
  // The one number that decides whether a retrain is worth GPU time. `safe-label` is
  // the model flat-out predicting SAFE on an attack: the model was WRONG, and more
  // examples of that shape can move it. `abstention` is the model declining to
  // commit (flat output distribution) — also model error, also movable by training
  // data, which is why it is bucketed WITH safe-label here: it is not "the model
  // scored correctly and a gate discarded it", it is the model having no opinion.
  // What is NOT reachable is a miss where the model was RIGHT and a gate discarded
  // the prediction (`semantic-benign`, `label-family`, `confidence-floor`): training
  // on those rows spends compute to reinforce a prediction the production pipeline
  // already throws away. `model-predicted-safe` and `ml-did-not-run` are the
  // synthetic reasons for "gatedBy was absent" — a crashed inference is a data
  // failure too, so it is treated as reachable.
  const REACHABLE = new Set(["safe-label", "abstention", "model-predicted-safe", "ml-did-not-run"]);
  const reachable = missRows.filter((m) => REACHABLE.has(m.reason)).length;
  console.log(`\n  of ${missRows.length} misses, ${reachable} are model errors ` +
    `(${pct(reachable, missRows.length)}%) — reachable by training data;`);
  console.log(`  the other ${missRows.length - reachable} were scored correctly and ` +
    `discarded by a gate — a gate fix, not a data fix.`);
  console.log(`\n[write] ${outPath}`);
  console.log(`[write] ${missPath}  (${missRows.length} rows, sorted by gate reason)`);
  console.log(`[write] ${fpPath}  (${fpRows.length} rows)`);
}

main();
