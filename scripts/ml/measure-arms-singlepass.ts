/**
 * Measure MANY gate/threshold arms from ONE pass of ONNX inference.
 *
 * WHY THIS EXISTS
 *   `measure-gate-widening.ts` runs a fresh child process per arm. On the 274-row
 *   battery that is fine. On the 6,498-row FP-cost corpus it is 6 arms x 6,498
 *   inferences = 38,988 forward passes, and because it uses spawnSync with the
 *   worker printing a single JSON line at the very END, it emits NOTHING for
 *   ~40 minutes per arm. Two runs were abandoned as "hung" when they were merely
 *   grinding; total runtime would have been ~4 hours.
 *
 *   That work is almost entirely redundant. Read mlAugment.ts: the trusted-label
 *   set enters the decision at exactly ONE point --
 *       passesPrecisionGate(effectiveLabel, direction, text)
 *         -> inputReliableLabels().has(effectiveLabel)
 *   Inference, calibration/abstention, the confidence floor, the attack-probability
 *   floor and the semantic veto are all INDEPENDENT of the label set. Likewise the
 *   abstention-review path is gated only on (abstained, attackProbability,
 *   direction) -- it never consults the label set.
 *
 *   So a single pass that records the per-row FACTS is sufficient to derive every
 *   arm arithmetically. Two routes exist and they are MUTUALLY EXCLUSIVE, which is
 *   what makes the derivation exact rather than approximate:
 *     - abstained === true  => isAttack is false by construction, so the ONLY way
 *       the ML tier can escalate is the abstention-review path (threshold AP).
 *     - abstained === false => the review path cannot fire, so the only route is
 *       label escalation (threshold = trusted-label set).
 *
 * THE DERIVATION
 *   for a row, under gate label-set L and review threshold T:
 *     rulesHit                      -> flagged in EVERY arm
 *     else abstained                -> flagged iff attackProbability >= T
 *     else                          -> flagged iff mlEscalatedPermissive
 *                                              AND L.has(predictedLabel)
 *
 * WHY YOU CAN BELIEVE IT
 *   The derivation is not asserted, it is CHECKED. Run this on
 *   datasets/v15-test-battery.jsonl with --verify-against, pointing at the
 *   artifacts/ml/_ap-sweep-*.json files that were produced by really re-running the
 *   whole production pipeline once per AP value. If the derived miss/FP counts do
 *   not reproduce those measured counts EXACTLY, this script exits non-zero and
 *   emits nothing. Only after that control passes is the derivation applied to the
 *   6,498-row corpus.
 *
 * IT ALSO ANSWERS THE RULES-VS-ML QUESTION
 *   rulesHit is recorded per row alongside `language`, so the per-language
 *   rules-only recall falls out of the same pass. That settles whether a language
 *   scoring 100% is real ML competence or a rules-tier mask -- previously this
 *   needed a separate `--mode shadow` run.
 *
 * USAGE
 *   npx tsx scripts/ml/measure-arms-singlepass.ts \
 *     --file datasets/v15-test-battery.jsonl \
 *     --out artifacts/ml/v15-arms-battery.json \
 *     --verify-against artifacts/ml/_ap-sweep
 *
 *   npx tsx scripts/ml/measure-arms-singlepass.ts \
 *     --file artifacts/ml/_gate-fpcost-corpus.jsonl \
 *     --out artifacts/ml/v15-arms-atscale.json
 */
import * as path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

const file = arg("--file", "datasets/v15-test-battery.jsonl");
const outPath = arg("--out", "artifacts/ml/arms-singlepass.json");
const verifyPrefix = arg("--verify-against", "");
const progressEvery = Number(arg("--progress-every", "200"));

// ── Arm definitions ────────────────────────────────────────────────────────────
// Baseline = DEFAULT_INPUT_RELIABLE_LABELS as shipped (8 of 13 attack labels).
const BASELINE = [
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "PII",
  "SECRET",
  "RAG_POISONING",
  "ENCODING_OBFUSCATION",
  "MODEL_EXTRACTION",
];
const CANDIDATES = [
  "TOOL_CALL_ABUSE",
  "MULTI_TURN_ESCALATION",
  "DATA_EXFILTRATION_ATTEMPT",
  "UNSAFE_OUTPUT",
  "TOXICITY_HARASSMENT",
];
// Production AP is 0.80. Sweep downward; 0.80 must be included so the baseline arm
// reproduces the live configuration exactly.
const AP_ARMS = [0.8, 0.75, 0.7, 0.65, 0.6];
const PROD_AP = 0.8;

type Row = { text: string; label: string; language?: string; category?: string };

/** The per-row facts the derivation needs. Everything here is arm-independent. */
type Fact = {
  i: number;
  label: string;
  language: string;
  category?: string;
  rulesHit: boolean;
  abstained: boolean;
  attackProb: number | null;
  predictedLabel: string | null;
  /** Did the ML tier escalate under a maximally-permissive label set? */
  mlEscalatedPermissive: boolean;
  gatedBy: string | null;
  text: string;
};

const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);

/**
 * Decide whether a row is flagged under gate label-set L and review threshold T.
 * This is the whole derivation, in one place, so it cannot drift between the
 * verification pass and the reported arms.
 */
function flaggedUnder(f: Fact, trusted: Set<string>, reviewAp: number): boolean {
  if (f.rulesHit) return true;
  if (f.abstained) return f.attackProb !== null && f.attackProb >= reviewAp;
  return f.mlEscalatedPermissive && f.predictedLabel !== null && trusted.has(f.predictedLabel);
}

type Tally = { attacks: number; caught: number; benign: number; fp: number };
const blank = (): Tally => ({ attacks: 0, caught: 0, benign: 0, fp: 0 });

function scoreArm(facts: Fact[], trusted: Set<string>, reviewAp: number) {
  const all = blank();
  const byLabel = new Map<string, Tally>();
  const missIdx: number[] = [];
  const fpIdx: number[] = [];
  for (const f of facts) {
    const t = byLabel.get(f.label) ?? blank();
    byLabel.set(f.label, t);
    const hit = flaggedUnder(f, trusted, reviewAp);
    if (f.label !== "SAFE") {
      all.attacks++; t.attacks++;
      if (hit) { all.caught++; t.caught++; } else missIdx.push(f.i);
    } else {
      all.benign++; t.benign++;
      if (hit) { all.fp++; t.fp++; fpIdx.push(f.i); }
    }
  }
  return {
    recall: pct(all.caught, all.attacks),
    fpr: pct(all.fp, all.benign),
    ...all,
    misses: missIdx.length,
    fps: fpIdx.length,
    missIdx,
    fpIdx,
    byLabel: Object.fromEntries(
      [...byLabel].map(([k, v]) => [k, { ...v, recall: pct(v.caught, v.attacks), fpr: pct(v.fp, v.benign) }]),
    ),
  };
}

async function main(): Promise<void> {
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl, resolveMlAugmentMode } = await import("../../lib/guard/mlAugment");

  // Force the tier on and make the pass MAXIMALLY PERMISSIVE so nothing is hidden:
  // every attack label trusted, and AP=0 so every abstained row is observable.
  // The recorded facts are arm-independent; permissiveness only ensures we can SEE
  // each row's route rather than having it suppressed before we record it.
  process.env.SOTERAI_ML_AUGMENT = "enforce";
  process.env.SOTERAI_ML_INPUT_TRUSTED_LABELS = [...BASELINE, ...CANDIDATES].join(",");
  process.env.SOTERAI_ML_ABSTAIN_REVIEW = "on";
  process.env.SOTERAI_ML_ABSTAIN_REVIEW_AP = "0";

  if (resolveMlAugmentMode() === "off") {
    console.error("[FATAL] ML tier resolved to 'off'. Refusing to emit a rules-only number");
    console.error("        dressed up as an ML measurement.");
    process.exit(2);
  }

  const rows: Row[] = readFileSync(path.resolve(process.cwd(), file), "utf8")
    .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);

  const flagged = (v: { allowed?: boolean; action?: string }) =>
    v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

  console.log(`Single-pass arm measurement: ${file} (${rows.length} rows)`);
  console.log(`  permissive labels = all ${BASELINE.length + CANDIDATES.length}, review AP = 0`);
  console.log(`  deriving ${1 + CANDIDATES.length + 1} gate arms x ${AP_ARMS.length} AP arms from ONE pass\n`);

  const facts: Fact[] = [];
  const started = Date.now();
  let mlRan = 0;
  let mlErrors = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    const ml = (after.metadata as { ml?: Record<string, unknown> } | undefined)?.ml;
    if (ml?.ran === true) mlRan++;
    if (typeof ml?.error === "string") mlErrors++;

    const rulesHit = flagged(before);
    const e2eHit = flagged(after);
    const abstained = ml?.abstained === true;

    facts.push({
      i,
      label: r.label,
      language: (r.language ?? "en").toLowerCase(),
      category: r.category,
      rulesHit,
      abstained,
      attackProb: typeof ml?.attackProbability === "number" ? (ml.attackProbability as number) : null,
      predictedLabel: typeof ml?.predictedLabel === "string" ? (ml.predictedLabel as string) : null,
      // With a permissive label set and AP=0, an escalation that did NOT happen was
      // refused by an arm-independent gate (confidence floor / semantic veto), so
      // recording the permissive outcome is sufficient for every narrower arm.
      mlEscalatedPermissive: e2eHit && !rulesHit && !abstained,
      gatedBy: typeof ml?.gatedBy === "string" ? (ml.gatedBy as string) : null,
      text: r.text,
    });

    // Progress. The absence of this is precisely why two earlier runs were mistaken
    // for hangs and killed. Never let a long measurement look dead.
    if ((i + 1) % progressEvery === 0 || i + 1 === rows.length) {
      const el = (Date.now() - started) / 1000;
      const rate = (i + 1) / el;
      const eta = (rows.length - i - 1) / rate;
      console.log(
        `  [${String(i + 1).padStart(5)}/${rows.length}] ${el.toFixed(0)}s elapsed, ` +
          `${rate.toFixed(1)} rows/s, ETA ${eta.toFixed(0)}s`,
      );
    }
  }

  if (mlRan === 0) {
    console.error("[FATAL] the ML tier ran on 0 rows — harness failure, not a result.");
    process.exit(1);
  }

  // ── Arms ─────────────────────────────────────────────────────────────────────
  const baseSet = new Set(BASELINE);
  const gateArms: Record<string, ReturnType<typeof scoreArm>> = {};
  gateArms.baseline = scoreArm(facts, baseSet, PROD_AP);
  for (const c of CANDIDATES) {
    gateArms[c] = scoreArm(facts, new Set([...BASELINE, c]), PROD_AP);
  }
  gateArms.all = scoreArm(facts, new Set([...BASELINE, ...CANDIDATES]), PROD_AP);

  const apArms: Record<string, ReturnType<typeof scoreArm>> = {};
  for (const ap of AP_ARMS) apArms[ap.toFixed(2)] = scoreArm(facts, baseSet, ap);

  // ── Control: reproduce the really-measured AP sweep, or refuse to report ─────
  let verification: unknown = null;
  if (verifyPrefix) {
    const checks: Array<{ ap: string; expected: { misses: number; fps: number }; derived: { misses: number; fps: number }; ok: boolean }> = [];
    for (const ap of AP_ARMS) {
      const p = path.resolve(process.cwd(), `${verifyPrefix}-${ap.toFixed(2)}.json`);
      if (!existsSync(p)) { console.log(`  [verify] no measured file for AP ${ap} — skipped`); continue; }
      const m = JSON.parse(readFileSync(p, "utf8")) as { overall: { attacks: number; caught: number; fp: number } };
      const expected = { misses: m.overall.attacks - m.overall.caught, fps: m.overall.fp };
      const d = apArms[ap.toFixed(2)];
      const derived = { misses: d.misses, fps: d.fps };
      checks.push({ ap: ap.toFixed(2), expected, derived, ok: expected.misses === derived.misses && expected.fps === derived.fps });
    }
    console.log("\n" + "=".repeat(78));
    console.log("DERIVATION CONTROL — derived arms vs really-re-run pipeline arms");
    console.log("=".repeat(78));
    for (const c of checks) {
      console.log(
        `  AP ${c.ap}  measured ${c.expected.misses} misses / ${c.expected.fps} FPs   ` +
          `derived ${c.derived.misses} / ${c.derived.fps}   ${c.ok ? "MATCH" : "*** MISMATCH ***"}`,
      );
    }
    const bad = checks.filter((c) => !c.ok);
    if (!checks.length) {
      console.error("\n[FATAL] --verify-against matched no files; the control did not run.");
      process.exit(1);
    }
    if (bad.length) {
      console.error(
        `\n[FATAL] ${bad.length}/${checks.length} arms do not reproduce the measured counts.\n` +
          "        The single-pass derivation is therefore WRONG and its at-scale numbers\n" +
          "        must not be believed. Emitting nothing.",
      );
      process.exit(1);
    }
    console.log(`\n  ${checks.length}/${checks.length} arms reproduced exactly — derivation validated.`);
    verification = checks;
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  const base = gateArms.baseline;
  console.log("\n" + "=".repeat(78));
  console.log(`GATE ARMS (review AP held at production ${PROD_AP})`);
  console.log("=".repeat(78));
  console.log(`  baseline (8 labels)          recall ${String(base.recall).padStart(6)}%  FPR ${String(base.fpr).padStart(6)}%   ${base.caught}/${base.attacks}, ${base.fp}/${base.benign} FP`);
  const gateVerdicts = CANDIDATES.map((c) => {
    const a = gateArms[c];
    const gained = a.caught - base.caught;
    const added = a.fp - base.fp;
    const own = a.byLabel[c];
    const measurable = (own?.attacks ?? 0) > 0;
    console.log(
      `  +${c.padEnd(27)} recall ${String(a.recall).padStart(6)}%  FPR ${String(a.fpr).padStart(6)}%   ` +
        `+${gained} attacks / +${added} FPs` + (measurable ? "" : "   (no gold rows here)"),
    );
    return {
      label: c,
      measurable,
      ownLabelAttacks: own?.attacks ?? 0,
      attacksGained: gained,
      falsePositivesAdded: added,
      benignDenominator: a.benign,
      verdict: !measurable
        ? "NOT MEASURABLE on this corpus (no gold rows)"
        : gained > 0 && added === 0
          ? "ADMIT (free recall on this corpus)"
          : gained > 0 && gained >= added * 5
            ? "ADMIT (favourable trade)"
            : gained === 0 && added === 0
              ? "NO-OP on these rows"
              : "HOLD OUT (cost exceeds gain)",
    };
  });

  console.log("\n" + "=".repeat(78));
  console.log("ABSTENTION-REVIEW AP ARMS (gate held at the shipped 8 labels)");
  console.log("=".repeat(78));
  const apBase = apArms[PROD_AP.toFixed(2)];
  for (const ap of AP_ARMS) {
    const a = apArms[ap.toFixed(2)];
    const dR = Number((a.recall - apBase.recall).toFixed(2));
    const dF = Number((a.fpr - apBase.fpr).toFixed(2));
    const tag = ap === PROD_AP ? "  <- live" : `  d recall ${dR >= 0 ? "+" : ""}${dR}, d FPR ${dF >= 0 ? "+" : ""}${dF}`;
    console.log(
      `  AP ${ap.toFixed(2)}  recall ${String(a.recall).padStart(6)}%  FPR ${String(a.fpr).padStart(6)}%   ` +
        `${a.misses} misses / ${a.fps} FPs${tag}`,
    );
  }

  // Per-language rules vs end-to-end. This is the rules-only/ML split that
  // previously required a separate shadow-mode run.
  const langs = new Map<string, { attacks: number; rulesCaught: number; e2eCaught: number; benign: number; fp: number }>();
  for (const f of facts) {
    const t = langs.get(f.language) ?? { attacks: 0, rulesCaught: 0, e2eCaught: 0, benign: 0, fp: 0 };
    langs.set(f.language, t);
    const hit = flaggedUnder(f, baseSet, PROD_AP);
    if (f.label !== "SAFE") {
      t.attacks++;
      if (f.rulesHit) t.rulesCaught++;
      if (hit) t.e2eCaught++;
    } else {
      t.benign++;
      if (hit) t.fp++;
    }
  }
  const perLanguage = [...langs.entries()]
    .map(([lang, t]) => ({
      lang,
      attacks: t.attacks,
      rulesOnlyRecall: pct(t.rulesCaught, t.attacks),
      rulesPlusMlRecall: pct(t.e2eCaught, t.attacks),
      mlContribution: Number((pct(t.e2eCaught, t.attacks) - pct(t.rulesCaught, t.attacks)).toFixed(2)),
      benign: t.benign,
      fpr: pct(t.fp, t.benign),
    }))
    .sort((a, b) => b.attacks - a.attacks);

  console.log("\n" + "=".repeat(78));
  console.log("PER-LANGUAGE: rules-only vs rules+ML (settles 'is that 100% just the rules tier?')");
  console.log("=".repeat(78));
  console.log("  lang      atk   rules%   +ML%   ML delta   benign   FPR%");
  for (const l of perLanguage) {
    console.log(
      `  ${l.lang.padEnd(9)} ${String(l.attacks).padStart(3)}  ${String(l.rulesOnlyRecall).padStart(6)}  ${String(
        l.rulesPlusMlRecall,
      ).padStart(6)}  ${String(l.mlContribution).padStart(8)}   ${String(l.benign).padStart(6)}  ${String(l.fpr).padStart(6)}`,
    );
  }

  const strip = (a: ReturnType<typeof scoreArm>) => {
    const { missIdx, fpIdx, ...rest } = a;
    return rest;
  };
  const report = {
    file,
    rows: rows.length,
    mlRan,
    mlErrors,
    prodAp: PROD_AP,
    baselineLabels: BASELINE,
    candidates: CANDIDATES,
    derivation:
      "flagged(L,T) = rulesHit || (abstained ? attackProb >= T : mlEscalatedPermissive && L.has(predictedLabel))",
    verification,
    gateArms: Object.fromEntries(Object.entries(gateArms).map(([k, v]) => [k, strip(v)])),
    gateVerdicts,
    apArms: Object.fromEntries(Object.entries(apArms).map(([k, v]) => [k, strip(v)])),
    perLanguage,
  };
  mkdirSync(path.dirname(path.resolve(process.cwd(), outPath)), { recursive: true });
  writeFileSync(path.resolve(process.cwd(), outPath), JSON.stringify(report, null, 2), "utf8");

  // Per-row facts, so any FUTURE arm can be derived with zero further inference.
  const factsPath = outPath.replace(/\.json$/, "-facts.jsonl");
  writeFileSync(
    path.resolve(process.cwd(), factsPath),
    facts.map((f) => JSON.stringify({ ...f, text: f.text.slice(0, 300) })).join("\n") + "\n",
    "utf8",
  );
  console.log(`\n[write] ${outPath}`);
  console.log(`[write] ${factsPath}  (per-row facts — re-derive any arm without re-inference)`);
}

main()
  .then(() => {
    // MEASURED LEAK (2026-09-07): without this, the process prints everything,
    // resolves main(), and then NEVER EXITS — the ONNX Runtime thread pool keeps
    // libuv's event loop alive. The battery run of this very script sat spinning
    // for 23 minutes after it had finished, burning 4,145 CPU-seconds and stealing
    // ~3 of 8 cores from the at-scale run launched behind it (whose throughput
    // jumped 2.2 -> 2.8 rows/s the moment it died). Every output is already
    // flushed by the writeFileSync/console.log above, so exiting here truncates
    // nothing.
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
