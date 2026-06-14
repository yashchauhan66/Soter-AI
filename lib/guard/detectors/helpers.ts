import type { GuardFinding, RiskType, Severity } from "../types";

export interface PatternRule {
  pattern: RegExp;
  label: string;
  message: string;
  severity: Severity;
  score: number;
  redactionToken?: string;
  sensitive?: boolean;
}

export function detectPatterns(text: string, type: RiskType, rules: PatternRule[]) {
  const findings: GuardFinding[] = [];
  for (const rule of rules) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const regex = new RegExp(rule.pattern.source, flags);
    for (const match of text.matchAll(regex)) {
      if (match.index === undefined) continue;
      findings.push({
        type,
        label: rule.label,
        severity: rule.severity,
        score: rule.score,
        matched: rule.sensitive ? undefined : match[0].slice(0, 120),
        message: rule.message,
        start: match.index,
        end: match.index + match[0].length,
        redactionToken: rule.redactionToken,
      });
      if (findings.length >= 20) return findings;
    }
  }
  return findings;
}
