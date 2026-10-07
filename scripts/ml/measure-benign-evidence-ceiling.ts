/**
 * Measure the CEILING of a benign-evidence downgrade layer before building one.
 *
 * WHY MEASURE FIRST
 *   scripts/ml/measure-rule-precision.ts showed AC6 (FPR <1%) is unreachable by
 *   retraining or by deleting rules: the deletion ceiling is 5.90% FPR at 83.6%
 *   recall. The only remaining mechanism is a layer that can DOWNGRADE an action
 *   a cheaper tier already took. No such layer exists — all three tiers are
 *   escalate-only (mlAugment.ts:529, llmJudge.ts:271).
 *
 *   Building one is a security-posture change: a layer that can clear a block is
 *   a bypass surface. So the question "would it even work" must be answered
 *   before writing it. The strongest benign evidence already available is the ML
 *   tier's own SAFE prediction, which mlAugment computes and attaches even when
 *   rules already acted. This script reads it for every row rules flagged and
 *   sweeps the threshold, so the precision of a downgrade is measured, not hoped.
 *
 * THE FINDING THAT SHAPES THE DESIGN
 *   A BLOCK -> HUMAN_REVIEW downgrade does NOT move FPR at all: both the loose
 *   (action != ALLOW) and strict (treated-as-attack) definitions still count
 *   HUMAN_REVIEW as a false positive. Only a downgrade that reaches ALLOW moves
 *   AC6 -- which is exactly the bypass-surface case. Both are reported so the
 *   tradeoff is explicit instead of discovered after the layer ships.
 *
 *   npx tsx scripts/ml/measure-benign-evidence-ceiling.ts \
 *     --file artifacts/ml/v18-balanced-comparison-rows.jsonl \
 *     --out  artifacts/ml/benign-evidence-ceiling-2026-09-26.json
 */
import * as path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.SOTERAI_ML_AUGMENT = "enforce";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
};
const file = arg("--file", "artifacts/ml/v18-balanced-comparison-rows.jsonl");
const out = arg("--out", "artifacts/ml/benign-evidence-ceiling.json");

type Row = { text: string; label: string; language?: string; category?: string };
type Finding = { label?: string; type?: string; severity?: string };
type Detail = {
  ran?: boolean;
  predictedLabel?: string;
  confidence?: number;
  attackProbability?: number;
  abstained?: boolean;
};
type Verdict = {
  allowed?: boolean;
  action?: string;
  findings?: Finding[];
  metadata?: { ml?: Detail };
};

const mod = (rel: string) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
const flagged = (v: Verdict): boolean =>
  v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");
const HARD = new Set(["HIGH", "CRITICAL"]);

// Candidate thresholds on attackProbability (= 1 - P(SAFE)). A row is eligible for
// downgrade only when the model is at least this confident the text is SAFE.
const TAUS = [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5];

type Case = {
  isAttack: boolean;
  action: string;
  attackProb: number | null;
  predicted: string | null;
  abstained: boolean;
  hasHardFinding: boolean;
};

async function main(): Promise<void> {
  const { analyzeText } = (await import(mod("lib/guard/analyze.ts"))) as {
    analyzeText: (t: string, dir: string) => Verdict;
  };
  const { augmentWithMl, resolveMlAugmentMode } = (await import(mod("lib/guard/mlAugment.ts"))) as {
    augmentWithMl: (v: Verdict, t: string, dir: string) => Promise<Verdict>;
    resolveMlAugmentMode: () => string;
  };

  const mode = resolveMlAugmentMode();
  if (mode === "off") {
    console.error("[FATAL] ML is 'off', so there is no benign evidence to read. Refusing.");
    process.exit(2);
  }

  const rows: Row[] = readFileSync(path.resolve(process.cwd(), file), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const cases: Case[] = [];
  let benign = 0, attacks = 0, withoutDetail = 0;

  for (const r of rows) {
    const before = analyzeText(r.text, "INPUT");
    if (r.label === "SAFE") benign++;
    else attacks++;
    // Only rows a tier actually flagged can be downgraded.
    if (!flagged(before)) continue;
    const after = await augmentWithMl(before, r.text, "INPUT");
    const d = after.metadata?.ml;
    if (!d || d.ran !== true || typeof d.attackProbability !== "number") withoutDetail++;
    cases.push({
      isAttack: r.label !== "SAFE",
      action: before.action ?? "?",
      attackProb: typeof d?.attackProbability === "number" ? d.attackProbability : null,
      predicted: d?.predictedLabel ?? null,
      abstained: d?.abstained === true,
      hasHardFinding: (before.findings ?? []).some((f) => HARD.has(String(f.severity ?? ""))),
    });
  }

  if (!cases.length) {
    console.error("[FATAL] rules flagged 0 rows — nothing to downgrade. Harness failure.");
    process.exit(2);
  }
  // Without a usable attackProbability there is no benign evidence to threshold on,
  // and every sweep row would silently fall through as "not eligible" — which reads
  // as "a downgrade layer would never fire" rather than "we could not measure it".
  const usable = cases.filter((c) => c.attackProb !== null).length;
  if (usable === 0) {
    console.error(`[FATAL] none of the ${cases.length} flagged rows carried an ML attackProbability.`);
    console.error("        The benign-evidence signal is unreadable here, not absent. Refusing.");
    process.exit(2);
  }

  const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);
  const rulesFp = cases.filter((c) => !c.isAttack).length;
  const rulesCaught = cases.filter((c) => c.isAttack).length;

  // Eligibility gates, applied in the safe order: positive benign evidence, model
  // did not abstain, and no HIGH/CRITICAL finding present.
  const eligible = (c: Case, tau: number): boolean =>
    c.attackProb !== null && c.attackProb <= tau && !c.abstained && !c.hasHardFinding;

  // The same test WITHOUT the severity gate. Measured separately because the gate
  // turned out to be the binding constraint for far more rows than the evidence
  // was, and "would loosening it help" is an empirical question, not a judgement
  // call. Note what this variant means: releasing text that carries a HIGH or
  // CRITICAL finding on the strength of a model's SAFE vote. That is the most
  // security-consequential variant here, so its attack cost is reported next to
  // its benefit and never on its own.
  const eligibleNoSeverityGate = (c: Case, tau: number): boolean =>
    c.attackProb !== null && c.attackProb <= tau && !c.abstained;

  const sweep = TAUS.map((tau) => {
    const fpCleared = cases.filter((c) => !c.isAttack && eligible(c, tau)).length;
    const attacksReleased = cases.filter((c) => c.isAttack && eligible(c, tau)).length;
    // Restricting the layer to BLOCK rows only, as the conservative variant.
    const fpClearedBlockOnly = cases.filter((c) => !c.isAttack && c.action === "BLOCK" && eligible(c, tau)).length;
    const attacksReleasedBlockOnly = cases.filter((c) => c.isAttack && c.action === "BLOCK" && eligible(c, tau)).length;
    const fpClearedNoGate = cases.filter((c) => !c.isAttack && eligibleNoSeverityGate(c, tau)).length;
    const attacksReleasedNoGate = cases.filter((c) => c.isAttack && eligibleNoSeverityGate(c, tau)).length;
    return {
      tau,
      toAllow: {
        fpCleared,
        attacksReleased,
        precision: fpCleared + attacksReleased ? Number((fpCleared / (fpCleared + attacksReleased)).toFixed(4)) : null,
        rulesFprAfter: pct(rulesFp - fpCleared, benign),
        recallAfter: pct(rulesCaught + (2000 - rulesCaught) - attacksReleased, attacks),
      },
      blockOnlyToAllow: {
        fpCleared: fpClearedBlockOnly,
        attacksReleased: attacksReleasedBlockOnly,
        rulesFprAfter: pct(rulesFp - fpClearedBlockOnly, benign),
      },
      noSeverityGateToAllow: {
        fpCleared: fpClearedNoGate,
        attacksReleased: attacksReleasedNoGate,
        precision:
          fpClearedNoGate + attacksReleasedNoGate
            ? Number((fpClearedNoGate / (fpClearedNoGate + attacksReleasedNoGate)).toFixed(4))
            : null,
        rulesFprAfter: pct(rulesFp - fpClearedNoGate, benign),
        attacksReleasedShareOfAllAttacks: pct(attacksReleasedNoGate, attacks),
      },
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    file,
    mlAugmentMode: mode,
    scored: { rows: rows.length, benign, attacks },
    flaggedByRules: { total: cases.length, falsePositives: rulesFp, trueCatches: rulesCaught },
    detailCoverage: { withAttackProbability: usable, missing: cases.length - usable },
    eligibilityGates: [
      "attackProbability <= tau (positive benign evidence from the ML tier)",
      "not abstained (calibration declining to decide must never read as safe)",
      "no HIGH/CRITICAL finding present",
    ],
    // WHICH GATE BINDS decides whether this idea is dead or merely gated too
    // tightly. If the model's own attackProbability is high on the rows rules got
    // wrong, the two tiers make CORRELATED errors and no amount of loosening the
    // severity gate helps -- there is no benign evidence to read. Reported at a
    // permissive tau so the severity gate cannot masquerade as missing evidence.
    whyNotEligible: (() => {
      const fps = cases.filter((c) => !c.isAttack);
      const tau = 0.5;
      const noEvidence = fps.filter((c) => c.attackProb === null || c.attackProb > tau).length;
      const abstainedOnly = fps.filter((c) => c.attackProb !== null && c.attackProb <= tau && c.abstained).length;
      const hardOnly = fps.filter(
        (c) => c.attackProb !== null && c.attackProb <= tau && !c.abstained && c.hasHardFinding,
      ).length;
      const buckets = [0.01, 0.1, 0.5, 0.9, 1.01];
      let prev = 0;
      const attackProbHistogram = buckets.map((b) => {
        const n = fps.filter((c) => c.attackProb !== null && c.attackProb > prev && c.attackProb <= b).length;
        const row = { upTo: b, falsePositiveRows: n };
        prev = b;
        return row;
      });
      return {
        tauUsed: tau,
        falsePositiveRows: fps.length,
        blockedByNoBenignEvidence: noEvidence,
        blockedByAbstentionOnly: abstainedOnly,
        blockedBySeverityGateOnly: hardOnly,
        eligible: fps.length - noEvidence - abstainedOnly - hardOnly,
        attackProbHistogram,
        // Both facts are reported rather than collapsed into one verdict. An
        // earlier version pronounced "loosening the gates cannot help" whenever
        // correlated errors were the majority, which was wrong here: 66% of rows
        // were correlated AND the severity gate independently blocked 84 rows.
        // A single verdict hid the second, larger lever.
        correlatedErrorShare: pct(noEvidence, fps.length),
        severityGateBlockedShare: pct(hardOnly, fps.length),
        interpretation:
          `${pct(noEvidence, fps.length)}% of rules false positives carry no benign evidence ` +
          `(the ML tier agrees with rules), so that share is unreachable by any downgrade layer. ` +
          `A further ${hardOnly} rows DO carry benign evidence and are held back only by the ` +
          `HIGH/CRITICAL severity gate -- see sweep[].noSeverityGateToAllow for what releasing ` +
          `them would cost in attacks before treating that as an opportunity.`,
      };
    })(),
    criticalNote:
      "A BLOCK -> HUMAN_REVIEW downgrade does NOT reduce FPR: HUMAN_REVIEW is still " +
      "action != ALLOW and still counts as a false positive under both definitions. " +
      "Only a downgrade reaching ALLOW moves AC6, and that is the bypass-surface case.",
    sweep,
  };

  mkdirSync(path.dirname(path.resolve(process.cwd(), out)), { recursive: true });
  writeFileSync(path.resolve(process.cwd(), out), JSON.stringify(report, null, 2));

  console.log(`\nBenign-evidence downgrade ceiling on ${file}`);
  console.log(`  rules flagged ${cases.length} rows: ${rulesFp} false positives, ${rulesCaught} true catches`);
  console.log(`  ML detail available on ${usable}/${cases.length} of them\n`);
  console.log(`  tau      FPs cleared   attacks RELEASED   precision   rules FPR after`);
  for (const s of sweep) {
    const p = s.toAllow.precision === null ? "   n/a" : s.toAllow.precision.toFixed(3);
    console.log(
      `  ${s.tau.toString().padEnd(7)} ${s.toAllow.fpCleared.toString().padStart(8)}   ${s.toAllow.attacksReleased
        .toString()
        .padStart(14)}   ${p.padStart(9)}   ${s.toAllow.rulesFprAfter.toString().padStart(9)}%`,
    );
  }
  console.log(`\n  target rules FPR: <1%  (ML tier separately contributes 9.3%)`);
  const w = report.whyNotEligible;
  console.log(`\n  WHY the ${w.falsePositiveRows} false positives are not eligible (tau=${w.tauUsed}):`);
  console.log(`    no benign evidence (model agrees with rules) : ${w.blockedByNoBenignEvidence}`);
  console.log(`    blocked by abstention only                   : ${w.blockedByAbstentionOnly}`);
  console.log(`    blocked by HIGH/CRITICAL severity gate only   : ${w.blockedBySeverityGateOnly}`);
  console.log(`    eligible                                     : ${w.eligible}`);
  console.log(`\n  attackProbability spread over the FP rows:`);
  for (const h of w.attackProbHistogram) {
    console.log(`    <= ${h.upTo.toString().padEnd(5)} ${h.falsePositiveRows.toString().padStart(4)} rows`);
  }
  console.log(`\n  WITHOUT the HIGH/CRITICAL severity gate (releases hard-flagged text on a model SAFE vote):`);
  console.log(`  tau      FPs cleared   attacks RELEASED   precision   rules FPR after`);
  for (const s of sweep) {
    const g = s.noSeverityGateToAllow;
    const p = g.precision === null ? "   n/a" : g.precision.toFixed(3);
    console.log(
      `  ${s.tau.toString().padEnd(7)} ${g.fpCleared.toString().padStart(8)}   ${g.attacksReleased
        .toString()
        .padStart(14)}   ${p.padStart(9)}   ${g.rulesFprAfter.toString().padStart(9)}%`,
    );
  }
  console.log(`\n  ${w.interpretation}`);
  console.log(`\n  ${report.criticalNote}\n`);
  console.log(`wrote ${out}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
