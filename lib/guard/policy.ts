// SECURITY: Per-project policy resolution + application.
// Policies are loaded from ProjectPolicy. Defaults match Phase 1/2 behaviour
// when no policy row exists, so legacy projects keep working unchanged.
//
// Policy is applied as a post-detector transform: detectors still run with
// the same regex set (we don't disable them entirely), but findings of types
// the policy excludes are filtered out, and the action is recomputed against
// the policy mode + thresholds.

import type { ProjectPolicy, PolicyMode, UnsafeOutputMode } from "@prisma/client";
import { db } from "../db";
import { getLocalCache, setLocalCache } from "../localCache";
import { getRedis } from "../redis";
import { decideGuardAction } from "./decisionEngine";
import { redactText } from "./redactor";
import { rewriteRiskyText } from "./rewrite";
import { scoreRisk } from "./riskScoring";
import type { GuardDirection, GuardFinding, GuardResult, RiskType } from "./types";

export interface ResolvedPolicy {
  mode: PolicyMode;
  blockPromptInjection: boolean;
  blockJailbreak: boolean;
  redactPII: boolean;
  redactIndiaPII: boolean;
  blockSecrets: boolean;
  blockSystemPromptLeak: boolean;
  unsafeOutputMode: UnsafeOutputMode;
  customBlockedTopics: string[];
  allowlistedDomains: string[];
  deniedPatterns: string[];
  customFallbackMessage: string | null;
  riskThresholds: Record<string, number> | null;
  citationRequired: boolean;
  noSourceFallback: string | null;
  highRiskTopicReview: boolean;
  minSourceCount: number;
  requireSourceUrls: boolean;
}

export const DEFAULT_POLICY: ResolvedPolicy = {
  mode: "BALANCED",
  blockPromptInjection: true,
  blockJailbreak: true,
  redactPII: true,
  redactIndiaPII: true,
  blockSecrets: true,
  blockSystemPromptLeak: true,
  unsafeOutputMode: "BLOCK",
  customBlockedTopics: [],
  allowlistedDomains: [],
  deniedPatterns: [],
  customFallbackMessage: null,
  riskThresholds: null,
  citationRequired: false,
  noSourceFallback: null,
  highRiskTopicReview: true,
  minSourceCount: 1,
  requireSourceUrls: false,
};

export function policyFromRow(row: ProjectPolicy | null): ResolvedPolicy {
  if (!row) return DEFAULT_POLICY;
  return {
    mode: row.mode,
    blockPromptInjection: row.blockPromptInjection,
    blockJailbreak: row.blockJailbreak,
    redactPII: row.redactPII,
    redactIndiaPII: row.redactIndiaPII,
    blockSecrets: row.blockSecrets,
    blockSystemPromptLeak: row.blockSystemPromptLeak,
    unsafeOutputMode: row.unsafeOutputMode,
    customBlockedTopics: row.customBlockedTopics ?? [],
    allowlistedDomains: row.allowlistedDomains ?? [],
    deniedPatterns: row.deniedPatterns ?? [],
    customFallbackMessage: row.customFallbackMessage,
    riskThresholds: (row.riskThresholds as Record<string, number> | null) ?? null,
    citationRequired: row.citationRequired,
    noSourceFallback: row.noSourceFallback,
    highRiskTopicReview: row.highRiskTopicReview,
    minSourceCount: row.minSourceCount,
    requireSourceUrls: row.requireSourceUrls,
  };
}

/** Redis key prefix for project policy cache. */
const POLICY_REDIS_KEY_PREFIX = "crg:policy:";

/** TTL for cached policies in seconds (5 seconds — short enough for multi-instance propagation). */
const POLICY_REDIS_TTL_S = 5;

/** TTL for local in-process cache in ms (also 5s to stay in sync with Redis). */
const POLICY_LOCAL_TTL_MS = 5_000;

async function loadPolicyFromRedis(projectId: string): Promise<ResolvedPolicy | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(`${POLICY_REDIS_KEY_PREFIX}${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ResolvedPolicy;
  } catch (error) {
    console.error("[SoterAI] Policy cache read error:", error);
    return null;
  }
}

async function savePolicyToRedis(projectId: string, policy: ResolvedPolicy): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(`${POLICY_REDIS_KEY_PREFIX}${projectId}`, JSON.stringify(policy), { ex: POLICY_REDIS_TTL_S });
  } catch (error) {
    console.error("[SoterAI] Policy cache write error:", error);
  }
}

export async function loadProjectPolicy(projectId: string): Promise<ResolvedPolicy> {
  const localKey = `project-policy:${projectId}`;

  // 1. Try local in-process cache first (fastest).
  const localCached = getLocalCache<ResolvedPolicy>(localKey);
  if (localCached) return localCached;

  // 2. Try Redis (shared across instances).
  const redisCached = await loadPolicyFromRedis(projectId);
  if (redisCached) {
    // Warm the local cache so subsequent requests in this process are instant.
    setLocalCache(localKey, redisCached, POLICY_LOCAL_TTL_MS);
    return redisCached;
  }

  // 3. Fall back to database.
  const row = await db.projectPolicy.findUnique({ where: { projectId } });
  const policy = policyFromRow(row);

  // 4. Warm both caches so the next request (in any process) is fast.
  setLocalCache(localKey, policy, POLICY_LOCAL_TTL_MS);
  await savePolicyToRedis(projectId, policy);

  return policy;
}

function customTopicMatches(text: string, topic: string) {
  const lower = text.toLowerCase();
  return lower.includes(topic.toLowerCase());
}

function customRegexMatches(text: string, pattern: string) {
  try {
    const regex = new RegExp(pattern, "i");
    return regex.test(text);
  } catch {
    return false;
  }
}

/**
 * Check if a URL in text contains an allowlisted domain.
 * Used to suppress findings for URLs that match the project's allowlist.
 */
function urlMatchesAllowlistedDomain(text: string, allowlistedDomains: string[]): boolean {
  if (allowlistedDomains.length === 0) return false;
  const urlRe = /https?:\/\/[^\s'"<>)]+/gi;
  for (const match of text.matchAll(urlRe)) {
    try {
      const hostname = new URL(match[0]).hostname.toLowerCase();
      for (const domain of allowlistedDomains) {
        const d = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
        if (hostname === d || hostname.endsWith("." + d)) return true;
      }
    } catch {
      // Malformed URL; skip
    }
  }
  return false;
}

/**
 * Detect whether a pattern looks like a plain domain name (no regex special chars).
 * If so, auto-wrap it as a URL-matching pattern so users can enter plain domain
 * names like "evil.com" without regex escaping.
 */
function isPlainDomainPattern(pattern: string): boolean {
  // Allow dots, hyphens, alphanumeric, and colons (for ports)
  return /^[a-zA-Z0-9._:-]+$/.test(pattern) && pattern.includes(".");
}

function wrapDomainAsUrlPattern(domain: string): string {
  // Escape dots for regex
  const escaped = domain.replace(/\./g, "\\.");
  return `https?:\\/\\/(?:[^\\s\\/]+\\.)?${escaped}\\b`;
}

/**
 * Wrap baseline analysis with project policy. Mutates findings/decisions
 * so the resulting GuardResult honours the project's settings.
 */
export function applyPolicy(
  text: string,
  baseline: GuardResult,
  policy: ResolvedPolicy,
  direction: GuardDirection,
): GuardResult {
  const filtered: GuardFinding[] = [];
  for (const finding of baseline.findings) {
    if (finding.type === "PROMPT_INJECTION" && !policy.blockPromptInjection) continue;
    if (finding.type === "JAILBREAK" && !policy.blockJailbreak) continue;
    if (finding.type === "PII_DETECTED" && !policy.redactPII) continue;
    if (finding.type === "INDIA_PII_DETECTED" && !policy.redactIndiaPII) continue;
    if (finding.type === "SECRET_DETECTED" && !policy.blockSecrets) continue;
    if ((finding.type === "SYSTEM_PROMPT_LEAK_ATTEMPT" || finding.type === "SYSTEM_PROMPT_LEAKAGE") && !policy.blockSystemPromptLeak) continue;
    filtered.push(finding);
  }

  // Custom denied patterns + blocked topics produce synthetic findings.
  // Score 65 so a single match crosses the 61 BLOCK threshold in the decision
  // engine: users explicitly opting in to a denylist expect a hard block.
  for (const topic of policy.customBlockedTopics) {
    if (!topic.trim()) continue;
    if (customTopicMatches(text, topic)) {
      filtered.push({
        type: direction === "OUTPUT" ? "UNSAFE_OUTPUT" : "PROMPT_INJECTION",
        label: `Custom blocked topic: ${topic.slice(0, 40)}`,
        severity: "HIGH",
        score: 65,
        message: `Project policy blocks the topic "${topic.slice(0, 40)}".`,
      });
    }
  }
  for (const pattern of policy.deniedPatterns) {
    if (!pattern.trim()) continue;
    // Auto-convert plain domain names to URL-matching patterns
    const resolvedPattern = isPlainDomainPattern(pattern) ? wrapDomainAsUrlPattern(pattern) : pattern;
    if (customRegexMatches(text, resolvedPattern)) {
      filtered.push({
        type: direction === "OUTPUT" ? "UNSAFE_OUTPUT" : "PROMPT_INJECTION",
        label: `Custom denylist pattern`,
        severity: "HIGH",
        score: 65,
        message: `Project policy denylist pattern matched: ${pattern.slice(0, 60)}.`,
      });
    }
  }

  // Allowlisted domains: suppress findings if the text contains URLs with allowlisted domains.
  // This lets users whitelist specific URLs/domains that they know are safe, even if the
  // automated detectors flagged them.
  if (policy.allowlistedDomains.length > 0 && urlMatchesAllowlistedDomain(text, policy.allowlistedDomains)) {
    // Remove any spam URL / promotional URL findings (they came from detectors, not custom rules)
    const filteredAllowlist: GuardFinding[] = [];
    for (const finding of filtered) {
      // Keep synthetic custom findings (user explicitly denied them)
      if (finding.label.startsWith("Custom blocked topic") || finding.label.startsWith("Custom denylist")) {
        filteredAllowlist.push(finding);
      } else if (finding.type === "UNSAFE_OUTPUT" && (
        finding.label.includes("URL") ||
        finding.label.includes("link") ||
        finding.label.includes("Spam") ||
        finding.label.includes("scam")
      )) {
        continue; // skip URL-related findings for allowlisted domains
      } else {
        filteredAllowlist.push(finding);
      }
    }
    // Only replace if we actually removed something
    if (filteredAllowlist.length < filtered.length) {
      // Replace filtered with the reduced list
      filtered.length = 0;
      filtered.push(...filteredAllowlist);
    }
  }

  const riskScore = scoreRisk(filtered);
  const riskTypes = ([...new Set(filtered.map((finding) => finding.type))] as RiskType[]);
  if (riskTypes.length === 0) riskTypes.push("LOW_RISK");

  // A custom denylist or topic match short-circuits to BLOCK regardless of
  // mode. Users opting into a denylist expect a hard block; anything softer
  // would silently leak the matched content.
  const customMatched = filtered.some((finding) => finding.label.startsWith("Custom blocked topic") || finding.label.startsWith("Custom denylist"));

  // Mode-aware decision:
  // - MONITOR: cap action at HUMAN_REVIEW unless secrets are present.
  // - STRICT: promote any HUMAN_REVIEW to BLOCK.
  // - WARN: downgrade BLOCK to ALLOW and replace content with a warning message.
  // - BALANCED: default decision engine.
  let action = decideGuardAction(riskScore, riskTypes, direction);
  const mode = policy.mode as string;
  if (customMatched) {
    action = "BLOCK";
  } else if (mode === "WARN" && action === "BLOCK" && !riskTypes.includes("SECRET_DETECTED")) {
    action = "ALLOW";
  } else if (mode === "MONITOR" && action === "BLOCK" && !riskTypes.includes("SECRET_DETECTED")) {
    action = "HUMAN_REVIEW";
  } else if (mode === "STRICT" && (action === "ALLOW_WITH_REDACTION" || action === "REWRITE")) {
    if (riskScore >= 50) action = "BLOCK";
  }

  // Unsafe output mode override.
  // SECURITY: a custom denylist/topic match is an explicit hard BLOCK opted into
  // by the project; it must NOT be downgraded by a softer unsafeOutputMode.
  // Without the `!customMatched` guard, a WARN/REDACT mode would silently turn a
  // denylist BLOCK into ALLOW/ALLOW_WITH_REDACTION and leak the matched content.
  if (direction === "OUTPUT" && riskTypes.includes("UNSAFE_OUTPUT") && !customMatched) {
    if (policy.unsafeOutputMode === "WARN") action = "ALLOW";
    else if (policy.unsafeOutputMode === "REDACT") action = "ALLOW_WITH_REDACTION";
    else action = "BLOCK";
  }

  const redactedText = redactText(text, filtered);
  const changed = redactedText !== text;
  const isWarnMode = mode === "WARN";
  const reasonLabels = [...new Set(filtered.map((f) => f.label))].slice(0, 3).join(", ") || "policy decision";
  const allowed = action === "ALLOW" || action === "ALLOW_WITH_REDACTION" || action === "REWRITE";
  const safeText = isWarnMode && action === "ALLOW" && riskTypes.length > 0 && !riskTypes.includes("LOW_RISK")
    ? buildWarnMessage(riskTypes, reasonLabels, policy.customFallbackMessage)
    : action === "REWRITE"
      ? rewriteRiskyText(text, filtered)
      : changed
        ? redactedText
        : text;
  let reason: string;
  if (isWarnMode && action === "ALLOW" && riskTypes.length > 0 && !riskTypes.includes("LOW_RISK")) {
    reason = policy.customFallbackMessage ?? `Warning: ${reasonLabels} detected. Request allowed with warning.`;
  } else  if (action === "BLOCK") {
    reason = policy.customFallbackMessage ?? `⚠️ Security Warning: Your message was blocked because it contains potentially harmful content (${reasonLabels}). Please rephrase your request.`;
  } else if (action === "HUMAN_REVIEW") {
    reason = `Held for human review: ${reasonLabels}.`;
  } else if (action === "ALLOW_WITH_REDACTION") {
    reason = `Allowed with redaction: ${reasonLabels}.`;
  } else if (action === "REWRITE") {
    reason = `Risky instruction text was rewritten: ${reasonLabels}.`;
  } else {
    reason = filtered.length ? `Allowed under policy mode ${policy.mode}.` : "No material risk patterns detected.";
  }

  return {
    allowed,
    action: isWarnMode && action === "ALLOW" && riskTypes.length > 0 && !riskTypes.includes("LOW_RISK") ? "ALLOW" : action,
    riskScore,
    riskTypes,
    originalText: text,
    redactedText: changed ? redactedText : undefined,
    safeText: allowed ? safeText : action === "BLOCK" ? (policy.customFallbackMessage ?? reason) : undefined,
    reason,
    findings: filtered,
    metadata: {
      ...baseline.metadata,
      direction,
      findingCount: filtered.length,
      policyMode: isWarnMode ? "WARN" : policy.mode,
    },
  };
}

function buildWarnMessage(riskTypes: string[], reasonLabels: string, customFallbackMessage: string | null): string {
  if (customFallbackMessage) return `⚠️ ${customFallbackMessage}`;
  const riskLabelList = [...new Set(riskTypes.map((r) => r.replace(/_/g, " ").toLowerCase()))].join(", ");
  return `⚠️ Security Warning: Your message was flagged as a potential security threat (${riskLabelList}). Please rephrase your request.`;
}
