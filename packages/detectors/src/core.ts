export type DetectorSeverity = "low" | "medium" | "high" | "critical";

export interface DetectorFinding {
  type: string;
  label: string;
  severity: DetectorSeverity;
  score: number;
  start: number;
  end: number;
  match: string;
  message: string;
}

export interface ScanTextResult {
  findings: DetectorFinding[];
  detectedDataTypes: string[];
  riskScore: number;
}

export interface RegexDetectorSpec {
  type: string;
  label: string;
  severity: DetectorSeverity;
  score: number;
  pattern: RegExp;
  message: string;
  validator?: (match: string) => boolean;
}

export function runRegexDetectors(text: string, specs: RegexDetectorSpec[]): DetectorFinding[] {
  const findings: DetectorFinding[] = [];
  for (const spec of specs) {
    const pattern = ensureGlobal(spec.pattern);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[0];
      if (!value || (spec.validator && !spec.validator(value))) continue;
      findings.push({
        type: spec.type,
        label: spec.label,
        severity: spec.severity,
        score: spec.score,
        start: match.index,
        end: match.index + value.length,
        match: value,
        message: spec.message,
      });
    }
  }
  return findings;
}

function ensureGlobal(pattern: RegExp) {
  return pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
}
