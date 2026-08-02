/**
 * Differential harness for the guard decision engine.
 *
 * WHY THIS EXISTS
 *   lib/guard/decisionEngine.ts was a chain of `if (has(X)) return ACTION` lines,
 *   which means its behaviour was defined by READING ORDER over ~25 risk types. There
 *   is no way to eyeball whether a table-driven replacement preserves it, and a
 *   decision engine is the one place in the guard where a silent softening is a
 *   customer-visible security regression. So the old engine is frozen below and every
 *   reachable input is replayed through both:
 *
 *     npm run guard:diff:decisions          # summary, fails on any weakening
 *     npm run guard:diff:decisions -- --all # print every divergence, not one per class
 *
 * WHAT IT ENUMERATES
 *   All risk-type subsets of size 1-3 (2 047 of them) x 3 directions x 9 score points
 *   chosen at and around every band edge (0, 30, 31, 44, 45, 60, 61, 85, 86, 100).
 *   Note that many pairs are unreachable in production — riskScore is derived from the
 *   same findings that produced riskTypes, so e.g. SECRET_DETECTED at score 0 cannot
 *   happen — but a decision engine should be monotone on its whole domain, not only
 *   where today's scoring happens to land.
 *
 * THE GATE
 *   WEAKER = 0. A single case where the new engine returns a softer action than the
 *   old one exits 1. Strengthenings are expected and printed by class so each one has
 *   to be justified out loud rather than discovered by a customer.
 *
 * LAST MEASURED (2026-08-01): see the tail of the run this file's header quotes in
 *   lib/guard/decisionEngine.ts. Re-run after every floor change.
 */

import { RISK_TYPES, type GuardAction, type GuardDirection, type RiskType } from "../../lib/guard/types";
import { decideGuardAction, explainGuardDecision } from "../../lib/guard/decisionEngine";

// ── The frozen pre-2026-08-01 engine. Do NOT fix anything here: it is the baseline,
//    bugs included. Copied verbatim from git 0a73738d lib/guard/decisionEngine.ts. ──

const sensitiveTypes: RiskType[] = ["PII_DETECTED", "INDIA_PII_DETECTED", "SECRET_DETECTED"];

function legacyDecideGuardAction(
  riskScore: number,
  riskTypes: RiskType[],
  direction: GuardDirection,
): GuardAction {
  const has = (type: RiskType) => riskTypes.includes(type);

  if (has("RATE_LIMIT") || has("SYSTEM_PROMPT_LEAK_ATTEMPT") || has("SYSTEM_PROMPT_LEAKAGE")) return "BLOCK";
  if (has("SSRF_ATTEMPT")) return "BLOCK";
  if (has("MCP_TOOL_POISONING") || has("MEMORY_POISONING")) return "BLOCK";
  if (has("TOXICITY") && riskScore >= 45) return "BLOCK";
  if (has("TOXICITY")) return "HUMAN_REVIEW";
  if (has("DATA_EXFILTRATION")) return direction === "OUTPUT" ? "BLOCK" : "HUMAN_REVIEW";
  if (has("PROMPT_INJECTION") && has("JAILBREAK")) return "BLOCK";
  if (has("RECURSIVE_INJECTION") && has("PROMPT_INJECTION")) return "BLOCK";
  if (has("COMPETITIVE_INTEL_EXTRACTION") && riskScore >= 45) return "BLOCK";
  if (has("COMPETITIVE_INTEL_EXTRACTION")) return "HUMAN_REVIEW";
  if (riskScore >= 86) return "BLOCK";
  if (has("SECRET_DETECTED")) return direction === "OUTPUT" ? "BLOCK" : "HUMAN_REVIEW";
  if (has("UNSAFE_OUTPUT")) return "HUMAN_REVIEW";
  if (has("TOKEN_ABUSE")) return "HUMAN_REVIEW";
  if (has("BIAS_DETECTED")) return "HUMAN_REVIEW";
  if (has("HALLUCINATION")) return "HUMAN_REVIEW";
  if (has("RECURSIVE_INJECTION")) return "HUMAN_REVIEW";
  if (riskScore >= 61) return has("PROMPT_INJECTION") || has("JAILBREAK") ? "BLOCK" : "HUMAN_REVIEW";
  if (riskTypes.some((type) => sensitiveTypes.includes(type))) {
    if (direction === "OUTPUT" && (has("PII_DETECTED") || has("INDIA_PII_DETECTED"))) return "BLOCK";
    return "ALLOW_WITH_REDACTION";
  }
  if (riskScore >= 31) return "REWRITE";
  return "ALLOW";
}

// ── Runner ──────────────────────────────────────────────────────────────────

const RANK: Record<GuardAction, number> = {
  ALLOW: 0,
  REWRITE: 1,
  ALLOW_WITH_REDACTION: 2,
  HUMAN_REVIEW: 3,
  BLOCK: 4,
};

const SCORES = [0, 30, 31, 44, 45, 60, 61, 85, 86, 100];
const DIRECTIONS: GuardDirection[] = ["INPUT", "OUTPUT", "ANALYZE"];
const TYPES = RISK_TYPES.filter((type) => type !== "LOW_RISK") as RiskType[];
const SHOW_ALL = process.argv.includes("--all");

/** Every subset of size 1..3. Beyond 3 the space explodes without adding coverage:
 *  the engine has no rule that needs four distinct types to fire. */
function subsets(): RiskType[][] {
  const out: RiskType[][] = [];
  for (let i = 0; i < TYPES.length; i += 1) {
    out.push([TYPES[i]]);
    for (let j = i + 1; j < TYPES.length; j += 1) {
      out.push([TYPES[i], TYPES[j]]);
      for (let k = j + 1; k < TYPES.length; k += 1) out.push([TYPES[i], TYPES[j], TYPES[k]]);
    }
  }
  return out;
}

interface Divergence {
  types: RiskType[];
  direction: GuardDirection;
  score: number;
  from: GuardAction;
  to: GuardAction;
  decidedBy: string;
}

function main() {
  const combos = subsets();
  const weaker: Divergence[] = [];
  const stronger: Divergence[] = [];
  let cases = 0;

  for (const types of combos) {
    for (const direction of DIRECTIONS) {
      for (const score of SCORES) {
        cases += 1;
        const from = legacyDecideGuardAction(score, types, direction);
        const decision = explainGuardDecision(score, types, direction);
        if (decision.action === from) continue;
        const row: Divergence = {
          types,
          direction,
          score,
          from,
          to: decision.action,
          decidedBy: decision.decidedBy,
        };
        (RANK[decision.action] < RANK[from] ? weaker : stronger).push(row);
      }
    }
  }

  // Monotonicity, checked directly rather than inferred: adding one more risk type to
  // any subset must never soften the action. This is the property the if-else chain
  // could not hold, so it is asserted on the same domain the diff walks.
  const nonMonotone: string[] = [];
  for (const types of combos) {
    if (types.length > 2) continue;
    for (const extra of TYPES) {
      if (types.includes(extra)) continue;
      for (const direction of DIRECTIONS) {
        for (const score of SCORES) {
          const base = decideGuardAction(score, types, direction);
          const grown = decideGuardAction(score, [...types, extra], direction);
          if (RANK[grown] < RANK[base]) {
            nonMonotone.push(`${types.join("+")} (+${extra}) ${direction} @${score}: ${base} -> ${grown}`);
          }
        }
      }
    }
  }

  report(cases, weaker, stronger, nonMonotone);
}

/** One line per divergence class (from -> to, by which contribution), plus examples. */
function report(
  cases: number,
  weaker: Divergence[],
  stronger: Divergence[],
  nonMonotone: string[],
) {
  console.log(
    `decision-engine diff: ${cases} cases ` +
      `(${TYPES.length} risk types, subsets of size 1-3, ${DIRECTIONS.length} directions, ${SCORES.length} scores)`,
  );

  const byClass = new Map<string, Divergence[]>();
  for (const row of stronger) {
    const key = `${row.from} -> ${row.to}  by ${row.decidedBy}`;
    const bucket = byClass.get(key);
    if (bucket) bucket.push(row);
    else byClass.set(key, [row]);
  }

  console.log(`\nSTRONGER (${stronger.length} cases, ${byClass.size} classes):`);
  const classes = [...byClass.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [key, rows] of classes) {
    console.log(`  ${String(rows.length).padStart(6)}x  ${key}`);
    for (const row of SHOW_ALL ? rows : rows.slice(0, 1)) {
      console.log(`            e.g. ${row.types.join("+")} ${row.direction} @${row.score}`);
    }
  }

  if (weaker.length) {
    console.log(`\nWEAKER (${weaker.length} cases) — every one of these is a regression:`);
    for (const row of weaker.slice(0, SHOW_ALL ? weaker.length : 40)) {
      console.log(
        `  ${row.types.join("+")} ${row.direction} @${row.score}: ${row.from} -> ${row.to} (${row.decidedBy})`,
      );
    }
  }

  if (nonMonotone.length) {
    console.log(`\nNON-MONOTONE (${nonMonotone.length} cases) — adding evidence softened the action:`);
    for (const line of nonMonotone.slice(0, SHOW_ALL ? nonMonotone.length : 40)) console.log(`  ${line}`);
  }

  const failed = weaker.length > 0 || nonMonotone.length > 0;
  console.log(
    `\nVERDICT: ${weaker.length} weaker, ${nonMonotone.length} non-monotone, ${stronger.length} stronger. ` +
      (failed
        ? "FAIL — a decision engine may only ever be strengthened silently."
        : "PASS — no case softened, and the engine is monotone in evidence."),
  );
  process.exitCode = failed ? 1 : 0;
}

main();
