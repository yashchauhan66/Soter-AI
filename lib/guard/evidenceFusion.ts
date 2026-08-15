/**
 * Evidence fusion: bound a rule's authority by its MEASURED noise on benign text.
 *
 * THE PROBLEM THIS SOLVES
 *   100% of the guard's false positives come from the rules tier, and every one is
 *   a single rule firing alone with full BLOCK authority. The engine currently has
 *   no way to distinguish:
 *
 *     "Aadhaar number detected"              — fires on 0% of benign text
 *     "Direct explosive construction inquiry" — fires on "what type of cheeses can
 *                                               you use to make a grilled cheese
 *                                               sandwich" (0.30% of benign rows)
 *
 *   Both declare CRITICAL/50 and both reach a BLOCK floor. Severity is a claim the
 *   rule author made; benign fire rate is a measurement. When they disagree, the
 *   measurement wins.
 *
 * THE RULE
 *   A rule measured as noisy on known-benign text cannot carry a severe action on
 *   its own. It still reports — the evidence is real and may matter in aggregate —
 *   but it needs corroboration from an INDEPENDENT family before it can block.
 *
 * WHY "FAMILY" AND NOT "LABEL"
 *   "Chemistry dual-use evasion", "… (leet)" and "… (compact)" are three encodings
 *   of ONE rule. They fire together on the same text by construction, so counting
 *   them as three agreeing signals is double-counting dressed as corroboration —
 *   measured on the benign corpus they fire at 0.24%/0.24%/0.22%, i.e. the same
 *   rows. Stripping the variant suffix collapses them to one vote.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *   It does not delete findings and it does not lower `score`. Both would break the
 *   monotonicity contract in decisionEngine.ts (more evidence must never soften a
 *   verdict) and would corrupt the audit trail. It marks findings `advisoryOnly`,
 *   and analyzeText keeps those out of the scoring and decision inputs. Everything
 *   remains visible to callers and to the ledger.
 *
 * WHY MONOTONICITY SURVIVES
 *   Demotion is not "more evidence made the verdict weaker". A noisy finding on its
 *   own is advisory; adding ANY clean finding from another family un-demotes it and
 *   contributes its own weight on top. Evidence only ever moves a verdict up.
 */

import type { GuardFinding } from "./types";

/** Measured rule behaviour, produced by scripts/ml/measure-rule-precision.ts. */
export interface RulePrecisionEntry {
  label: string;
  /** The RiskType this rule emits, used to check the corpus could measure it. */
  riskType: string;
  /** Fraction of KNOWN-BENIGN rows this rule accused. */
  benignFireRate: number;
  /** Fraction of KNOWN-ATTACK rows this rule caught. */
  attackFireRate: number;
  /** attackFireRate / smoothed benignFireRate. The discrimination measure. */
  lift: number;
}

export interface RulePrecisionTable {
  benignRowsScored: number;
  attackRowsScored: number;
  /**
   * The risk types the attack corpus actually contains.
   *
   * Without this the lift measure is dangerous. Our corpus is injection,
   * jailbreak and system-prompt extraction; it holds no chemistry, explosives or
   * weapons attacks at all. Measured against it "Chemistry dual-use evasion"
   * scores 0.24% benign / 0.00% attack, which is indistinguishable from a broken
   * rule and is nothing of the sort — there was simply nothing for it to catch.
   *
   * A rule whose risk type is not listed here is UNMEASURED, and unmeasured is
   * not the same as useless. Those rules keep their authority.
   */
  measuredRiskTypes: string[];
  rules: RulePrecisionEntry[];
}

/**
 * Variant suffixes applied by withDetectionVariantScope and the generalized
 * detectors. These are re-encodings of one rule, not independent evidence.
 */
const VARIANT_SUFFIX = /\s*\((?:leet|compact|generalized|spaced|homoglyph|unicode)\)\s*$/i;

export function familyOf(label: string): string {
  return label.replace(VARIANT_SUFFIX, "").trim().toLowerCase();
}

/**
 * A rule with no measurement is trusted, not distrusted.
 *
 * This is deliberately the opposite of the "unmeasured = untrusted" default that
 * would be safer in the abstract. The precision table only contains rules that
 * fired at least once on the benign corpus; the ~200 rules that never fired are
 * absent from it precisely BECAUSE they are clean. Defaulting absent rules to
 * untrusted would demote every high-precision detector in the suite — secrets,
 * Aadhaar, invisible Unicode — and turn a precision fix into a recall disaster.
 */

export interface FusionOptions {
  /** Below this fire rate a rule is quiet enough to act alone regardless of lift. */
  quietBenignRate?: number;
  /** Above this lift a rule discriminates well enough to act alone however noisy. */
  minLift?: number;
}

/**
 * A rule is demoted only when it fails BOTH tests: it accuses innocents often
 * AND it barely tells attacks from innocents.
 *
 * Thresholding on benign rate alone was tried first and measured: FPR 4.9% ->
 * 2.4%, but recall 73.4% -> 68.5%. It could not distinguish a noisy-but-sharp
 * rule from a rule that fires on everything, because those look identical from
 * the benign side. The lift term is what separates them.
 */
const DEFAULT_QUIET_BENIGN_RATE = 0.001; // 0.1% of benign rows
const DEFAULT_MIN_LIFT = 10; // fires 10x more often on attacks than innocents

export interface FusionResult {
  findings: GuardFinding[];
  demoted: Array<{ label: string; family: string; benignFireRate: number; why: string }>;
}

/**
 * Mark findings that are too noisy AND too indiscriminate to justify an action
 * on their own.
 *
 * Corroboration is counted across DISTINCT families, so three variants of one
 * noisy rule still count as one and remain advisory.
 */
export function fuseEvidence(
  findings: GuardFinding[],
  table: RulePrecisionTable | null,
  options: FusionOptions = {},
): FusionResult {
  if (!table || !findings.length) return { findings, demoted: [] };

  const quiet = options.quietBenignRate ?? DEFAULT_QUIET_BENIGN_RATE;
  const minLift = options.minLift ?? DEFAULT_MIN_LIFT;

  const byLabel = new Map<string, RulePrecisionEntry>();
  for (const r of table.rules) byLabel.set(r.label, r);
  const measured = new Set(table.measuredRiskTypes);

  const isNoisy = (label: string): boolean => {
    const m = byLabel.get(label);
    if (!m) return false; // never fired on benign text — trusted, see above
    if (m.benignFireRate <= quiet) return false; // quiet enough to act alone
    // The corpus contained no attack of this type, so its 0% attack fire rate is
    // an artifact of the corpus and not a property of the rule. Leave it alone.
    if (!measured.has(m.riskType)) return false;
    return m.lift < minLift; // noisy AND indiscriminate, on a corpus that could tell
  };

  // Families backed by at least one rule that may act alone. Only these count as
  // corroboration — two indiscriminate rules agreeing is not independent
  // evidence, it is two rules with overlapping vocabulary hitting the same prose.
  const trustworthyFamilies = new Set<string>();
  for (const f of findings) {
    if (f.type === "LOW_RISK") continue;
    if (!isNoisy(f.label)) trustworthyFamilies.add(familyOf(f.label));
  }

  const demoted: FusionResult["demoted"] = [];
  const out = findings.map((f) => {
    if (f.type === "LOW_RISK" || !isNoisy(f.label)) return f;

    const family = familyOf(f.label);
    // Corroborated when some OTHER family produced evidence that may act alone.
    //
    // This is deliberately topic-agnostic: any trustworthy signal from a
    // different family rescues the noisy one, even if the two are semantically
    // unrelated. A stricter "related family" rule would be more precise in
    // principle, but it would need a hand-built relatedness map — i.e. more
    // guessing — and the measured data does not call for it: essentially every
    // false positive we have is a SINGLE rule firing alone, which this catches.
    const corroborated = [...trustworthyFamilies].some((fam) => fam !== family);
    if (corroborated) return f;

    const m = byLabel.get(f.label)!;
    const why =
      `fires on ${(m.benignFireRate * 100).toFixed(2)}% of known-benign text but only ` +
      `${(m.attackFireRate * 100).toFixed(2)}% of known attacks (lift ${m.lift.toFixed(1)}x), ` +
      `and nothing independent corroborated it`;
    demoted.push({ label: f.label, family, benignFireRate: m.benignFireRate, why });
    return { ...f, advisoryOnly: true, advisoryReason: why };
  });

  return { findings: out, demoted };
}
