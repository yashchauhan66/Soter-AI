/**
 * Measure, per candidate label, what ADMITTING it to the INPUT gate would buy and
 * what it would cost — on a battery whose gold labels cover the blocked classes.
 *
 * WHY THIS EXISTS
 *   `DEFAULT_INPUT_RELIABLE_LABELS` (lib/guard/mlAugment.ts) admits 8 of 13 attack
 *   labels on INPUT. TOOL_CALL_ABUSE, MULTI_TURN_ESCALATION,
 *   DATA_EXFILTRATION_ATTEMPT, UNSAFE_OUTPUT and TOXICITY_HARASSMENT are BLOCKED:
 *   a correct model prediction for them is discarded with gatedBy="label-family".
 *   No amount of retraining moves INPUT recall for those classes while the gate
 *   holds them out.
 *
 *   That gate was set from ONE corpus (artifacts/ml/v12-deploy-blockers.json), which
 *   had zero gold rows for these classes — so it measured the FP half only, and the
 *   code says so: "a trade needs more than one corpus". This harness is that second
 *   corpus. It reports, for each candidate label, the attacks recovered and the
 *   benign false positives incurred, so the widening decision is measured.
 *
 * HOW
 *   The gate reads SOTERAI_ML_INPUT_TRUSTED_LABELS, and the resolved set is memoized
 *   behind __resetMlBackendForTests. Rather than fight that cache per-arm, this runs
 *   each arm in a FRESH CHILD PROCESS with the env var set, so every arm is a clean
 *   resolution. Arms: baseline (default 8 labels), then baseline + each candidate,
 *   then baseline + all candidates.
 *
 * USAGE
 *   npx tsx scripts/ml/measure-gate-widening.ts \
 *     --file datasets/v15-test-battery.jsonl \
 *     --out artifacts/ml/gate-widening.json
 */
import * as path from "node:path";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Resolve tsx's own JS entrypoint and run it with process.execPath. Spawning the
// `npx.cmd` shim instead fails with EINVAL on Node >=20 (Windows refuses to
// spawnSync a .cmd without a shell) and — because spawnSync reports that via
// res.error rather than a non-zero exit — yields EMPTY stdout that parses as an
// empty result. That is how the first run of this script reported "recall 0%" for
// every arm. Going through node directly removes the shim from the path entirely.
// `tsx/dist/cli.mjs` is not in tsx's exports map, so resolve the package.json
// (which IS exported) and join the bin path from its own manifest.
const TSX_CLI = (() => {
  const req = createRequire(import.meta.url);
  const pkgPath = req.resolve("tsx/package.json");
  const bin = (req(pkgPath) as { bin?: string | Record<string, string> }).bin;
  const rel = typeof bin === "string" ? bin : (bin?.tsx ?? "./dist/cli.mjs");
  return path.resolve(path.dirname(pkgPath), rel);
})();

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

const file = arg("--file", "datasets/v15-test-battery.jsonl");
const outPath = arg("--out", "artifacts/ml/gate-widening.json");

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

// The worker is inlined rather than kept as a second file: it must stay in lockstep
// with the arm definition above, and a drifted copy would silently measure a
// different gate than the one being reported.
// NOTE the imports are resolved against the PROJECT ROOT via pathToFileURL, not
// relative to this worker file. The worker is written under artifacts/, so a
// relative "./lib/guard/analyze" would resolve to artifacts/lib/... and throw —
// which surfaced as every arm reporting 0% recall (an empty result parsed as a
// successful measurement). Absolute file URLs make that failure impossible.
const WORKER = `
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";
loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.SOTERAI_ML_AUGMENT = "enforce";
const file = process.argv[2];
const mod = (rel) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
(async () => {
  const { analyzeText } = await import(mod("lib/guard/analyze.ts"));
  const { augmentWithMl, resolveMlAugmentMode } = await import(mod("lib/guard/mlAugment.ts"));
  if (resolveMlAugmentMode() === "off") { console.log(JSON.stringify({fatal:"ml off"})); return; }
  const rows = readFileSync(file, "utf8").split(/\\r?\\n/).filter(Boolean).map((l) => JSON.parse(l));
  const flagged = (v) => v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");
  const byLabel = {};
  let attacks = 0, caught = 0, benign = 0, fp = 0;
  for (const r of rows) {
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    const hit = flagged(after);
    const rulesHit = flagged(before);
    byLabel[r.label] ??= { attacks: 0, caught: 0, benign: 0, fp: 0, rulesCaught: 0 };
    const t = byLabel[r.label];
    if (r.label !== "SAFE") {
      attacks++; t.attacks++;
      if (hit) { caught++; t.caught++; }
      if (rulesHit) t.rulesCaught++;
    } else {
      benign++; t.benign++;
      if (hit) { fp++; t.fp++; }
    }
  }
  console.log(JSON.stringify({ attacks, caught, benign, fp, byLabel }));
})().catch((e) => { console.log(JSON.stringify({ fatal: String(e && e.message || e) })); });
`;

const workerPath = path.resolve(process.cwd(), "artifacts/ml/_gate-arm-worker.mts");

type ArmResult = {
  attacks: number; caught: number; benign: number; fp: number;
  byLabel: Record<string, { attacks: number; caught: number; benign: number; fp: number; rulesCaught: number }>;
  fatal?: string;
};

function runArm(name: string, labels: string[]): ArmResult {
  const res = spawnSync(process.execPath, [TSX_CLI, workerPath, file], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, SOTERAI_ML_INPUT_TRUSTED_LABELS: labels.join(",") },
  });
  if (res.error) {
    console.error(`[arm ${name}] spawn failed: ${res.error.message}`);
    process.exit(1);
  }
  const line = (res.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() ?? "{}";
  let parsed: ArmResult;
  try {
    parsed = JSON.parse(line) as ArmResult;
  } catch {
    console.error(`[arm ${name}] unparseable output:\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
  if (parsed.fatal) {
    console.error(`[arm ${name}] FATAL: ${parsed.fatal}`);
    process.exit(1);
  }
  // An arm that scored nothing is a BROKEN HARNESS, not a measurement of "no
  // recall". This assertion exists because the first version of this script wrote
  // the worker to a nested dir, its relative imports threw, and every arm printed
  // "recall 0% FPR 0%" — which reads as a real result. Refuse to continue instead.
  if (!parsed.byLabel || typeof parsed.attacks !== "number" || parsed.attacks === 0) {
    console.error(
      `[arm ${name}] scored 0 attack rows — the worker did not measure. This is a harness\n` +
        `            failure, not a result. Refusing to emit zeros as a finding.\n` +
        `  stdout: ${(res.stdout || "").slice(0, 500)}\n  stderr: ${(res.stderr || "").slice(0, 1500)}`,
    );
    process.exit(1);
  }
  return parsed;
}

const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);

function main(): void {
  mkdirSync(path.dirname(workerPath), { recursive: true });
  writeFileSync(workerPath, WORKER);
  // Sanity: the battery must actually contain gold rows for the candidates, else the
  // arms would all be identical and the report would read as "widening buys nothing".
  const rows = readFileSync(path.resolve(process.cwd(), file), "utf8")
    .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as { label: string });
  const present = new Set(rows.map((r) => r.label));
  const testable = CANDIDATES.filter((c) => present.has(c));
  const absent = CANDIDATES.filter((c) => !present.has(c));
  if (absent.length) {
    console.log(`[note] no gold rows in the battery for: ${absent.join(", ")} — not measurable here.`);
  }
  if (!testable.length) {
    console.error("[FATAL] battery has no gold rows for any blocked candidate label.");
    process.exit(2);
  }

  console.log(`Measuring gate widening on ${file} (${rows.length} rows)\n`);
  const arms: Record<string, ArmResult> = {};
  arms.baseline = runArm("baseline", BASELINE);
  console.log(`  baseline           recall ${pct(arms.baseline.caught, arms.baseline.attacks)}%  FPR ${pct(arms.baseline.fp, arms.baseline.benign)}%`);
  for (const c of testable) {
    arms[c] = runArm(c, [...BASELINE, c]);
    console.log(`  +${c.padEnd(28)} recall ${pct(arms[c].caught, arms[c].attacks)}%  FPR ${pct(arms[c].fp, arms[c].benign)}%`);
  }
  arms.all = runArm("all", [...BASELINE, ...testable]);
  console.log(`  +ALL candidates    recall ${pct(arms.all.caught, arms.all.attacks)}%  FPR ${pct(arms.all.fp, arms.all.benign)}%`);

  const base = arms.baseline;
  const verdicts = testable.map((c) => {
    const a = arms[c];
    const attacksGained = a.caught - base.caught;
    const fpsAdded = a.fp - base.fp;
    const empty = { attacks: 0, caught: 0, rulesCaught: 0, benign: 0, fp: 0 };
    const own = (a.byLabel ?? {})[c] ?? empty;
    const baseOwn = (base.byLabel ?? {})[c] ?? empty;
    return {
      label: c,
      ownLabelRecallBefore: pct(baseOwn.caught, baseOwn.attacks),
      ownLabelRecallAfter: pct(own.caught, own.attacks),
      ownLabelRulesOnlyRecall: pct(own.rulesCaught, own.attacks),
      attacksGained,
      falsePositivesAdded: fpsAdded,
      // A widening is worth it when it recovers real attacks at zero or near-zero
      // benign cost — the same standard that admitted PII/SECRET/RAG_POISONING.
      verdict:
        attacksGained > 0 && fpsAdded === 0
          ? "ADMIT (free recall)"
          : attacksGained > 0 && attacksGained >= fpsAdded * 5
            ? "ADMIT (favourable trade)"
            : attacksGained === 0 && fpsAdded === 0
              ? "NO-OP on these rows"
              : "HOLD OUT (cost exceeds gain)",
    };
  });

  const report = {
    file,
    rows: rows.length,
    baselineLabels: BASELINE,
    candidatesTested: testable,
    candidatesNotInBattery: absent,
    arms: Object.fromEntries(
      Object.entries(arms).map(([k, v]) => [
        k,
        { recall: pct(v.caught, v.attacks), fpr: pct(v.fp, v.benign), caught: v.caught, attacks: v.attacks, fp: v.fp, benign: v.benign },
      ]),
    ),
    perCandidate: verdicts,
    perLabelDetail: arms.all.byLabel ?? {},
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n" + "=".repeat(78));
  console.log("PER-CANDIDATE VERDICT");
  console.log("=".repeat(78));
  for (const v of verdicts) {
    console.log(
      `  ${v.label.padEnd(28)} own-label recall ${String(v.ownLabelRecallBefore).padStart(6)}% -> ${String(v.ownLabelRecallAfter).padStart(6)}%  ` +
        `(rules-only ${v.ownLabelRulesOnlyRecall}%)\n` +
        `      +${v.attacksGained} attacks / +${v.falsePositivesAdded} FPs   ${v.verdict}`,
    );
  }
  console.log(`\n[write] ${outPath}`);
}

main();
