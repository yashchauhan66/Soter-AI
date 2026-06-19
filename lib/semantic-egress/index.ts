import { createHash, randomUUID } from "crypto";
import { analyzeText } from "@/lib/guard/analyze";
import { sanitizeLogText, sanitizeMetadata } from "@/lib/guard/logSafety";

export const SEMANTIC_EGRESS_DECISIONS = ["ALLOW", "BLOCK", "REDACT", "ASK_APPROVAL", "REVIEW"] as const;
export const SEMANTIC_EGRESS_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const SEMANTIC_SENSITIVITY_LEVELS = ["PUBLIC", "INTERNAL", "PRIVATE", "CONFIDENTIAL", "SECRET", "REGULATED", "SYSTEM_PROMPT"] as const;
export const SEMANTIC_DESTINATION_TYPES = ["FINAL_OUTPUT", "PUBLIC_OUTPUT", "EXTERNAL_API", "EMAIL", "BROWSER_FORM", "WEBHOOK", "TOOL", "MEMORY", "FILE", "CUSTOM"] as const;

export type SemanticEgressDecision = (typeof SEMANTIC_EGRESS_DECISIONS)[number];
export type SemanticEgressRiskLevel = (typeof SEMANTIC_EGRESS_RISK_LEVELS)[number];
export type SemanticSensitivityLevel = (typeof SEMANTIC_SENSITIVITY_LEVELS)[number];
export type SemanticDestinationType = (typeof SEMANTIC_DESTINATION_TYPES)[number];

export interface SemanticFingerprint {
  keywords: string[];
  entities: string[];
  phrases: string[];
  signals: string[];
  summary: string;
  tokenCount: number;
}

export interface SemanticSourceFingerprintInput {
  sourceId: string;
  sourceType: string;
  sensitivityLevel: SemanticSensitivityLevel;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SemanticSourceFingerprintResult {
  sourceId: string;
  sourceType: string;
  sensitivityLevel: SemanticSensitivityLevel;
  contentHash: string;
  contentRedacted: string;
  fingerprint: SemanticFingerprint;
}

export interface SemanticSourceSnapshot {
  sourceId: string;
  sourceType: string;
  sensitivityLevel: SemanticSensitivityLevel;
  contentHash: string;
  fingerprint: SemanticFingerprint;
}

export interface SemanticEgressCheckInput {
  sessionId?: string;
  sourceIds?: string[];
  destinationType: SemanticDestinationType;
  destinationName?: string;
  content: string;
  sources?: SemanticSourceSnapshot[];
  metadata?: Record<string, unknown>;
}

export interface SemanticEgressFinding {
  id: string;
  label: string;
  severity: SemanticEgressRiskLevel;
  sourceId?: string;
  similarity?: number;
  details?: string;
}

export interface SemanticEgressDecisionResult {
  contentHash: string;
  contentRedacted: string;
  semanticRiskScore: number;
  decision: SemanticEgressDecision;
  riskLevel: SemanticEgressRiskLevel;
  reason: string;
  findings: SemanticEgressFinding[];
  matchedSources: Array<{ sourceId: string; similarity: number; sensitivityLevel: SemanticSensitivityLevel; sourceType: string }>;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "between",
  "could",
  "customer",
  "doing",
  "from",
  "have",
  "into",
  "just",
  "more",
  "only",
  "other",
  "plan",
  "please",
  "private",
  "public",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "with",
  "would",
  "your",
]);

export function createSemanticSourceFingerprintId() {
  return `semantic_source_${randomUUID()}`;
}

export function createSemanticEgressCheckId() {
  return `semantic_egress_${randomUUID()}`;
}

export function hashSemanticContent(content: string) {
  return createHash("sha256").update(content ?? "").digest("hex");
}

export function fingerprintSemanticSource(input: SemanticSourceFingerprintInput): SemanticSourceFingerprintResult {
  const content = input.content ?? "";
  const contentRedacted = sanitizeSemanticText(content) ?? "";
  return {
    sourceId: input.sourceId,
    sourceType: sanitizeSemanticText(input.sourceType) ?? "CUSTOM",
    sensitivityLevel: input.sensitivityLevel,
    contentHash: hashSemanticContent(content),
    contentRedacted,
    fingerprint: buildFingerprint(contentRedacted),
  };
}

export function checkSemanticEgress(input: SemanticEgressCheckInput): SemanticEgressDecisionResult {
  const content = input.content ?? "";
  const contentRedacted = sanitizeSemanticText(content) ?? "";
  const contentHash = hashSemanticContent(content);
  const outputFingerprint = buildFingerprint(contentRedacted);
  const guard = analyzeText(content, "OUTPUT");
  const findings: SemanticEgressFinding[] = [];
  const matchedSources = (input.sources ?? []).map((source) => ({
    source,
    similarity: calculateSimilarity(source.fingerprint, outputFingerprint, source.contentHash === contentHash),
  })).sort((a, b) => b.similarity - a.similarity);

  if (guard.riskTypes.includes("SECRET_DETECTED")) {
    findings.push({ id: "semantic.exact_secret", label: "Exact secret detected in egress content.", severity: "CRITICAL" });
  }
  if (guard.riskTypes.includes("PII_DETECTED") || guard.riskTypes.includes("INDIA_PII_DETECTED")) {
    findings.push({ id: "semantic.pii", label: "Personal or regulated data detected in egress content.", severity: "HIGH" });
  }
  if (outputFingerprint.signals.includes("ROADMAP") && isExternalDestination(input.destinationType, input.destinationName)) {
    findings.push({ id: "semantic.roadmap", label: "Internal roadmap or launch information appears in egress content.", severity: "MEDIUM" });
  }
  if (outputFingerprint.signals.includes("SOURCE_CODE") && isExternalDestination(input.destinationType, input.destinationName)) {
    findings.push({ id: "semantic.source_code", label: "Source-code logic appears in egress content.", severity: "HIGH" });
  }

  for (const match of matchedSources.filter((item) => item.similarity >= 0.18).slice(0, 5)) {
    const severity = severityForSource(match.source.sensitivityLevel, match.similarity);
    findings.push({
      id: "semantic.source_overlap",
      label: "Egress content semantically overlaps a protected source.",
      severity,
      sourceId: match.source.sourceId,
      similarity: Number(match.similarity.toFixed(2)),
      details: `${match.source.sensitivityLevel} ${match.source.sourceType}`,
    });
  }

  const best = matchedSources[0];
  const external = isExternalDestination(input.destinationType, input.destinationName);
  const bestSimilarity = best?.similarity ?? 0;
  const bestSensitivity = best?.source.sensitivityLevel ?? "PUBLIC";
  const sourceWeight = best ? sensitivityWeight(bestSensitivity) : 0;
  const destinationWeight = destinationRisk(input.destinationType, input.destinationName);
  const guardBoost = guard.riskTypes.includes("SECRET_DETECTED") ? 45 : guard.riskTypes.length > 0 ? 22 : 0;
  const semanticRiskScore = Math.min(100, Math.round(bestSimilarity * 70 * sourceWeight * destinationWeight + guardBoost));

  const exactSecretExternal = external && guard.riskTypes.includes("SECRET_DETECTED");
  const sensitiveMatch = best && sourceWeight >= 0.75 && bestSimilarity >= 0.35 && external;
  const confidentialMatch = best && bestSensitivity === "CONFIDENTIAL" && bestSimilarity >= 0.42 && external;
  const privateEmailMatch = best && best.source.sourceType.toUpperCase().includes("EMAIL") && bestSensitivity === "PRIVATE" && bestSimilarity >= 0.28 && external;
  const roadmapExternal = external && outputFingerprint.signals.includes("ROADMAP") && (bestSimilarity >= 0.18 || outputFingerprint.signals.includes("STRATEGY_PRICING"));

  if (exactSecretExternal) {
    return result(contentHash, contentRedacted, 100, "BLOCK", "CRITICAL", "Exact secret detected in external egress content.", findings, matchedSources);
  }
  if (sensitiveMatch || confidentialMatch) {
    return result(contentHash, contentRedacted, Math.max(semanticRiskScore, 88), "BLOCK", "HIGH", "Protected confidential source content appears to be leaving to an external destination.", findings, matchedSources);
  }
  if (privateEmailMatch) {
    return result(contentHash, contentRedacted, Math.max(semanticRiskScore, 82), "BLOCK", "HIGH", "Private email or customer context appears in public or external egress.", findings, matchedSources);
  }
  if (roadmapExternal) {
    return result(contentHash, contentRedacted, Math.max(semanticRiskScore, 58), "REVIEW", "MEDIUM", "Roadmap, pricing, or strategy context may be leaving to an external destination.", findings, matchedSources);
  }
  if (external && best && sourceWeight >= 0.7 && bestSimilarity >= 0.24) {
    return result(contentHash, contentRedacted, Math.max(semanticRiskScore, 66), "ASK_APPROVAL", "HIGH", "High-sensitivity source has medium semantic similarity to egress content.", findings, matchedSources);
  }
  if (external && guard.riskTypes.some((risk) => risk.includes("PII"))) {
    return result(contentHash, contentRedacted, Math.max(semanticRiskScore, 74), "REDACT", "HIGH", "Personal data should be redacted before egress.", findings, matchedSources);
  }
  if (best && bestSensitivity !== "PUBLIC" && bestSimilarity >= 0.2 && external) {
    return result(contentHash, contentRedacted, Math.max(semanticRiskScore, 45), "REVIEW", "MEDIUM", "Some protected-source overlap was detected for external egress.", findings, matchedSources);
  }

  return result(contentHash, contentRedacted, semanticRiskScore, "ALLOW", semanticRiskScore >= 35 ? "MEDIUM" : "LOW", "No material semantic leakage was detected.", findings, matchedSources);
}

export function sanitizeSemanticText(value?: string | null) {
  return value ? sanitizeLogText(value) : null;
}

export function sanitizeSemanticMetadata(metadata?: Record<string, unknown>) {
  return sanitizeMetadata(metadata);
}

export function normalizeSemanticFingerprint(value: unknown): SemanticFingerprint {
  if (!value || typeof value !== "object") return buildFingerprint("");
  const candidate = value as Partial<SemanticFingerprint>;
  return {
    keywords: safeStringArray(candidate.keywords, 80),
    entities: safeStringArray(candidate.entities, 40),
    phrases: safeStringArray(candidate.phrases, 80),
    signals: safeStringArray(candidate.signals, 30),
    summary: typeof candidate.summary === "string" ? sanitizeLogText(candidate.summary) : "No source signals.",
    tokenCount: typeof candidate.tokenCount === "number" ? candidate.tokenCount : 0,
  };
}

function result(
  contentHash: string,
  contentRedacted: string,
  semanticRiskScore: number,
  decision: SemanticEgressDecision,
  riskLevel: SemanticEgressRiskLevel,
  reason: string,
  findings: SemanticEgressFinding[],
  matchedSources: Array<{ source: SemanticSourceSnapshot; similarity: number }>,
): SemanticEgressDecisionResult {
  return {
    contentHash,
    contentRedacted,
    semanticRiskScore,
    decision,
    riskLevel,
    reason,
    findings,
    matchedSources: matchedSources.slice(0, 5).map((match) => ({
      sourceId: match.source.sourceId,
      similarity: Number(match.similarity.toFixed(2)),
      sensitivityLevel: match.source.sensitivityLevel,
      sourceType: match.source.sourceType,
    })),
  };
}

function buildFingerprint(text: string): SemanticFingerprint {
  const tokens = tokenize(text);
  const keywords = topKeywords(tokens, 60);
  const entities = extractEntities(text);
  const phrases = extractPhrases(tokens);
  const signals = extractSignals(text);
  return {
    keywords,
    entities,
    phrases,
    signals,
    summary: signals.length ? `Signals: ${signals.join(", ")}` : "No high-risk semantic signals.",
    tokenCount: tokens.length,
  };
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[^a-z0-9%._-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[-_.]+|[-_.]+$/g, ""))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !token.startsWith("redacted"));
}

function topKeywords(tokens: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([token]) => token)
    .slice(0, limit);
}

function extractEntities(text: string) {
  const matches = text.match(/\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2}\b/g) ?? [];
  return [...new Set(matches.map((value) => sanitizeLogText(value).trim()).filter((value) => value.length > 2 && !value.startsWith("[REDACTED")))].slice(0, 40);
}

function extractPhrases(tokens: string[]) {
  const phrases = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(`${tokens[index]} ${tokens[index + 1]}`);
    if (tokens[index + 2]) phrases.push(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`);
  }
  return [...new Set(phrases)].slice(0, 80);
}

function extractSignals(text: string) {
  const signals = new Set<string>();
  const value = text.toLowerCase();
  if (/\b(roadmap|launch|milestone|release|q[1-4]|quarter|beta|rollout)\b/.test(value)) signals.add("ROADMAP");
  if (/\b(pricing|discount|margin|strategy|forecast|renewal|enterprise|revenue|churn)\b/.test(value)) signals.add("STRATEGY_PRICING");
  if (/\b(customer|client|email|inbox|reply|ticket|crm|account|contract)\b/.test(value)) signals.add("CUSTOMER_CONTEXT");
  if (/\b(source code|algorithm|repository|function|class|route|schema|query|private method)\b/.test(value)) signals.add("SOURCE_CODE");
  if (/\b(system prompt|developer instruction|hidden instruction|private context|memory)\b/.test(value)) signals.add("PRIVATE_CONTEXT");
  if (/\b(password|api key|secret|token|private key|cookie)\b/.test(value)) signals.add("SECRET_HINT");
  return [...signals];
}

function calculateSimilarity(source: SemanticFingerprint, output: SemanticFingerprint, exactHashMatch: boolean) {
  if (exactHashMatch) return 1;
  const keywordOverlap = overlapRatio(source.keywords, output.keywords);
  const phraseOverlap = overlapRatio(source.phrases, output.phrases);
  const entityOverlap = overlapRatio(source.entities.map((value) => value.toLowerCase()), output.entities.map((value) => value.toLowerCase()));
  const signalOverlap = overlapRatio(source.signals, output.signals);
  return Math.min(1, keywordOverlap * 0.52 + phraseOverlap * 0.22 + entityOverlap * 0.16 + signalOverlap * 0.1);
}

function overlapRatio(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const overlap = [...new Set(left)].filter((value) => rightSet.has(value)).length;
  return overlap / Math.max(1, Math.min(new Set(left).size, rightSet.size));
}

function sensitivityWeight(level: SemanticSensitivityLevel) {
  switch (level) {
    case "PUBLIC":
      return 0.1;
    case "INTERNAL":
      return 0.45;
    case "PRIVATE":
      return 0.75;
    case "CONFIDENTIAL":
      return 0.9;
    case "SECRET":
    case "REGULATED":
    case "SYSTEM_PROMPT":
      return 1;
    default:
      return 0.5;
  }
}

function destinationRisk(type: SemanticDestinationType, name?: string) {
  if (isExternalDestination(type, name)) return 1;
  if (type === "FINAL_OUTPUT" || type === "TOOL") return 0.7;
  if (type === "MEMORY" || type === "FILE") return 0.45;
  return 0.5;
}

function isExternalDestination(type: SemanticDestinationType, name?: string) {
  if (["PUBLIC_OUTPUT", "EXTERNAL_API", "EMAIL", "BROWSER_FORM", "WEBHOOK"].includes(type)) return true;
  if (!name) return false;
  const lower = name.toLowerCase();
  return /^https?:\/\//.test(lower) && !/localhost|127\.0\.0\.1|internal|\.local/.test(lower);
}

function severityForSource(level: SemanticSensitivityLevel, similarity: number): SemanticEgressRiskLevel {
  if (["SECRET", "REGULATED", "SYSTEM_PROMPT"].includes(level) || similarity >= 0.7) return "CRITICAL";
  if (["PRIVATE", "CONFIDENTIAL"].includes(level) || similarity >= 0.45) return "HIGH";
  if (level === "INTERNAL" || similarity >= 0.25) return "MEDIUM";
  return "LOW";
}

function safeStringArray(value: unknown, limit: number) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => sanitizeLogText(item)).slice(0, limit) : [];
}
