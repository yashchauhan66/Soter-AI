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

export function analyzeRagSecurity(input: RagSecurityInput) {
  const findings: Array<{ type: string; severity: string; evidence: string }> = [];
  const query = input.query.toLowerCase();

  if (/ignore previous|system prompt|developer message|override instruction|send private/i.test(input.query)) {
    findings.push({ type: "RETRIEVAL_MANIPULATION", severity: "HIGH", evidence: "Query contains retrieval-manipulation language." });
  }

  for (const source of input.sources) {
    if (/ignore previous|system prompt|exfiltrate|send.*secret|hidden instruction/i.test(source.text)) {
      findings.push({ type: "RAG_POISONING", severity: "HIGH", evidence: `Source ${source.id} contains indirect instruction patterns.` });
    }
    if (source.trustScore < 40) {
      findings.push({ type: "LOW_TRUST_SOURCE", severity: "MEDIUM", evidence: `Source ${source.id} has low trust score.` });
    }
    if ((source.sensitive || !source.authorized) && leakedIntoAnswer(input.answer, source.text)) {
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

