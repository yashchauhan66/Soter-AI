/**
 * Split the REAL-PATH false positives into the tier that caused them: rules or ML.
 *
 * WHY THIS EXISTS (and why diagnose-fpr.ts does not answer it)
 *   The acceptance gate's hardest fail is AC6: FPR must be <0.01 and the real
 *   product path measures 0.23. Whether that is fixable by retraining depends
 *   entirely on which tier emits those false positives — and nothing measured it.
 *
 *   `scripts/ml/diagnose-fpr.ts` prints an "ML tier caused / rules caused" split,
 *   but it only calls `analyzeText`, which is SYNC (lib/guard/analyze.ts:153) and
 *   never imports `augmentWithMl`. The "ML anomaly (...)" marker it greps for is
 *   stamped only inside mlAugment (lib/guard/mlAugment.ts:539). Its `mlCaused`
 *   list is therefore structurally always empty: it reports "ML caused 0 (0%),
 *   rules caused 100%" no matter what the model does. That is a metric that
 *   cannot fail, which is the same trap as 2026-08-08 ("every crossdist number
 *   was rules-only"), and it is why this script runs the real two-tier path.
 *
 * WHAT MAKES THE SPLIT EXACT
 *   mlAugment escalates only when the base action is NOT already protective
 *   (lib/guard/mlAugment.ts:529). It never downgrades a rules decision. So
 *   rulesFP is a strict subset of realFP and the difference is exactly the ML
 *   tier's added cost. The subset property is asserted per row, not assumed — a
 *   violation would mean the invariant this decomposition rests on is false, so
 *   it is counted and reported rather than swallowed.
 *
 *   npx tsx scripts/ml/decompose-fpr.ts \
 *     --file artifacts/ml/v18-balanced-comparison-rows.jsonl \
 *     --out  artifacts/ml/fpr-decomposition-2026-09-25.json
 */
import * as path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

// Must be set before mlAugment is imported so the tier is live. Without this the
// script would faithfully measure "ML adds nothing" because ML never ran.
process.env.SOTERAI_ML_AUGMENT = "enforce";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
};

const file = arg("--file", "artifacts/ml/v18-balanced-comparison-rows.jsonl");
const out = arg("--out", "artifacts/ml/fpr-decomposition.json");
const limit = Number(arg("--limit", "0")) || 0;
const topN = Number(arg("--top", "15"));

type Row = { text: string; label: string; language?: string; category?: string; source?: string };
type Finding = { label?: string; type?: string };
type Verdict = { allowed?: boolean; action?: string; riskTypes?: string[]; findings?: Finding[] };

const mod = (rel: string) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
const flagged = (v: Verdict): boolean =>
  v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const top = (m: Map<string, number>, n: number) =>
  [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));

async function main(): Promise<void> {
  const { analyzeText } = (await import(mod("lib/guard/analyze.ts"))) as {
    analyzeText: (t: string, dir: string) => Verdict;
  };
  const { augmentWithMl, resolveMlAugmentMode } = (await import(mod("lib/guard/mlAugment.ts"))) as {
    augmentWithMl: (v: Verdict, t: string, dir: string) => Promise<Verdict>;
    resolveMlAugmentMode: () => string;
  };

  // A decomposition run with the ML tier off would report "ML added 0 FPs" and be
  // read as "the model is not the problem". Refuse instead of producing that.
  const mode = resolveMlAugmentMode();
  if (mode === "off") {
    console.error("[FATAL] ML augment resolved to 'off' — this run could only ever attribute");
    console.error("        100% of FPs to rules, which is the exact defect this script replaces.");
    process.exit(2);
  }

  const all: Row[] = readFileSync(path.resolve(process.cwd(), file), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);
  const rows = limit ? all.slice(0, limit) : all;

  const benignRows = rows.filter((r) => r.label === "SAFE");
  if (!benignRows.length) {
    console.error(`[FATAL] ${file} has no SAFE rows — there is no false-positive rate to decompose.`);
    process.exit(2);
  }

  // Attribution buckets. Rules and ML are kept apart end to end; merging them is
  // what made the previous instrument unable to distinguish the two.
  const rulesFinding = new Map<string, number>();
  const rulesRiskType = new Map<string, number>();
  const rulesAction = new Map<string, number>();
  const mlLabel = new Map<string, number>();
  const rulesExamples = new Map<string, string[]>();
  const mlExamples = new Map<string, string[]>();
  const byLangRules = new Map<string, number>();
  const byLangMl = new Map<string, number>();
  const byLangBenign = new Map<string, number>();
  const byCategoryRules = new Map<string, number>();

  let benign = 0, rulesFp = 0, realFp = 0, mlAddedFp = 0, monotonicityViolations = 0;
  let attacks = 0, rulesCaught = 0, realCaught = 0, mlAddedCatch = 0;
  let mlEscalationsAnywhere = 0;

  // TWO DEFINITIONS OF "FALSE POSITIVE", because they do not measure the same thing.
  //
  //   loose  = any action other than ALLOW. This is what every FPR number in this
  //            repo has used, and it counts benign text carrying an email address
  //            as a false positive because PII triggers ALLOW_WITH_REDACTION.
  //   strict = the guard treated the text as an ATTACK (BLOCK / HUMAN_REVIEW /
  //            REWRITE). Redacting PII out of genuinely benign text is the product
  //            working as designed, not a misclassification of intent.
  //
  // AC6 asks for benign traffic not to be flagged as attacks, so the strict number
  // is the one that criterion is about. Both are reported: replacing the historical
  // definition silently would make this run incomparable to every prior measurement.
  const REDACTION_ONLY = "ALLOW_WITH_REDACTION";
  const realFpAction = new Map<string, number>();
  let strictFp = 0, strictRulesFp = 0, strictMlFp = 0;

  for (const r of rows) {
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    const rulesHit = flagged(before);
    const realHit = flagged(after);
    const mlEscalated = !rulesHit && realHit;
    if (mlEscalated) mlEscalationsAnywhere++;

    if (r.label !== "SAFE") {
      attacks++;
      if (rulesHit) rulesCaught++;
      if (realHit) realCaught++;
      if (mlEscalated) mlAddedCatch++;
      continue;
    }

    benign++;
    const lang = r.language ?? "?";
    bump(byLangBenign, lang);

    // The invariant the whole decomposition rests on: ML never clears a rules block.
    if (rulesHit && !realHit) monotonicityViolations++;

    if (realHit) realFp++;
    if (realHit) {
      const act = after.action ?? "?";
      bump(realFpAction, act);
      if (act !== REDACTION_ONLY) {
        strictFp++;
        if (rulesHit) strictRulesFp++;
        else strictMlFp++;
      }
    }
    if (rulesHit) {
      rulesFp++;
      bump(byLangRules, lang);
      bump(byCategoryRules, r.category ?? "?");
      bump(rulesAction, before.action ?? "?");
      for (const t of before.riskTypes ?? []) bump(rulesRiskType, t);
      for (const f of before.findings ?? []) {
        const key = f.label ?? f.type ?? "?";
        bump(rulesFinding, key);
        const ex = rulesExamples.get(key) ?? [];
        if (ex.length < 3) {
          ex.push(`[${lang}] ${r.text.slice(0, 100).replace(/\s+/g, " ")}`);
          rulesExamples.set(key, ex);
        }
      }
    } else if (realHit) {
      mlAddedFp++;
      bump(byLangMl, lang);
      // On an ML-caused escalation the "ML anomaly (X)" finding names the label the
      // model predicted, which is the actionable part: it says which class to fix.
      const marks = (after.findings ?? [])
        .map((f) => f.label ?? f.type ?? "?")
        .filter((k) => /^ML anomaly/.test(k));
      const keys = marks.length ? marks : ["(escalated, no ML anomaly finding)"];
      for (const key of keys) {
        bump(mlLabel, key);
        const ex = mlExamples.get(key) ?? [];
        if (ex.length < 3) {
          ex.push(`[${lang}] ${r.text.slice(0, 100).replace(/\s+/g, " ")}`);
          mlExamples.set(key, ex);
        }
      }
    }
  }

  // The guard that diagnose-fpr.ts lacked. "ML added 0 false positives" is only a
  // finding if this instrument was capable of observing an ML escalation at all.
  // If ML never escalated ANY row in the battery, attacks included, the tier is
  // dark and every attribution here is rules-by-construction.
  if (mlEscalationsAnywhere === 0) {
    console.error("[FATAL] the ML tier escalated 0 of " + rows.length + " rows (attacks included).");
    console.error("        Its contribution is therefore unobservable, not zero. Refusing to");
    console.error("        emit a decomposition that could only ever blame rules.");
    process.exit(2);
  }

  const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);
  const shareOfFp = (n: number) => (realFp ? Number(((n / realFp) * 100).toFixed(1)) : 0);

  const report = {
    generatedAt: new Date().toISOString(),
    file,
    mlAugmentMode: mode,
    mlTrustedLabels: process.env.SOTERAI_ML_INPUT_TRUSTED_LABELS ?? "(production default)",
    scored: { rows: rows.length, benign, attacks },
    falsePositives: {
      definition: "loose: any action other than ALLOW (the historical repo definition)",
      realPath: realFp,
      realPathRate: pct(realFp, benign),
      causedByRules: rulesFp,
      causedByRulesShare: shareOfFp(rulesFp),
      causedByMl: mlAddedFp,
      causedByMlShare: shareOfFp(mlAddedFp),
      rulesOnlyRate: pct(rulesFp, benign),
      mlAddedRate: pct(mlAddedFp, benign),
      byFinalAction: top(realFpAction, topN),
    },
    falsePositivesStrict: {
      definition:
        "strict: benign text treated as an ATTACK (BLOCK/HUMAN_REVIEW/REWRITE). " +
        "Excludes ALLOW_WITH_REDACTION, which is PII redaction working as designed.",
      realPath: strictFp,
      realPathRate: pct(strictFp, benign),
      causedByRules: strictRulesFp,
      causedByMl: strictMlFp,
      redactionOnlyExcluded: realFp - strictFp,
      meetsAc6Target: pct(strictFp, benign) < 1.0,
    },
    recall: {
      realPath: pct(realCaught, attacks),
      rulesOnly: pct(rulesCaught, attacks),
      mlAddedCatches: mlAddedCatch,
    },
    integrity: {
      monotonicityViolations,
      mlEscalationsAnywhere,
      note:
        monotonicityViolations === 0
          ? "ML never cleared a rules block; rules FPs are a strict subset of real-path FPs."
          : "INVARIANT BROKEN: ML cleared a rules block. The subset decomposition is not valid.",
    },
    // What it would take to reach AC6 (<1% FPR) if one tier were made perfect.
    ceilings: {
      fprIfMlNeverFiredFp: pct(rulesFp, benign),
      fprIfRulesNeverFiredFp: pct(mlAddedFp, benign),
      targetFpr: 1.0,
      rulesAloneExceedsTarget: pct(rulesFp, benign) > 1.0,
      mlAloneExceedsTarget: pct(mlAddedFp, benign) > 1.0,
    },
    rulesAttribution: {
      byFinding: top(rulesFinding, topN),
      byRiskType: top(rulesRiskType, topN),
      byAction: top(rulesAction, topN),
      byCategory: top(byCategoryRules, topN),
      examples: Object.fromEntries([...rulesExamples].slice(0, topN)),
    },
    mlAttribution: {
      byLabel: top(mlLabel, topN),
      examples: Object.fromEntries([...mlExamples].slice(0, topN)),
    },
    byLanguage: [...byLangBenign]
      .map(([lang, n]) => ({
        language: lang,
        benign: n,
        rulesFp: byLangRules.get(lang) ?? 0,
        mlFp: byLangMl.get(lang) ?? 0,
        fpr: pct((byLangRules.get(lang) ?? 0) + (byLangMl.get(lang) ?? 0), n),
      }))
      .sort((a, b) => b.fpr - a.fpr),
  };

  mkdirSync(path.dirname(path.resolve(process.cwd(), out)), { recursive: true });
  writeFileSync(path.resolve(process.cwd(), out), JSON.stringify(report, null, 2));

  console.log(`\nFPR decomposition on ${file}`);
  console.log(`  scored ${benign} benign + ${attacks} attack rows through the REAL path (rules -> ML=${mode})\n`);
  console.log(`  real-path FPR      ${report.falsePositives.realPathRate}%  (${realFp}/${benign})   [loose: any action != ALLOW]`);
  console.log(`    caused by RULES  ${rulesFp}  (${report.falsePositives.causedByRulesShare}% of FPs, ${report.falsePositives.rulesOnlyRate}% of benign)`);
  console.log(`    added by ML      ${mlAddedFp}  (${report.falsePositives.causedByMlShare}% of FPs, ${report.falsePositives.mlAddedRate}% of benign)`);
  console.log(`  strict FPR         ${report.falsePositivesStrict.realPathRate}%  (${strictFp}/${benign})   [treated as ATTACK; excludes ${realFp - strictFp} redaction-only]`);
  console.log(`    caused by RULES  ${strictRulesFp}`);
  console.log(`    added by ML      ${strictMlFp}`);
  console.log(`  real-path recall   ${report.recall.realPath}%   (rules alone ${report.recall.rulesOnly}%, ML added ${mlAddedCatch} catches)`);
  console.log(`  integrity          ${monotonicityViolations} monotonicity violations, ${mlEscalationsAnywhere} ML escalations observed`);

  console.log(`\n  If the ML tier emitted ZERO false positives, FPR would still be ${report.ceilings.fprIfMlNeverFiredFp}% (target 1%).`);
  console.log(`  If the RULES tier emitted ZERO false positives, FPR would still be ${report.ceilings.fprIfRulesNeverFiredFp}% (target 1%).`);

  console.log(`\n  top rules findings behind FPs:`);
  for (const { key, count } of report.rulesAttribution.byFinding.slice(0, 10)) {
    console.log(`    ${count.toString().padStart(4)}x  ${key}`);
  }
  if (report.mlAttribution.byLabel.length) {
    console.log(`\n  top ML labels behind FPs:`);
    for (const { key, count } of report.mlAttribution.byLabel.slice(0, 10)) {
      console.log(`    ${count.toString().padStart(4)}x  ${key}`);
    }
  }
  console.log(`\n  worst languages by FPR:`);
  for (const l of report.byLanguage.slice(0, 8)) {
    console.log(`    ${l.language.padEnd(6)} ${l.fpr.toString().padStart(6)}%  (rules ${l.rulesFp}, ml ${l.mlFp}, n=${l.benign})`);
  }
  console.log(`\nwrote ${out}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
