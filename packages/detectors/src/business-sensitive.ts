import type { DetectorFinding } from "./core";

/**
 * Business-sensitive text detection with false-positive reduction.
 *
 * Rules to prevent false positives:
 * 1. Avoid single keyword triggering high severity
 * 2. Require 2+ related indicators or stronger patterns
 * 3. Use context windows to validate matches
 * 4. Exclude generic educational questions
 * 5. Add confidence scores
 */

// Generic learning/education patterns that should not trigger business-sensitive detectors
const EDUCATIONAL_PATTERNS = [
  /\bwhat is (a )?(salary|revenue|customer support|contract|nda|budget|margin|forecast)\b/i,
  /\bexplain (the concept of |what is )?(revenue|salary|margin|budget|profit|loss)\b/i,
  /\b(define|meaning of) (revenue|salary|customer|contract|budget|margin)\b/i,
  /\b(sample|example|template|draft) (contract|nda|agreement|invoice)\b/i,
  /\bhow to (write|create|prepare|draft) (a )?(contract|invoice|budget|report|resume)\b/i,
  /\bwhat does (revenue|profit|margin|salary) mean\b/i,
  /\bcan you give (me )?(a )?(n )?example of (revenue|salary|contract|customer data)\b/i,
];

function isEducationalQuestion(text: string, match: string): boolean {
  const contextBefore = text.slice(0, Math.max(0, text.indexOf(match))).trim();
  const fullContext = contextBefore + " " + match;
  return EDUCATIONAL_PATTERNS.some(pattern => pattern.test(fullContext));
}

// Check if there are enough related indicators in context
function countRelatedIndicators(text: string, indicators: RegExp[], offset: number, windowSize = 200): number {
  const start = Math.max(0, offset - windowSize);
  const end = Math.min(text.length, offset + windowSize);
  const context = text.slice(start, end);
  return indicators.filter(pattern => pattern.test(context)).length;
}

// Multi-indicator specs that require sufficient context evidence
const CONTEXTUAL_INDICATORS = [
  {
    type: "production_logs",
    label: "Production log or stack trace",
    severity: "high" as const,
    baseScore: 22,
    patterns: [
      /(?:error|fatal|exception|traceback)\b[^\n]*(?:\n\s+at\s|file "[^"]+", line \d+)/gm,
      /\b(?:INFO|WARN|ERROR|FATAL|DEBUG)\s+\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/gm,
      /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\.,]\d{3,}\s+(?:ERROR|WARN|INFO|FATAL|DEBUG)\b/gm,
    ],
    message: "Production log or stack trace detected.",
    // Additional signals that strengthen the detection
    coSignals: [/production|prod/i, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, /request_id|trace_id|span_id/i],
  },
  {
    type: "customer_data",
    label: "Customer data indicator",
    severity: "medium" as const,
    baseScore: 14,
    patterns: [
      /customer\s+(id|record|data|list|profile|segment|information|details|name|email|phone|address)\b/gi,
      /client\s+(id|record|data|list|profile|segment)\b/gi,
      /account\s+(id|record|data|number|holder|details)\b/gi,
    ],
    message: "Customer data indicator detected.",
    coSignals: [/pii|personal/i, /confidential|private/i, /\bemail\b/i, /\bphone\b/i],
  },
  {
    type: "legal_contract",
    label: "Legal/contract text",
    severity: "medium" as const,
    baseScore: 15,
    patterns: [
      /\b(non[-\\s]?disclosure|indemnif(?:y|ication)|limitation of liability|governing law|termination clause|confidentiality clause)\b/gi,
      /\b(whereas|hereinafter|notwithstanding|force majeure|entire agreement)\b/gi,
    ],
    message: "Legal or contract text detected.",
    coSignals: [/party|parties/i, /\bsection\s+\d+/i, /effective date/i, /\bsignature/i],
  },
  {
    type: "hr_salary",
    label: "HR/salary text",
    severity: "medium" as const,
    baseScore: 15,
    patterns: [
      /\b(salary|annual compensation|bonus|performance review|offer letter|employee id|payroll)\b/gi,
      /\bsalary\s+(range|band|bracket|slab|increment|hike|revision)\b/gi,
    ],
    message: "HR or salary text detected.",
    coSignals: [/\bemployee\b/i, /\b(?:monthly|annual|yearly)\s+(?:salary|ctc|compensation)\b/i, /\b(?:lpa|k|thousand|lakh)\b/i],
  },
  {
    type: "financial_text",
    label: "Financial text",
    severity: "medium" as const,
    baseScore: 16,
    patterns: [
      /\b(revenue|gross margin|operating margin|forecast|budget|invoice|profit|loss|valuation|cap table|burn rate)\b/gi,
      /\bfinancial\s+(statement|report|quarter|year|data|records)\b/gi,
    ],
    message: "Financial business text detected.",
    coSignals: [/\$\s*\d+[,.]?\d*/i, /\d+\s*(?:million|billion|crore|lakh)/i, /revenue|profit|loss/i],
  },
  {
    type: "internal_roadmap",
    label: "Internal roadmap",
    severity: "medium" as const,
    baseScore: 16,
    patterns: [
      /\b(roadmap|product plan|launch date|release timeline|internal strategy|quarterly plan)\b/gi,
      /\b(unannounced|pre[-\\s]?launch|confidential|internal only)\b/gi,
    ],
    message: "Internal roadmap or strategy detected.",
    coSignals: [/Q[1-4]\s+\d{4}/i, /(?:company|product|feature)\s+(?:plan|roadmap|strategy)/i],
  },
];

export function detectBusinessSensitive(text: string): DetectorFinding[] {
  const findings: DetectorFinding[] = [];
  const normalizedForEducation = text.toLowerCase();

  for (const spec of CONTEXTUAL_INDICATORS) {
    const seenMatches = new Set<string>();

    for (const pattern of spec.patterns) {
      const matches = Array.from(text.matchAll(pattern));

      for (const match of matches) {
        const value = match[0];
        const offset = match.index ?? 0;

        // Deduplicate by match value and approximate position
        const dedupKey = `${spec.type}:${value.slice(0, 20)}`;
        if (seenMatches.has(dedupKey)) continue;
        seenMatches.add(dedupKey);

        // Skip educational questions
        if (isEducationalQuestion(normalizedForEducation, value.toLowerCase())) continue;

        // Count related indicators in context window
        const coSignalCount = countRelatedIndicators(text, spec.coSignals, offset);

        // Calculate confidence-based score
        let confidenceMultiplier = 1.0;
        if (coSignalCount === 0) {
          // Single pattern without co-signals is low confidence
          confidenceMultiplier = 0.3;
        } else if (coSignalCount === 1) {
          confidenceMultiplier = 0.6;
        } else {
          confidenceMultiplier = 1.0;
        }

        // Apply minimum threshold - skip if confidence is too low
        const effectiveScore = Math.round(spec.baseScore * confidenceMultiplier);
        if (effectiveScore < 5) continue;

        findings.push({
          type: spec.type,
          label: spec.label,
          severity: effectiveScore >= 20 ? spec.severity : effectiveScore >= 10 ? "medium" : "low",
          score: effectiveScore,
          start: offset,
          end: offset + value.length,
          match: value,
          message: spec.message + (confidenceMultiplier < 1.0 ? " (low confidence)" : ""),
        });
      }
    }
  }

  return findings;
}
