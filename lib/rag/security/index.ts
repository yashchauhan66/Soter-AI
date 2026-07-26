import { sanitizeLogText } from "../../guard/logSafety";

export interface RagSecuritySource {
  id: string;
  text: string;
  authorized: boolean;
  trustScore: number;
  sensitive?: boolean;
  citation?: string;
  rank?: number;
}

export interface RagSecurityInput {
  query: string;
  answer: string;
  sources: RagSecuritySource[];
  citations?: string[];
}

const MAX_QUERY_LENGTH = 4_000;
const MAX_ANSWER_LENGTH = 100_000;
const MAX_SOURCE_TEXT_LENGTH = 20_000;
const MAX_SOURCES = 500;

export function analyzeRagSecurity(input: RagSecurityInput) {
  const findings: Array<{ type: string; severity: string; evidence: string }> = [];
  if (input.query.length > MAX_QUERY_LENGTH) findings.push({ type: "INPUT_SIZE_EXCEEDED", severity: "MEDIUM", evidence: `Query exceeds ${MAX_QUERY_LENGTH} character limit.` });
  if (input.answer.length > MAX_ANSWER_LENGTH) findings.push({ type: "INPUT_SIZE_EXCEEDED", severity: "MEDIUM", evidence: `Answer exceeds ${MAX_ANSWER_LENGTH} character limit.` });
  if (input.sources.length > MAX_SOURCES) findings.push({ type: "INPUT_SIZE_EXCEEDED", severity: "MEDIUM", evidence: `Number of sources exceeds ${MAX_SOURCES} limit.` });
  const query = input.query.toLowerCase().slice(0, MAX_QUERY_LENGTH);

  if (/ignore previous|system prompt|developer message|override instruction|send private/i.test(input.query)) {
    findings.push({ type: "RETRIEVAL_MANIPULATION", severity: "HIGH", evidence: "Query contains retrieval-manipulation language." });
  }

  for (const source of input.sources.slice(0, MAX_SOURCES)) {
    const sourceText = source.text.slice(0, MAX_SOURCE_TEXT_LENGTH);
    try {
      if (/ignore previous|system prompt|exfiltrate|send.*secret|hidden instruction/i.test(sourceText)) {
        findings.push({ type: "RAG_POISONING", severity: "HIGH", evidence: `Source ${source.id} contains indirect instruction patterns.` });
      }
    } catch {
      findings.push({ type: "RAG_POISONING", severity: "HIGH", evidence: `Source ${source.id} pattern test caused a processing error (possible ReDoS).` });
    }
    if (source.trustScore < 40) {
      findings.push({ type: "LOW_TRUST_SOURCE", severity: "MEDIUM", evidence: `Source ${source.id} has low trust score.` });
    }
    if ((source.sensitive || !source.authorized) && leakedIntoAnswer(input.answer, sourceText)) {
      findings.push({ type: "PRIVATE_CHUNK_LEAKAGE", severity: "CRITICAL", evidence: `Answer overlaps with private or unauthorized source ${source.id}.` });
    }
    if (source.rank !== undefined && source.rank <= 2 && source.trustScore < 50) {
      findings.push({ type: "POISONED_DOCUMENT_RANKING", severity: "HIGH", evidence: `Low-trust source ${source.id} ranked too highly.` });
    }
  }

  const sourceIds = new Set(input.sources.map((source) => source.id));
  for (const citation of input.citations ?? []) {
    if (!sourceIds.has(citation)) {
      findings.push({ type: "CITATION_MANIPULATION", severity: "HIGH", evidence: `Citation ${sanitizeLogText(citation)} was not among retrieved sources.` });
    }
  }

  if (/\b(policy|price|medical|legal|security|refund)\b/i.test(query) && !(input.citations?.length ?? 0)) {
    findings.push({ type: "NO_SOURCE_HIGH_RISK_ANSWER", severity: "MEDIUM", evidence: "High-risk query has no citation evidence." });
  }

  return {
    riskScore: Math.min(100, findings.reduce((score, finding) => score + severityScore(finding.severity), 0)),
    findings,
    allowed: !findings.some((finding) => finding.severity === "CRITICAL"),
    redactedEvidence: findings.map((finding) => ({ ...finding, evidence: sanitizeLogText(finding.evidence) })),
  };
}

export function classifyChunkSensitivity(text: string) {
  if (/(password|api key|secret|token|aadhaar|pan|credit card|recovery phrase)/i.test(text)) return "HIGH";
  if (/(email|phone|address|invoice|customer|employee)/i.test(text)) return "MEDIUM";
  return "LOW";
}

function leakedIntoAnswer(answer: string, sourceText: string) {
  const normalized = sourceText.replace(/\s+/g, " ").trim();
  if (normalized.length < 24) return false;
  return answer.includes(normalized.slice(0, Math.min(80, normalized.length)));
}

function severityScore(severity: string) {
  if (severity === "CRITICAL") return 60;
  if (severity === "HIGH") return 35;
  if (severity === "MEDIUM") return 20;
  return 10;
}

