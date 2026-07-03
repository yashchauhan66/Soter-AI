import { getRedis } from "../redis";
import type { GuardFinding, GuardResult, RiskType } from "./types";

/**
 * Crescendo multi-turn escalation detection.
 *
 * Crescendo-style attacks avoid single-turn detection by spreading an attack
 * across a conversation: each turn looks mildly risky (or entirely benign)
 * on its own, but the session as a whole steadily escalates toward a bypass.
 *
 * This module adds session-level "adversarial memory" on top of the stateless
 * per-turn guard:
 *  1. Sub-threshold accumulation — repeated gray-zone turns that individually
 *     stay below the block threshold.
 *  2. Monotonic escalation — risk scores trending upward across recent turns.
 *  3. Repeat probing — multiple turns carrying injection / jailbreak / leak
 *     risk types within the window (a signature of iterative attack tuning).
 *  4. Scaffold continuity — "as we discussed / now go deeper" continuity
 *     phrasing after earlier risky turns (the core Crescendo technique).
 *
 * State is a small rolling window in Redis (falls back to in-memory), keyed
 * by project + session, and expires after 30 minutes of inactivity. The
 * tracker fails open: any storage error leaves the per-turn decision intact.
 */

const WINDOW_MAX_TURNS = 12;
const SESSION_TTL_SECONDS = 30 * 60;
const GRAY_ZONE_MIN = 15;
const ESCALATED_THRESHOLD = 60;
const WATCH_THRESHOLD = 30;

const SECURITY_RISK_TYPES = new Set<RiskType>([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
]);

export interface CrescendoTurn {
  at: number;
  riskScore: number;
  securityRisk: boolean;
  scaffold: boolean;
}

export interface CrescendoAssessment {
  level: "NONE" | "WATCH" | "ESCALATED";
  pressureScore: number;
  signals: string[];
}

/** Continuity phrasing used to chain turns together during a Crescendo attack. */
export const CRESCENDO_SCAFFOLD_PATTERN =
  /(?:as (?:we|you) (?:discussed|established|agreed|covered)|building on (?:that|your last|the last|what you)|now that (?:we|you)'?v?e? (?:established|covered|agreed|explained)|earlier you (?:said|explained|mentioned|described)|like you (?:said|explained) before|go (?:a bit |even )?(?:deeper|further)|(?:more|extra) (?:detail|specifics?) (?:about|on) (?:that|what you)|next logical step|continue from (?:where|your previous)|expand on (?:that|your previous))/i;

export function detectCrescendoScaffold(text: string) {
  return CRESCENDO_SCAFFOLD_PATTERN.test(text);
}

/**
 * Pure escalation scoring over the session's rolling turn window.
 * Deterministic and storage-free so it can be exhaustively unit-tested.
 */
export function assessCrescendo(turns: CrescendoTurn[]): CrescendoAssessment {
  const signals: string[] = [];
  let pressure = 0;
  if (turns.length < 2) return { level: "NONE", pressureScore: 0, signals };

  // 1. Sub-threshold accumulation: several gray-zone turns in one session.
  const grayTurns = turns.filter((turn) => turn.riskScore >= GRAY_ZONE_MIN).length;
  if (grayTurns >= 3) {
    pressure += 25 + Math.min(15, (grayTurns - 3) * 5);
    signals.push(`sub-threshold-accumulation:${grayTurns}`);
  }

  // 2. Monotonic escalation across the most recent turns.
  const recent = turns.slice(-4);
  if (recent.length >= 3) {
    const scores = recent.map((turn) => turn.riskScore);
    const rising = scores.every((score, index) => index === 0 || score >= scores[index - 1]);
    const rise = scores[scores.length - 1] - scores[0];
    if (rising && rise >= 20 && scores[scores.length - 1] >= GRAY_ZONE_MIN) {
      pressure += 30;
      signals.push(`monotonic-escalation:+${rise}`);
    }
  }

  // 3. Repeat probing: several turns carrying security risk types.
  const probes = turns.filter((turn) => turn.securityRisk).length;
  if (probes >= 2) {
    pressure += 25 + Math.min(15, (probes - 2) * 5);
    signals.push(`repeat-probing:${probes}`);
  }

  // 4. Scaffold continuity phrasing after earlier risky turns.
  const last = turns[turns.length - 1];
  const priorRisky = turns
    .slice(0, -1)
    .some((turn) => turn.securityRisk || turn.riskScore >= GRAY_ZONE_MIN);
  if (last.scaffold && priorRisky) {
    pressure += 20;
    signals.push("scaffold-continuity");
  }

  const pressureScore = Math.min(100, pressure);
  const level =
    pressureScore >= ESCALATED_THRESHOLD ? "ESCALATED" : pressureScore >= WATCH_THRESHOLD ? "WATCH" : "NONE";
  return { level, pressureScore, signals };
}

function isValidTurn(value: unknown): value is CrescendoTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Partial<CrescendoTurn>;
  return (
    typeof turn.at === "number" &&
    typeof turn.riskScore === "number" &&
    typeof turn.securityRisk === "boolean" &&
    typeof turn.scaffold === "boolean"
  );
}

/**
 * Records the current turn in the session window and returns the escalation
 * assessment. Fails open on any storage error so guard latency and
 * availability are never impacted by session-state issues.
 */
export async function trackCrescendo(input: {
  projectId: string;
  sessionId: string;
  message: string;
  result: GuardResult;
  now?: number;
}): Promise<CrescendoAssessment> {
  const key = `crescendo:${input.projectId}:${input.sessionId}`;
  const redis = getRedis();
  const turn: CrescendoTurn = {
    at: input.now ?? Date.now(),
    riskScore: input.result.riskScore,
    securityRisk: input.result.riskTypes.some((type) => SECURITY_RISK_TYPES.has(type)),
    scaffold: detectCrescendoScaffold(input.message),
  };

  let turns: CrescendoTurn[] = [];
  try {
    const stored = await redis.get<unknown>(key);
    if (stored) {
      const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
      if (Array.isArray(parsed)) turns = parsed.filter(isValidTurn);
    }
  } catch {
    // Corrupted or unreadable session state is discarded, never trusted.
  }

  turns.push(turn);
  if (turns.length > WINDOW_MAX_TURNS) turns = turns.slice(-WINDOW_MAX_TURNS);
  const assessment = assessCrescendo(turns);
  try {
    await redis.set(key, JSON.stringify(turns), { ex: SESSION_TTL_SECONDS });
  } catch {
    // Fail open: losing one turn of state must not fail the request.
  }
  return assessment;
}

/**
 * Applies a Crescendo assessment to a per-turn guard result:
 * - NONE  → unchanged.
 * - WATCH → unchanged decision, assessment attached to metadata for logging.
 * - ESCALATED → hard BLOCK with an explanatory finding, regardless of how
 *   benign the individual turn looks (the session itself is adversarial).
 */
export function applyCrescendoAssessment(result: GuardResult, assessment: CrescendoAssessment): GuardResult {
  if (assessment.level === "NONE") return result;
  const metadata = {
    ...result.metadata,
    crescendo: {
      level: assessment.level,
      pressureScore: assessment.pressureScore,
      signals: assessment.signals,
    },
  };
  if (assessment.level === "WATCH") return { ...result, metadata };

  const finding: GuardFinding = {
    type: "JAILBREAK",
    label: "Crescendo multi-turn escalation",
    severity: "HIGH",
    score: 75,
    message: `Session escalation pressure ${assessment.pressureScore}/100 (${assessment.signals.join(", ")}).`,
  };
  return {
    ...result,
    allowed: false,
    action: "BLOCK",
    riskScore: Math.max(result.riskScore, 75),
    riskTypes: result.riskTypes.includes("JAILBREAK")
      ? result.riskTypes
      : [...result.riskTypes.filter((type) => type !== "LOW_RISK"), "JAILBREAK"],
    reason: "Blocked: gradual multi-turn escalation (Crescendo pattern) detected across this session.",
    findings: [...result.findings, finding],
    metadata,
  };
}
