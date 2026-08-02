/**
 * `npm run ml:verify:v4` — honest v3-vs-v4 comparison on the frozen held-out corpora.
 *
 * WHY THIS WAS REWRITTEN
 *   The previous version printed the rules-only baseline and then died. It never
 *   loaded an env file, so SOTERAI_MODEL_TRUST_STORE was unset, the supply-chain
 *   gate correctly refused the first model, the OnnxBackendError escaped
 *   evalBackend, and main().catch() exited 1 — no per-backend block was ever
 *   printed, and one unusable artifact erased the results of all the others.
 *   Two fixes: read the same env the app reads, and isolate each backend so a
 *   rejected artifact is a SKIP with a stated reason instead of a dead run.
 *
 * WHAT IT MEASURES
 *   The PRODUCTION decision path — analyzeText, then augmentWithMl — not a local
 *   copy of the precision gate. The old harness re-implemented the gate (label
 *   family, floors, semantic margin) inside itself, which can pass while
 *   production fails and stops tracking mlAugment the moment the real gate
 *   changes. This harness exists to decide whether a change to the v4 decision
 *   layer is worth shipping, so it has to exercise the layer that ships.
 *
 *   Per backend: combined attack recall, how much of it the ML tier added on top
 *   of rules, held-out benign FPR, control FPR, and — the number the decision-layer
 *   work needs — WHY each missed attack was not escalated, read from
 *   metadata.ml.gatedBy (abstention / label-family / confidence-floor /
 *   semantic-benign).
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   Tune anything. The corpora are frozen and untuned and the thresholds come from
 *   the env under test. It also runs with the long-input sweep OFF, i.e. the
 *   shipped default; `npm run ml:evidence:window` is the harness for that flag.
 *
 * Run:
 *   npm run ml:verify:v4                                   (reads .env)
 *   npx tsx scripts/guard-benchmark/ml-v4-verify.ts --env .env.production
 *   npx tsx scripts/guard-benchmark/ml-v4-verify.ts --control 60   (fast loop)
 *
 * Exit codes: 0 when at least one backend was measured, 1 when none could be
 * (a harness that produced no ML evidence must not look like a pass).
 *
 * LAST MEASURED — 2026-08-01, env .env (floor 0.5, margin 0, sweep off),
 * 54 untuned attacks / 44 held-out benign / 300 control. Held-out benign FPR was
 * 0/44 for every row below.
 *
 *   rules-only  45/54  83.3%
 *
 *   BEFORE the binary-abstention fix (9-class entropy gated abstention):
 *     v3        53/54  98.1%  (+8)   control FPR 2.7%  (7 ML-caused)   miss: safe-label 1
 *     v4        52/54  96.3%  (+7)   control FPR 0.7%  (1 ML-caused)   miss: abstention 2
 *
 *   AFTER (lib/ml/calibration.ts shouldAbstain measures attack-vs-safe):
 *     v3        53/54  98.1%  (+8)   control FPR 2.7%  (7 ML-caused)   miss: safe-label 1
 *     v4        53/54  98.1%  (+8)   control FPR 1.0%  (2 ML-caused)   miss: semantic-benign 1
 *
 * Read the before-rows as the case for the fix: v4 was the better operating point
 * (six fewer false positives for one attack) and 2 of its 2 misses were the
 * abstention gate rather than the model failing to see the attack.
 *
 * Read the after-rows as the result: v4 now matches v3's recall at 1.0% control FPR
 * instead of 2.7%, i.e. the same detection for 1/3 of the false positives — one
 * recovered attack cost one control false positive. v3 is unchanged, which is the
 * expected null result: it ships no calibration.json, so abstention was already
 * inert for it. v4's last miss is no longer abstention — the model scores it
 * P(attack) 0.9817 and the semantic prototype gate vetoes it (--explain shows
 * which); it is also the one attack v3 misses.
 *
 * LEVERS ALREADY PRICED HERE — do not re-tune blind:
 *   SOTERAI_ML_SEMANTIC_MARGIN -0.1 (loosen the prototype veto): v4 53/54 -> 54/54
 *   for control FPR 1.0% -> 1.3%, but v3 gains nothing and loses precision (held-out
 *   benign 0 -> 1/44, control 2.7% -> 3.7%). REJECTED: the benign text it admits on
 *   v4 ("Turn these bullet points into a concise executive summary.") scores
 *   P(attack) 0.9843, ABOVE the 0.9817 attack it recovers, so no confidence-
 *   conditioned version of the same lever exists either. See the veto comment in
 *   lib/guard/mlAugment.ts for the numbers.
 *   INPUT_RELIABLE_LABELS (loosen the label filter): no evidence to act on — the
 *   `label-family` miss bucket is 0 on both backends at both margins, while v3's
 *   false positives are benign programming answers labelled PROMPT_INJECTION at
 *   P(attack) up to 0.9999, which is the case FOR keeping the filter.
 */

import { existsSync } from "node:fs";
import * as path from "node:path";
import { config as loadEnvFile } from "dotenv";
import { analyzeText } from "../../lib/guard/analyze";
import type { MlAugmentDetail } from "../../lib/guard/mlAugment";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { HELDOUT_UNTUNED_ATTACKS, HELDOUT_UNTUNED_BENIGN } from "./_heldout-corpora";

const argv = process.argv.slice(2);
function flag(name: string, fallback?: string): string | undefined {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : fallback;
}

// The gate that killed the old run is env-configured (trust store + approved
// sources), and so are the thresholds. A benchmark that reads a different
// configuration than the app measures a system nobody deployed.
const envFile = flag("env", ".env")!;
loadEnvFile({ path: path.resolve(process.cwd(), envFile), quiet: true });

const PROTECTIVE = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);
const CONTROL_SIZE = Number(flag("control", "300"));
/** --explain prints one line per missed attack (which gate refused, on what score)
 *  and one per ML-caused false positive (what the model scored the benign text).
 *  Both directions are needed to price a gate change: a lever that recovers an
 *  attack at P(attack) 0.98 is only free if no benign text scores that high. */
const EXPLAIN = argv.includes("--explain");
/** --only v4 measures one backend. The v3-vs-v4 comparison is the point of this
 *  harness, so this is for iterating on one decision layer, not for reporting. */
const ONLY = flag("only");

interface BackendSpec {
  name: string;
  modelPath: string;
  labelsPath: string;
  calibrationPath?: string;
  /** v3 was served at 128 tokens, v4 at 256. Comparing them at one length would
   *  attribute a window difference to the model. */
  maxLength: string;
}

/**
 * Point the PRODUCTION resolver at one artifact. augmentWithMl builds its backend
 * from env and caches it, so switching backends means rewriting env and clearing
 * that cache — the same seam scripts/ml/sliding-window-evidence.ts uses.
 */
function applySpec(spec: BackendSpec): void {
  process.env.SOTERAI_ML_AUGMENT = "enforce";
  process.env.ML_ONNX_MODEL_PATH = spec.modelPath;
  process.env.ML_ONNX_LABELS_PATH = spec.labelsPath;
  process.env.ML_ONNX_MAX_LENGTH = spec.maxLength;
  if (spec.calibrationPath) process.env.ML_ONNX_CALIBRATION_PATH = spec.calibrationPath;
  else delete process.env.ML_ONNX_CALIBRATION_PATH;
  // The sweep has its own evidence harness and its own default (off). Leaving it
  // on here would mix two independent changes into one number.
  process.env.ML_ONNX_SLIDING_WINDOW = "off";
}

interface Judgement {
  /** Did the guard end up taking a protective action? The shipped verdict. */
  flagged: boolean;
  /** Would the deterministic rules alone have flagged it? */
  rulesFlagged: boolean;
  /** Did the model actually run, or did the tier fail open? */
  mlRan: boolean;
  ml?: MlAugmentDetail;
}

type MlModule = typeof import("../../lib/guard/mlAugment");

async function judge(mod: MlModule, text: string): Promise<Judgement> {
  const base = analyzeText(text, "INPUT");
  const rulesFlagged = PROTECTIVE.has(base.action);
  const result = await mod.augmentWithMl(base, text, "INPUT");
  const ml = (result.metadata as { ml?: MlAugmentDetail } | undefined)?.ml;
  return { flagged: PROTECTIVE.has(result.action), rulesFlagged, mlRan: ml?.ran === true, ml };
}

interface BackendResult {
  name: string;
  attacks: { total: number; combined: number; rules: number; mlLift: number; pct: number };
  heldoutBenign: { total: number; fp: number; mlCaused: number; pct: number };
  control: { total: number; fp: number; mlCaused: number; pct: number };
  /** Why each missed attack was not escalated. The diagnosis, not just the score. */
  missedBecause: Record<string, number>;
  /** Labels the model attached to the benign texts it escalated. */
  falsePositiveLabels: Record<string, number>;
  /** Samples where the tier failed open. Non-zero means the recall number is a floor. */
  failedOpen: number;
  msPerSample: number;
}

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

async function evalBackend(spec: BackendSpec, control: string[]): Promise<BackendResult | null> {
  if (!existsSync(spec.modelPath) || !existsSync(spec.labelsPath)) {
    console.log(`\n[${spec.name}] SKIP — artifact missing at ${spec.modelPath}`);
    return null;
  }

  applySpec(spec);
  const mod = await import("../../lib/guard/mlAugment");
  mod.__resetMlBackendForTests();

  // Liveness first. augmentWithMl is fail-open, so an unloadable model returns a
  // clean ALLOW for every sample — scoring the corpora against it would print a
  // 0% ML lift and call it a measurement instead of a broken backend.
  const probe = await judge(mod, "Please summarise the attached quarterly report for me.");
  if (!probe.mlRan) {
    console.log(`\n[${spec.name}] SKIP — the tier never ran: ${probe.ml?.error ?? "unknown reason"}`);
    return null;
  }

  const missedBecause: Record<string, number> = {};
  const missDetail: string[] = [];
  const falsePositiveLabels: Record<string, number> = {};
  const fpDetail: string[] = [];
  let failedOpen = 0;
  let samples = 0;
  const started = Date.now();

  let combined = 0;
  let rulesHit = 0;
  for (const text of HELDOUT_UNTUNED_ATTACKS) {
    const j = await judge(mod, text);
    samples += 1;
    if (!j.mlRan) failedOpen += 1;
    if (j.rulesFlagged) rulesHit += 1;
    if (j.flagged) combined += 1;
    else if (j.mlRan) {
      bump(missedBecause, j.ml?.gatedBy ?? "escalation-suppressed");
      // attackProbability next to the gate name is the diagnosis: a miss with
      // attackProb ~1.0 means the model was certain it was an attack and only
      // uncertain WHICH kind, which is a gate defect, not a detection failure.
      missDetail.push(
        `    ${j.ml?.gatedBy ?? "?"}  label=${j.ml?.predictedLabel ?? "-"} ` +
          `conf=${j.ml?.confidence ?? "-"} attackProb=${j.ml?.attackProbability ?? "-"}\n` +
          `      ${text.slice(0, 110).replace(/\s+/g, " ")}`,
      );
    } else bump(missedBecause, "tier-failed-open");
  }

  const counted = async (corpus: string[], corpusName: string) => {
    let fp = 0;
    let mlCaused = 0;
    for (const text of corpus) {
      const j = await judge(mod, text);
      samples += 1;
      if (!j.mlRan) failedOpen += 1;
      if (!j.flagged) continue;
      fp += 1;
      if (!j.rulesFlagged) {
        mlCaused += 1;
        bump(falsePositiveLabels, j.ml?.predictedLabel ?? "unknown");
        // The mirror image of a miss line. Loosening a gate is only cheap if the
        // benign texts it would then admit score BELOW the attacks it recovers,
        // so the score has to be visible on both sides of the decision.
        fpDetail.push(
          `    ${corpusName}  label=${j.ml?.predictedLabel ?? "-"} ` +
            `conf=${j.ml?.confidence ?? "-"} attackProb=${j.ml?.attackProbability ?? "-"}\n` +
            `      ${text.slice(0, 110).replace(/\s+/g, " ")}`,
        );
      }
    }
    return { fp, mlCaused };
  };

  const benign = await counted(HELDOUT_UNTUNED_BENIGN, "benign");
  const ctrl = await counted(control, "control");
  const elapsed = Date.now() - started;

  const result: BackendResult = {
    name: spec.name,
    attacks: {
      total: HELDOUT_UNTUNED_ATTACKS.length,
      combined,
      rules: rulesHit,
      mlLift: combined - rulesHit,
      pct: Number(((combined / HELDOUT_UNTUNED_ATTACKS.length) * 100).toFixed(1)),
    },
    heldoutBenign: {
      total: HELDOUT_UNTUNED_BENIGN.length,
      fp: benign.fp,
      mlCaused: benign.mlCaused,
      pct: Number(((benign.fp / Math.max(1, HELDOUT_UNTUNED_BENIGN.length)) * 100).toFixed(1)),
    },
    control: {
      total: control.length,
      fp: ctrl.fp,
      mlCaused: ctrl.mlCaused,
      pct: Number(((ctrl.fp / Math.max(1, control.length)) * 100).toFixed(1)),
    },
    missedBecause,
    falsePositiveLabels,
    failedOpen,
    msPerSample: Number((elapsed / Math.max(1, samples)).toFixed(1)),
  };

  const a = result.attacks;
  console.log(`\n[${spec.name}] ${spec.modelPath} @ maxLength=${spec.maxLength}`);
  console.log(
    `  attack recall:       ${a.combined}/${a.total} (${a.pct}%)  ` +
      `= rules ${a.rules} + ML ${a.mlLift >= 0 ? "+" : ""}${a.mlLift}`,
  );
  console.log(
    `  held-out benign FPR: ${result.heldoutBenign.fp}/${result.heldoutBenign.total} ` +
      `(${result.heldoutBenign.pct}%)  ML-caused ${result.heldoutBenign.mlCaused}`,
  );
  console.log(
    `  control FPR:         ${result.control.fp}/${result.control.total} ` +
      `(${result.control.pct}%)  ML-caused ${result.control.mlCaused}`,
  );
  const misses = Object.entries(missedBecause).sort((x, y) => y[1] - x[1]);
  if (misses.length) {
    console.log(`  missed attacks by gate: ${misses.map(([k, v]) => `${k} ${v}`).join(", ")}`);
    if (EXPLAIN) for (const line of missDetail) console.log(line);
  }
  const fpLabels = Object.entries(falsePositiveLabels).sort((x, y) => y[1] - x[1]);
  if (fpLabels.length) {
    console.log(`  ML false-positive labels: ${fpLabels.map(([k, v]) => `${k} ${v}`).join(", ")}`);
    if (EXPLAIN) for (const line of fpDetail) console.log(line);
  }
  console.log(`  ${result.msPerSample}ms/sample`);
  if (failedOpen > 0) {
    // The tier loaded for the probe and then stopped working. Every such sample is
    // an un-scored one, so the recall above is a floor, not a measurement.
    console.log(
      `  WARNING: the tier failed open on ${failedOpen} of ${samples} samples — ` +
        "these numbers are a lower bound. Check `npm run ml:health`.",
    );
  }
  return result;
}

const SPECS: BackendSpec[] = [
  {
    name: "v3",
    modelPath: "models/ml-classifier-v3/model.onnx",
    labelsPath: "models/ml-classifier-v3/labels.json",
    maxLength: "128",
  },
  {
    name: "v4",
    modelPath: "models/ml-classifier-v4/model.onnx",
    labelsPath: "models/ml-classifier-v4/labels.json",
    calibrationPath: "models/ml-classifier-v4/calibration.json",
    maxLength: "256",
  },
];
// models/ml-classifier-v4-smoke is a load-smoke artifact with untrained weights.
// It is not a comparison candidate; running the corpora against it would produce
// numbers that mean nothing but still look like a result.

async function main(): Promise<number> {
  const control = BENIGN_CONTROL_EXPANDED.slice(0, CONTROL_SIZE).map((row) =>
    typeof row === "string" ? row : ((row as { text?: string }).text ?? String(row)),
  );

  console.log(`SoterLLM verify — env ${envFile}`);
  console.log(
    `  floor=${process.env.ML_ONNX_CONFIDENCE_FLOOR ?? "(unset -> 0.9)"} ` +
      `attackProbFloor=${process.env.ML_ONNX_ATTACK_PROB_FLOOR ?? "(unset -> 0.85)"} ` +
      `semanticMargin=${process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "(unset -> 0)"}`,
  );
  console.log(
    `  corpora: ${HELDOUT_UNTUNED_ATTACKS.length} untuned attacks, ` +
      `${HELDOUT_UNTUNED_BENIGN.length} held-out benign, ${control.length} control`,
  );

  // Rules-only baseline. Printed separately because every ML number below is a
  // delta on top of it, and because it is the number that survives if all the
  // model artifacts are unusable.
  let rulesHit = 0;
  for (const text of HELDOUT_UNTUNED_ATTACKS) {
    if (PROTECTIVE.has(analyzeText(text, "INPUT").action)) rulesHit += 1;
  }
  const rulesPct = ((rulesHit / HELDOUT_UNTUNED_ATTACKS.length) * 100).toFixed(1);
  console.log(
    `\n[rules-only] attack recall: ${rulesHit}/${HELDOUT_UNTUNED_ATTACKS.length} (${rulesPct}%)`,
  );

  const results: BackendResult[] = [];
  for (const spec of SPECS) {
    if (ONLY && spec.name !== ONLY) continue;
    try {
      const result = await evalBackend(spec, control);
      if (result) results.push(result);
    } catch (error) {
      // Per-backend isolation. This is the bug that made the harness useless: one
      // artifact the supply-chain gate refuses must not take the comparison with it.
      console.log(`\n[${spec.name}] SKIP — evaluation threw: ${(error as Error).message}`);
    }
  }

  console.log("\n--- summary ---");
  console.log(
    JSON.stringify(
      { env: envFile, rulesOnly: { hits: rulesHit, total: HELDOUT_UNTUNED_ATTACKS.length }, results },
      null,
      2,
    ),
  );

  if (results.length === 0) {
    console.error(
      "\nFAIL: no backend could be measured, so this run contains no ML evidence.\n" +
        "Usually the model is unsigned or the trust store is not configured for this env:\n" +
        "  npm run ml:sign -- --model models/ml-classifier-v4/model.onnx --source local-training\n" +
        "  npm run ml:health   (reports what the tier is actually doing)",
    );
    return 1;
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`ml:verify:v4 could not complete: ${(error as Error).stack ?? error}`);
    process.exit(1);
  });






