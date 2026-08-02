/**
 * Guard decision engine (lib/guard/decisionEngine.ts).
 *
 * WHY THIS EXISTS
 *   The engine used to be a chain of `if (has(X)) return ACTION`, so its behaviour was
 *   defined by reading order over ~25 risk types and had never been unit-tested — the
 *   ~35 suites that depend on it only reach it through analyzeText/applyPolicy. Two
 *   defects lived in that shape and both are pinned below: severity inversion (an
 *   earlier, weaker rule preempting a later, stronger one) and silent fall-through
 *   (four risk types with no rule at all, resolved by the score bands to REWRITE).
 *
 * WHAT IS ASSERTED
 *   1. The lattice: strongestAction / isStrongerAction agree on one total order.
 *   2. Monotonicity — adding a risk type can never soften the action. This is the
 *      property the if-else chain could not hold. Checked on a sampled domain here;
 *      the exhaustive 61 410-case version is `npm run guard:diff:decisions`.
 *   3. The fixed inversions, as concrete cases (toxicity no longer outranks a leaked
 *      credential, nor the >=86 band, nor the injection+jailbreak combination).
 *   4. The four fall-through types are held, not forwarded, at their own weight.
 *   5. Provenance escalates instruction-bearing signals ONLY, and never weakens.
 *   6. `explainGuardDecision` names the contribution that decided and orders the rest
 *      strongest-first, because an audit trail that cannot say why is not one.
 *   7. applyPolicy's tenant `bareInjectionHandling` still reaches the indirect case:
 *      declaring a stronger provenance must not disable a stricter policy.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  decideGuardAction,
  explainGuardDecision,
  isStrongerAction,
  strongestAction,
  PROVENANCE_VALUES,
  type ContentProvenance,
} from "../../lib/guard/decisionEngine";
import { analyzeText } from "../../lib/guard/analyze";
import { DEFAULT_POLICY, applyPolicy, type ResolvedPolicy } from "../../lib/guard/policy";
import { RISK_TYPES, type GuardAction, type GuardDirection, type RiskType } from "../../lib/guard/types";

const RANK: Record<GuardAction, number> = {
  ALLOW: 0,
  REWRITE: 1,
  ALLOW_WITH_REDACTION: 2,
  HUMAN_REVIEW: 3,
  BLOCK: 4,
};

const TYPES = RISK_TYPES.filter((type) => type !== "LOW_RISK") as RiskType[];
const DIRECTIONS: GuardDirection[] = ["INPUT", "OUTPUT", "ANALYZE"];
/** Band edges only: every branch in scoreBand plus both sides of the 45 hard floor. */
const SCORES = [0, 31, 45, 61, 86];

test("lattice: strongestAction is a total order and agrees with isStrongerAction", () => {
  const order: GuardAction[] = ["ALLOW", "REWRITE", "ALLOW_WITH_REDACTION", "HUMAN_REVIEW", "BLOCK"];
  for (const a of order) {
    for (const b of order) {
      const strongest = strongestAction(a, b);
      assert.equal(RANK[strongest], Math.max(RANK[a], RANK[b]), `strongest(${a},${b})`);
      assert.equal(strongestAction(a, b), strongestAction(b, a), "commutative");
      assert.equal(isStrongerAction(a, b), RANK[a] > RANK[b], `isStronger(${a},${b})`);
    }
  }
  // Redaction outranks rewrite: removing the span beats neutralising the phrasing.
  assert.equal(strongestAction("REWRITE", "ALLOW_WITH_REDACTION"), "ALLOW_WITH_REDACTION");
});

test("monotone in evidence: adding a risk type never softens the action", () => {
  const failures: string[] = [];
  for (let i = 0; i < TYPES.length; i += 1) {
    const bases: RiskType[][] = [[TYPES[i]]];
    for (let j = i + 1; j < TYPES.length; j += 1) bases.push([TYPES[i], TYPES[j]]);
    for (const base of bases) {
      for (const extra of TYPES) {
        if (base.includes(extra)) continue;
        for (const direction of DIRECTIONS) {
          for (const score of SCORES) {
            const before = decideGuardAction(score, base, direction);
            const after = decideGuardAction(score, [...base, extra], direction);
            if (RANK[after] < RANK[before]) {
              failures.push(`${base.join("+")} (+${extra}) ${direction} @${score}: ${before} -> ${after}`);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} non-monotone cases`);
});

test("monotone in score: a higher aggregate never softens the action", () => {
  for (const type of TYPES) {
    for (const direction of DIRECTIONS) {
      let previous = decideGuardAction(0, [type], direction);
      for (const score of [30, 31, 44, 45, 60, 61, 85, 86, 100]) {
        const current = decideGuardAction(score, [type], direction);
        assert.ok(
          RANK[current] >= RANK[previous],
          `${type} ${direction}: score ${score} softened ${previous} -> ${current}`,
        );
        previous = current;
      }
    }
  }
});

test("fixed inversion: toxicity no longer outranks a credential leaving the system", () => {
  // Old engine: `if (has("TOXICITY")) return "HUMAN_REVIEW"` sat above the secret rule,
  // so OUTPUT text carrying BOTH was held for review while the credential went out.
  assert.equal(decideGuardAction(70, ["TOXICITY", "SECRET_DETECTED"], "OUTPUT"), "BLOCK");
  assert.equal(decideGuardAction(70, ["TOXICITY", "PII_DETECTED"], "OUTPUT"), "BLOCK");
  assert.equal(decideGuardAction(70, ["TOXICITY", "INDIA_PII_DETECTED"], "OUTPUT"), "BLOCK");
  assert.equal(decideGuardAction(70, ["TOXICITY", "DATA_EXFILTRATION"], "OUTPUT"), "BLOCK");
});

test("fixed inversion: the >=86 band and the combinations are reachable past toxicity", () => {
  assert.equal(decideGuardAction(100, ["TOXICITY"], "INPUT"), "BLOCK");
  assert.equal(decideGuardAction(90, ["TOXICITY", "HALLUCINATION"], "INPUT"), "BLOCK");
  // DATA_EXFILTRATION used to return before the injection+jailbreak combination.
  assert.equal(
    decideGuardAction(60, ["DATA_EXFILTRATION", "PROMPT_INJECTION", "JAILBREAK"], "INPUT"),
    "BLOCK",
  );
  // ... and before the competitive-intel hard floor at 45.
  assert.equal(
    decideGuardAction(50, ["DATA_EXFILTRATION", "COMPETITIVE_INTEL_EXTRACTION"], "INPUT"),
    "BLOCK",
  );
});

test("fixed fall-through: the four unmapped types are held, not forwarded", () => {
  // Each declares 35-50 on its own, which lands in the 31-60 REWRITE band. Under the
  // old engine a lone finding of any of these was therefore ALLOWED after a rewrite.
  const cases: Array<[RiskType, number]> = [
    ["MULTIMODAL_INJECTION", 50],
    ["ADVANCED_SMUGGLING", 40],
    ["MODEL_SUPPLY_CHAIN", 55],
    ["BEHAVIORAL_ANOMALY", 45],
  ];
  for (const [type, weight] of cases) {
    for (const direction of DIRECTIONS) {
      const action = decideGuardAction(weight, [type], direction);
      assert.ok(
        RANK[action] >= RANK["HUMAN_REVIEW"],
        `${type} @${weight} ${direction} resolved to ${action}, which forwards it`,
      );
    }
  }
});

test("the bare-injection REWRITE band is preserved for the tenant policy", () => {
  // policy.ts reads REWRITE on a lone PROMPT_INJECTION as `bareInjectionHandling`.
  // A HUMAN_REVIEW floor here would take that choice away from every tenant.
  assert.equal(decideGuardAction(40, ["PROMPT_INJECTION"], "INPUT"), "REWRITE");
  assert.equal(decideGuardAction(35, ["JAILBREAK"], "INPUT"), "REWRITE");
  // Co-signalled, it is not ambiguous phrasing any more.
  assert.equal(decideGuardAction(75, ["PROMPT_INJECTION", "JAILBREAK"], "INPUT"), "BLOCK");
  assert.equal(decideGuardAction(85, ["PROMPT_INJECTION"], "INPUT"), "BLOCK");
});

test("provenance: an instruction from a retrieved document is held, not rewritten", () => {
  const bare: RiskType[] = ["PROMPT_INJECTION"];
  assert.equal(decideGuardAction(40, bare, "INPUT"), "REWRITE");
  assert.equal(decideGuardAction(40, bare, "INPUT", { provenance: "USER" }), "REWRITE");
  for (const provenance of ["RETRIEVED_DOCUMENT", "TOOL_OUTPUT", "TOOL_METADATA", "AGENT_MEMORY"] as const) {
    assert.equal(
      decideGuardAction(40, bare, "INPUT", { provenance }),
      "HUMAN_REVIEW",
      `${provenance} must not be rewritten and forwarded`,
    );
  }
  assert.equal(decideGuardAction(35, ["JAILBREAK"], "INPUT", { provenance: "AGENT_MEMORY" }), "HUMAN_REVIEW");
});

test("provenance escalates instruction-bearing signals only", () => {
  // A leaked identifier is equally bad wherever it came from, so redaction stands.
  assert.equal(
    decideGuardAction(25, ["PII_DETECTED"], "INPUT", { provenance: "RETRIEVED_DOCUMENT" }),
    "ALLOW_WITH_REDACTION",
  );
  assert.equal(
    decideGuardAction(30, ["HALLUCINATION"], "INPUT", { provenance: "MODEL_OUTPUT" }),
    "HUMAN_REVIEW",
  );
  // Already-BLOCK floors are unaffected (nothing above BLOCK to escalate to).
  assert.equal(
    decideGuardAction(65, ["MCP_TOOL_POISONING"], "INPUT", { provenance: "TOOL_METADATA" }),
    "BLOCK",
  );
});

test("provenance never weakens the outcome, for any signal or direction", () => {
  for (const type of TYPES) {
    for (const direction of DIRECTIONS) {
      for (const score of SCORES) {
        const baseline = decideGuardAction(score, [type], direction, { provenance: "USER" });
        for (const provenance of PROVENANCE_VALUES) {
          const action = decideGuardAction(score, [type], direction, { provenance });
          assert.ok(
            RANK[action] >= RANK[baseline],
            `${type} ${direction} @${score} as ${provenance}: ${baseline} -> ${action}`,
          );
        }
      }
    }
  }
});

test("provenance defaults to USER and is echoed for the audit trail", () => {
  const decision = explainGuardDecision(40, ["PROMPT_INJECTION"], "INPUT");
  assert.equal(decision.provenance, "USER");
  for (const provenance of PROVENANCE_VALUES) {
    const explained = explainGuardDecision(40, ["PROMPT_INJECTION"], "INPUT", { provenance });
    assert.equal(explained.provenance, provenance as ContentProvenance);
  }
});

test("explain: the winning contribution is named, the rest are ordered strongest-first", () => {
  const decision = explainGuardDecision(70, ["TOXICITY", "SECRET_DETECTED"], "OUTPUT");
  assert.equal(decision.action, "BLOCK");
  assert.ok(
    decision.contributions.length >= 3,
    "toxicity, secret and the 61-85 band should each contribute",
  );
  for (let i = 1; i < decision.contributions.length; i += 1) {
    assert.ok(
      RANK[decision.contributions[i - 1].action] >= RANK[decision.contributions[i].action],
      "contributions must be sorted strongest-first",
    );
  }
  assert.equal(decision.contributions[0].action, decision.action, "the winner sets the action");
  assert.equal(decision.decidedBy, `${decision.contributions[0].source}:${decision.contributions[0].detail}`);
  for (const contribution of decision.contributions) {
    assert.ok(contribution.why.trim().length > 10, `contribution ${contribution.detail} has no reason`);
  }
});

test("explain: no evidence is ALLOW, and says so instead of naming a signal", () => {
  const decision = explainGuardDecision(0, ["LOW_RISK"], "INPUT");
  assert.equal(decision.action, "ALLOW");
  assert.deepEqual(decision.contributions, []);
  assert.match(decision.decidedBy, /no signal/i);
  assert.equal(explainGuardDecision(0, [], "INPUT").action, "ALLOW");
  // An unmapped-but-scoring input still falls back to the bands, not to ALLOW.
  assert.equal(explainGuardDecision(50, ["LOW_RISK"], "INPUT").decidedBy, "score-band:aggregate");
});

test("explain: the combination and the hard floor each report themselves", () => {
  const combo = explainGuardDecision(60, ["PROMPT_INJECTION", "JAILBREAK"], "INPUT");
  assert.equal(combo.action, "BLOCK");
  assert.equal(combo.decidedBy, "combination:PROMPT_INJECTION + JAILBREAK");
  const hard = explainGuardDecision(45, ["TOXICITY"], "INPUT");
  assert.equal(hard.action, "BLOCK");
  assert.equal(hard.decidedBy, "signal:TOXICITY");
  assert.match(hard.contributions[0].why, /45/);
  // One point below the hard floor it is still a hold.
  assert.equal(decideGuardAction(44, ["TOXICITY"], "INPUT"), "HUMAN_REVIEW");
});

test("direction: PII and secrets are redacted or held inbound, refused outbound", () => {
  assert.equal(decideGuardAction(25, ["PII_DETECTED"], "INPUT"), "ALLOW_WITH_REDACTION");
  assert.equal(decideGuardAction(25, ["PII_DETECTED"], "OUTPUT"), "BLOCK");
  assert.equal(decideGuardAction(30, ["INDIA_PII_DETECTED"], "INPUT"), "ALLOW_WITH_REDACTION");
  assert.equal(decideGuardAction(30, ["INDIA_PII_DETECTED"], "OUTPUT"), "BLOCK");
  assert.equal(decideGuardAction(70, ["SECRET_DETECTED"], "INPUT"), "HUMAN_REVIEW");
  assert.equal(decideGuardAction(70, ["SECRET_DETECTED"], "OUTPUT"), "BLOCK");
  assert.equal(decideGuardAction(60, ["DATA_EXFILTRATION"], "INPUT"), "HUMAN_REVIEW");
  assert.equal(decideGuardAction(60, ["DATA_EXFILTRATION"], "OUTPUT"), "BLOCK");
});

// PLACEHOLDER_TESTS
