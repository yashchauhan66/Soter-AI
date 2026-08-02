/**
 * Guard decision engine: from accumulated evidence to one action.
 *
 * WHY THIS IS NOT A CHAIN OF IF-RETURNS
 *   The previous implementation was 30 ordered `if (has(X)) return ACTION` lines, so
 *   the FIRST matching signal decided, not the most severe one. Two defects followed
 *   from that shape, both reachable in production:
 *
 *     1. Severity inversion. `if (has("TOXICITY")) return "HUMAN_REVIEW"` sat above
 *        the secret and PII rules, so OUTPUT text carrying BOTH toxicity and a live
 *        credential was held for review instead of blocked. Adding evidence made the
 *        verdict weaker, which is the one thing a security decision must never do.
 *     2. Silent fall-through. Four risk types had no rule at all
 *        (MULTIMODAL_INJECTION, MODEL_SUPPLY_CHAIN, BEHAVIORAL_ANOMALY,
 *        ADVANCED_SMUGGLING), so the score bands decided them alone. Their weights
 *        are 40-55 and a lone finding declares 35-50, which lands in the 31-60 band:
 *        REWRITE, i.e. allowed. Text carrying bidirectional Unicode control
 *        characters was forwarded unless some other detector happened to fire too.
 *
 *   So: map every signal to a minimum action (a floor), combine floors by taking the
 *   STRONGEST, and only then apply the aggregate score bands. Monotonicity is the
 *   invariant — more evidence can never soften the outcome — and it is enforced by
 *   test, not by reading order. Every contribution is returned so an audit trail can
 *   say which signal decided and why.
 *
 * WHY PROVENANCE IS AN INPUT
 *   "Ignore previous instructions" typed by the operator is the operator exercising
 *   their own authority over their own session. The same sentence arriving inside a
 *   retrieved document, an MCP tool description, or a replayed memory entry is an
 *   indirect injection (OWASP LLM01) with no legitimate reading at all. The engine
 *   therefore raises the floor of instruction-bearing signals when the caller states
 *   the text is not first-party. Callers that cannot know the provenance omit it and
 *   get USER, which is the legacy behaviour.
 *
 * BEHAVIOURAL CONTRACT AGAINST THE OLD ENGINE
 *   scripts/guard-benchmark/decision-engine-diff.ts holds a frozen copy of the old
 *   engine and enumerates every (risk-type subset x direction x score) case, then
 *   asserts the new action is never weaker. Run it before changing any floor:
 *     npm run guard:diff:decisions
 */

import type { GuardAction, GuardDirection, RiskType } from "./types";

/** Severity ladder. Higher rank wins whenever two signals disagree. */
const ACTION_RANK: Record<GuardAction, number> = {
  ALLOW: 0,
  REWRITE: 1,
  ALLOW_WITH_REDACTION: 2,
  HUMAN_REVIEW: 3,
  BLOCK: 4,
};

/**
 * Redaction outranks rewrite because the old engine preferred it whenever both
 * applied (its PII branch sat above the score>=31 REWRITE band), and because
 * removing a secret span is a strictly stronger mitigation than neutralising
 * instruction phrasing around it.
 */
export function strongestAction(a: GuardAction, b: GuardAction): GuardAction {
  return ACTION_RANK[b] > ACTION_RANK[a] ? b : a;
}

export function isStrongerAction(candidate: GuardAction, baseline: GuardAction): boolean {
  return ACTION_RANK[candidate] > ACTION_RANK[baseline];
}

/** Where the scanned text came from. Anything other than USER is indirect. */
export const PROVENANCE_VALUES = [
  "USER",
  "TOOL_OUTPUT",
  "TOOL_METADATA",
  "RETRIEVED_DOCUMENT",
  "AGENT_MEMORY",
  "MODEL_OUTPUT",
] as const;

export type ContentProvenance = (typeof PROVENANCE_VALUES)[number];

export interface DecisionContext {
  /**
   * Defaults to USER. Set it wherever the caller genuinely knows the source — a RAG
   * chunk, an OCR'd upload, an MCP tool description, a memory entry — because that is
   * the difference between a user's own instruction and an injected one.
   */
  provenance?: ContentProvenance;
}

interface SignalRule {
  /** Minimum action for this signal on INPUT / ANALYZE. */
  floor: GuardAction;
  /** Minimum action when the text is on its way out (direction OUTPUT). */
  outputFloor?: GuardAction;
  /** Once the aggregate score reaches this, the floor rises to hardFloor. */
  hardAtScore?: number;
  hardFloor?: GuardAction;
  /**
   * True when the finding is an instruction addressed to the model. Only these are
   * escalated by non-USER provenance: a leaked secret is equally bad wherever it
   * came from, an imperative override is not.
   */
  instructionBearing?: boolean;
  why: string;
}

/**
 * Per-signal floors. Everything here except the four fall-through types and the
 * provenance escalation is the old engine's behaviour restated as a table; the diff
 * harness is what proves that claim.
 */
const SIGNALS: Partial<Record<RiskType, SignalRule>> = {
  // ── Refused outright ──
  RATE_LIMIT: { floor: "BLOCK", why: "quota abuse is refused, not queued for a human" },
  SYSTEM_PROMPT_LEAK_ATTEMPT: {
    floor: "BLOCK",
    instructionBearing: true,
    why: "there is no benign way to ask for the hidden system prompt verbatim",
  },
  SYSTEM_PROMPT_LEAKAGE: {
    floor: "BLOCK",
    why: "the system prompt is already in the text; forwarding it completes the leak",
  },
  SSRF_ATTEMPT: { floor: "BLOCK", why: "internal-network reach is never a legitimate ask" },
  MCP_TOOL_POISONING: {
    floor: "BLOCK",
    instructionBearing: true,
    why: "a tool description that instructs the model is a supply-chain compromise",
  },
  MEMORY_POISONING: {
    floor: "BLOCK",
    instructionBearing: true,
    why: "persisted instructions outlive the session, so review-later is too late",
  },

  // ── Refused once the aggregate crosses the old engine's 45-point line ──
  TOXICITY: {
    floor: "HUMAN_REVIEW",
    hardAtScore: 45,
    hardFloor: "BLOCK",
    why: "harmful content is held, and refused once it is more than incidental",
  },
  COMPETITIVE_INTEL_EXTRACTION: {
    floor: "HUMAN_REVIEW",
    hardAtScore: 45,
    hardFloor: "BLOCK",
    why: "probing for another tenant's configuration is held, then refused",
  },

  // ── Direction decides: a channel that can leak is blocked on the way out ──
  DATA_EXFILTRATION: {
    floor: "HUMAN_REVIEW",
    outputFloor: "BLOCK",
    why: "zero-click markdown/image/link beacons leak context with no user action",
  },
  SECRET_DETECTED: {
    floor: "HUMAN_REVIEW",
    outputFloor: "BLOCK",
    why: "a live credential leaving the system is unrecoverable once sent",
  },
  PII_DETECTED: {
    floor: "ALLOW_WITH_REDACTION",
    outputFloor: "BLOCK",
    why: "identifiers are redacted inbound and refused outbound",
  },
  INDIA_PII_DETECTED: {
    floor: "ALLOW_WITH_REDACTION",
    outputFloor: "BLOCK",
    why: "Aadhaar/PAN-class identifiers are redacted inbound and refused outbound",
  },

  // ── Held for a human ──
  UNSAFE_OUTPUT: { floor: "HUMAN_REVIEW", why: "content-harm calls are judgement calls" },
  TOKEN_ABUSE: { floor: "HUMAN_REVIEW", why: "an oversized payload is cheap to hold, expensive to serve" },
  BIAS_DETECTED: { floor: "HUMAN_REVIEW", why: "bias and disinformation need a person, not a regex" },
  HALLUCINATION: { floor: "HUMAN_REVIEW", why: "an unsupported claim is reviewed, never rewritten silently" },
  RECURSIVE_INJECTION: {
    floor: "HUMAN_REVIEW",
    instructionBearing: true,
    why: "an override that plants a further override survives being rewritten",
  },

  // ── The four the old engine never mentioned. Each declares 35-50 on its own, so
  //    the score bands alone resolved them to REWRITE — allowed. A floor of
  //    HUMAN_REVIEW is the smallest change that stops forwarding them.
  MULTIMODAL_INJECTION: {
    floor: "HUMAN_REVIEW",
    instructionBearing: true,
    why: "an instruction hidden in an image or file is still an instruction",
  },
  ADVANCED_SMUGGLING: {
    floor: "HUMAN_REVIEW",
    instructionBearing: true,
    why: "invisible or bidirectional control characters exist only to hide intent",
  },
  MODEL_SUPPLY_CHAIN: {
    floor: "HUMAN_REVIEW",
    why: "loading an unverified artifact is a decision an operator must make",
  },
  BEHAVIORAL_ANOMALY: {
    floor: "HUMAN_REVIEW",
    why: "a deviation from the session's own baseline is evidence, not proof",
  },

  // ── Deliberately left to the score bands ──
  //   A bare PROMPT_INJECTION resolves to REWRITE, which policy.ts then reads as the
  //   tenant's `bareInjectionHandling` choice; giving it a HUMAN_REVIEW floor here
  //   would take that choice away and hold every "ignore the above" phrasing. A bare
  //   JAILBREAK (weight 35) resolves the same way for the same reason: raising it is
  //   a precision decision that needs corpus evidence, not a table edit. Both are
  //   still escalated by the co-signal combinations and by non-USER provenance.
  PROMPT_INJECTION: {
    floor: "ALLOW",
    instructionBearing: true,
    why: "bare override: REWRITE via the score band, so the tenant policy decides",
  },
  JAILBREAK: {
    floor: "ALLOW",
    instructionBearing: true,
    why: "bare guardrail probe: REWRITE via the score band, escalated by co-signals",
  },
};

/**
 * Signals that mean more together than apart. Kept as data rather than nested ifs so
 * the diff harness can enumerate them and so adding one cannot reorder the others.
 */
const COMBINATIONS: Array<{ all: RiskType[]; action: GuardAction; why: string }> = [
  {
    all: ["PROMPT_INJECTION", "JAILBREAK"],
    action: "BLOCK",
    why: "an override plus a guardrail bypass is deliberate, not ambiguous phrasing",
  },
  {
    all: ["RECURSIVE_INJECTION", "PROMPT_INJECTION"],
    action: "BLOCK",
    why: "rewriting a self-replanting override just moves it",
  },
];

/** Signals that make the 61-85 band a refusal rather than a hold. */
const COERCIVE: RiskType[] = ["PROMPT_INJECTION", "JAILBREAK"];

/**
 * The aggregate-score bands, unchanged from the old engine: >=86 refuse, 61-85 refuse
 * if the payload is coercive and hold otherwise, 31-60 rewrite. They are the floor of
 * last resort — a signal table entry can raise the outcome but never lower it.
 */
function scoreBand(
  riskScore: number,
  present: ReadonlySet<RiskType>,
): { action: GuardAction; why: string } | null {
  if (riskScore >= 86) return { action: "BLOCK", why: `aggregate score ${riskScore} >= 86` };
  if (riskScore >= 61) {
    const coercive = COERCIVE.some((type) => present.has(type));
    return coercive
      ? { action: "BLOCK", why: `score ${riskScore} in 61-85 with a coercive signal` }
      : { action: "HUMAN_REVIEW", why: `score ${riskScore} in 61-85` };
  }
  if (riskScore >= 31) return { action: "REWRITE", why: `score ${riskScore} in 31-60` };
  return null;
}

export interface DecisionContribution {
  source: "signal" | "combination" | "score-band";
  /** The risk type, the combination, or the band that produced this floor. */
  detail: string;
  action: GuardAction;
  why: string;
}

export interface GuardDecision {
  action: GuardAction;
  /** The contribution that set the final action, for the audit trail. */
  decidedBy: string;
  /** Every floor that applied, strongest first. */
  contributions: DecisionContribution[];
  provenance: ContentProvenance;
}

/**
 * Decide, and say why. `decideGuardAction` is this function with the explanation
 * dropped; prefer this one wherever the reason is recorded or shown.
 */
export function explainGuardDecision(
  riskScore: number,
  riskTypes: RiskType[],
  direction: GuardDirection,
  context: DecisionContext = {},
): GuardDecision {
  const present: ReadonlySet<RiskType> = new Set(riskTypes);
  const provenance = context.provenance ?? "USER";
  const indirect = provenance !== "USER";
  const leaving = direction === "OUTPUT";
  const contributions: DecisionContribution[] = [];

  for (const type of present) {
    const rule = SIGNALS[type];
    if (!rule) continue;
    let action = leaving && rule.outputFloor ? rule.outputFloor : rule.floor;
    let why = rule.why;
    if (rule.hardFloor && typeof rule.hardAtScore === "number" && riskScore >= rule.hardAtScore) {
      const raised = strongestAction(action, rule.hardFloor);
      if (raised !== action) {
        action = raised;
        why = `${rule.why} (score ${riskScore} >= ${rule.hardAtScore})`;
      }
    }
    if (indirect && rule.instructionBearing) {
      const raised = strongestAction(action, "HUMAN_REVIEW");
      if (raised !== action) {
        action = raised;
        why = `an instruction arriving as ${provenance} carries nobody's authority, so it is held rather than rewritten`;
      }
    }
    if (action === "ALLOW") continue;
    contributions.push({ source: "signal", detail: type, action, why });
  }

  for (const combo of COMBINATIONS) {
    if (combo.all.every((type) => present.has(type))) {
      contributions.push({
        source: "combination",
        detail: combo.all.join(" + "),
        action: combo.action,
        why: combo.why,
      });
    }
  }

  const band = scoreBand(riskScore, present);
  if (band) {
    contributions.push({ source: "score-band", detail: "aggregate", action: band.action, why: band.why });
  }

  contributions.sort((a, b) => ACTION_RANK[b.action] - ACTION_RANK[a.action]);
  const winner = contributions[0];
  return {
    action: winner?.action ?? "ALLOW",
    decidedBy: winner ? `${winner.source}:${winner.detail}` : "no signal above the allow threshold",
    contributions,
    provenance,
  };
}

/**
 * The action alone. Signature is unchanged from the if-else engine so every existing
 * caller keeps compiling; the optional 4th argument used to be an ignored `text`.
 */
export function decideGuardAction(
  riskScore: number,
  riskTypes: RiskType[],
  direction: GuardDirection,
  context?: DecisionContext,
): GuardAction {
  return explainGuardDecision(riskScore, riskTypes, direction, context).action;
}

