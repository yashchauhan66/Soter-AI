import { createHash } from "crypto";
import { getRedis } from "../redis";
import type { GuardFinding, GuardResult, RiskType } from "./types";

/**
 * Attacker fingerprinting — per-API-key / per-IP adaptive risk escalation.
 *
 * The stateless guard scores every request on its own merits. A determined
 * attacker, however, does not send one request: they probe repeatedly, tuning
 * a payload until something slips through. This module gives the guard an
 * "abuse memory" keyed by a fingerprint of the calling API key + client IP, so
 * that a caller who has repeatedly tripped the guard is treated more strictly
 * on their *next* borderline request — the same way a WAF escalates on a source
 * that keeps attacking.
 *
 * Design constraints:
 *  - Fail open. Any storage error leaves the per-request decision untouched;
 *    reputation must never add availability risk to the guard path.
 *  - No collateral damage on legitimate traffic. Escalation only ever tightens
 *    *already-risky* turns (or hard-blocks a fully "banned" fingerprint). A
 *    benign request from a previously-abusive key still passes, so a shared /
 *    NATed key is not bricked for one bad actor behind it.
 *  - Decay. Counters fade after a period of good behaviour so a fingerprint can
 *    recover; the window also expires entirely after inactivity.
 */

const WINDOW_TTL_SECONDS = 60 * 60; // fingerprint memory horizon
const DECAY_AFTER_MS = 15 * 60 * 1000; // idle gap that triggers counter decay
const DECAY_FACTOR = 0.5; // how much of the old counters survive a decay step

const SUSPECT_THRESHOLD = 30;
const ABUSIVE_THRESHOLD = 60;
const BANNED_THRESHOLD = 85;

// A turn only escalates under ABUSIVE reputation when it is itself non-trivial,
// so genuinely benign requests interleaved with an attack still flow.
const ESCALATION_MIN_RISK = 25;

const SECURITY_RISK_TYPES = new Set<RiskType>([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "SYSTEM_PROMPT_LEAKAGE",
]);

export type AttackerLevel = "NONE" | "SUSPECT" | "ABUSIVE" | "BANNED";

export interface AttackerHistory {
  attempts: number; // total requests recorded in the window
  blocks: number; // BLOCK decisions
  reviews: number; // HUMAN_REVIEW decisions
  securityHits: number; // turns carrying an injection / jailbreak / leak risk type
  crescendo: number; // Crescendo ESCALATED events attributed to this fingerprint
  maxRiskScore: number; // worst single-turn risk score seen
  firstAt: number;
  lastAt: number;
}

export interface AttackerReputation {
  level: AttackerLevel;
  score: number; // 0-100 abuse pressure
  signals: string[];
  history: AttackerHistory;
}

export interface AttackerObservation {
  action: GuardResult["action"];
  riskScore: number;
  riskTypes: RiskType[];
  crescendoEscalated?: boolean;
}

/**
 * Stable, non-reversible fingerprint for a caller. The API key id is the primary
 * abuse identity; the client IP disambiguates shared keys. Hashed so raw IPs are
 * never used as storage keys.
 */
export function attackerFingerprint(input: { apiKeyId?: string | null; clientIp?: string | null }): string {
  const material = `${input.apiKeyId ?? "nokey"}|${input.clientIp ?? "noip"}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

function emptyHistory(now: number): AttackerHistory {
  return { attempts: 0, blocks: 0, reviews: 0, securityHits: 0, crescendo: 0, maxRiskScore: 0, firstAt: now, lastAt: now };
}

function isValidHistory(value: unknown): value is AttackerHistory {
  if (!value || typeof value !== "object") return false;
  const h = value as Partial<AttackerHistory>;
  return (
    typeof h.attempts === "number" &&
    typeof h.blocks === "number" &&
    typeof h.reviews === "number" &&
    typeof h.securityHits === "number" &&
    typeof h.crescendo === "number" &&
    typeof h.maxRiskScore === "number" &&
    typeof h.firstAt === "number" &&
    typeof h.lastAt === "number"
  );
}

function decayHistory(history: AttackerHistory, now: number): AttackerHistory {
  // A quiet period lets an abusive fingerprint cool down: one decay step per
  // idle interval, applied multiplicatively so long gaps forgive faster.
  const idle = now - history.lastAt;
  if (idle < DECAY_AFTER_MS) return history;
  const steps = Math.min(6, Math.floor(idle / DECAY_AFTER_MS));
  const factor = DECAY_FACTOR ** steps;
  return {
    ...history,
    attempts: Math.floor(history.attempts * factor),
    blocks: Math.floor(history.blocks * factor),
    reviews: Math.floor(history.reviews * factor),
    securityHits: Math.floor(history.securityHits * factor),
    crescendo: Math.floor(history.crescendo * factor),
    maxRiskScore: Math.floor(history.maxRiskScore * factor),
  };
}

/** Fold a new observation into the running history. */
export function applyObservation(
  history: AttackerHistory,
  observation: AttackerObservation,
  now: number,
): AttackerHistory {
  const next: AttackerHistory = { ...history };
  next.attempts += 1;
  if (observation.action === "BLOCK") next.blocks += 1;
  if (observation.action === "HUMAN_REVIEW") next.reviews += 1;
  if (observation.riskTypes.some((type) => SECURITY_RISK_TYPES.has(type))) next.securityHits += 1;
  if (observation.crescendoEscalated) next.crescendo += 1;
  next.maxRiskScore = Math.max(next.maxRiskScore, observation.riskScore);
  next.lastAt = now;
  return next;
}

/**
 * Pure reputation scoring over a fingerprint's history. Deterministic and
 * storage-free so it is exhaustively unit-testable.
 */
export function assessAttackerReputation(history: AttackerHistory): AttackerReputation {
  const signals: string[] = [];
  let score = 0;

  if (history.blocks > 0) {
    score += Math.min(50, history.blocks * 15);
    signals.push(`repeated-blocks:${history.blocks}`);
  }
  if (history.securityHits > 0) {
    score += Math.min(30, history.securityHits * 8);
    signals.push(`security-probes:${history.securityHits}`);
  }
  if (history.reviews > 0) {
    score += Math.min(15, history.reviews * 5);
    signals.push(`held-for-review:${history.reviews}`);
  }
  if (history.crescendo > 0) {
    score += Math.min(25, history.crescendo * 20);
    signals.push(`crescendo-escalations:${history.crescendo}`);
  }

  const blockRatio = history.attempts > 0 ? history.blocks / history.attempts : 0;
  if (history.attempts >= 5 && blockRatio >= 0.5) {
    score += 15;
    signals.push(`high-block-ratio:${Math.round(blockRatio * 100)}%`);
  }

  score = Math.min(100, score);
  const level: AttackerLevel =
    score >= BANNED_THRESHOLD
      ? "BANNED"
      : score >= ABUSIVE_THRESHOLD
        ? "ABUSIVE"
        : score >= SUSPECT_THRESHOLD
          ? "SUSPECT"
          : "NONE";

  return { level, score, signals, history };
}

/**
 * Applies a fingerprint's reputation to the current per-turn result.
 *
 *  - NONE     → unchanged.
 *  - SUSPECT  → decision unchanged; reputation attached to metadata for logging.
 *  - ABUSIVE  → tightens *risky* turns: HUMAN_REVIEW is promoted to BLOCK, and a
 *               risky ALLOW/REWRITE/REDACTION turn (risk ≥ threshold or carrying
 *               a security risk type) is blocked. A fully benign turn still
 *               passes so legitimate interleaved traffic is not punished.
 *  - BANNED   → hard BLOCK regardless of this turn's content: the fingerprint
 *               has established itself as an active attacker for the window.
 */
export function applyAttackerReputation(result: GuardResult, reputation: AttackerReputation): GuardResult {
  if (reputation.level === "NONE") return result;

  const metadata = {
    ...result.metadata,
    attacker: {
      level: reputation.level,
      score: reputation.score,
      signals: reputation.signals,
    },
  };

  if (reputation.level === "SUSPECT") return { ...result, metadata };

  const carriesSecurityRisk = result.riskTypes.some((type) => SECURITY_RISK_TYPES.has(type));

  if (reputation.level === "ABUSIVE") {
    const risky =
      result.action === "HUMAN_REVIEW" ||
      ((result.action === "REWRITE" || result.action === "ALLOW_WITH_REDACTION") &&
        (carriesSecurityRisk || result.riskScore >= ESCALATION_MIN_RISK)) ||
      (result.action === "ALLOW" && carriesSecurityRisk);
    if (!risky) return { ...result, metadata };
    return blockForReputation(result, reputation, metadata, "abusive");
  }

  // BANNED
  return blockForReputation(result, reputation, metadata, "banned");
}

function blockForReputation(
  result: GuardResult,
  reputation: AttackerReputation,
  metadata: Record<string, unknown>,
  mode: "abusive" | "banned",
): GuardResult {
  const finding: GuardFinding = {
    type: "RATE_LIMIT",
    label: "Adaptive abuse escalation",
    severity: "HIGH",
    score: 80,
    message:
      mode === "banned"
        ? `Fingerprint blocked: sustained abusive behaviour (reputation ${reputation.score}/100; ${reputation.signals.join(", ")}).`
        : `Request blocked under elevated abuse reputation (${reputation.score}/100; ${reputation.signals.join(", ")}).`,
  };
  return {
    ...result,
    allowed: false,
    action: "BLOCK",
    riskScore: Math.max(result.riskScore, 80),
    riskTypes: result.riskTypes.includes("RATE_LIMIT")
      ? result.riskTypes
      : [...result.riskTypes.filter((type) => type !== "LOW_RISK"), "RATE_LIMIT"],
    reason:
      mode === "banned"
        ? "Blocked: this API key/IP has been flagged for repeated attack attempts. Access is temporarily restricted."
        : "Blocked: borderline request rejected because this API key/IP is currently in an elevated-abuse state.",
    findings: [...result.findings, finding],
    metadata,
  };
}

/**
 * Records the current observation against the fingerprint's rolling window and
 * returns the resulting reputation. Fails open (returns a NONE reputation) on
 * any storage error so the guard path is never coupled to reputation storage.
 */
export async function recordAndAssessAttacker(input: {
  projectId: string;
  fingerprint: string;
  observation: AttackerObservation;
  now?: number;
}): Promise<AttackerReputation> {
  const now = input.now ?? Date.now();
  const key = `attacker:${input.projectId}:${input.fingerprint}`;
  const redis = getRedis();

  let history = emptyHistory(now);
  try {
    const stored = await redis.get<unknown>(key);
    if (stored) {
      const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
      if (isValidHistory(parsed)) history = decayHistory(parsed, now);
    }
  } catch {
    // Corrupted / unreadable state is discarded, never trusted.
  }

  history = applyObservation(history, input.observation, now);

  try {
    await redis.set(key, JSON.stringify(history), { ex: WINDOW_TTL_SECONDS });
  } catch {
    // Fail open: losing one update must not fail the request.
  }

  return assessAttackerReputation(history);
}
