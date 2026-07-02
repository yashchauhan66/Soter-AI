import { detectBusinessSensitive } from "./business-sensitive";
import { detectSourceCode } from "./code";
import type { DetectorFinding, ScanTextResult } from "./core";
import { detectPiiGlobal } from "./pii-global";
import { detectPiiIndia } from "./pii-india";
import { detectPromptInjection } from "./prompt-injection";
import { detectSecrets } from "./secrets";

export function scanText(text: string): ScanTextResult {
  const findings = dedupeFindings([
    ...detectSecrets(text),
    ...detectPiiIndia(text),
    ...detectPiiGlobal(text),
    ...detectSourceCode(text),
    ...detectBusinessSensitive(text),
    ...detectPromptInjection(text),
  ]);
  const detectedDataTypes = Array.from(new Set(findings.map((finding) => finding.type))).sort();
  const riskScore = Math.min(100, findings.reduce((sum, finding) => sum + finding.score, 0));
  return { findings, detectedDataTypes, riskScore };
}

function dedupeFindings(findings: DetectorFinding[]) {
  const seen = new Set<string>();
  return findings
    .sort((a, b) => a.start - b.start || b.score - a.score)
    .filter((finding) => {
      const key = `${finding.type}:${finding.start}:${finding.end}:${finding.match}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export * from "./business-sensitive";
export * from "./code";
export * from "./core";
export * from "./pii-global";
export * from "./pii-india";
export * from "./prompt-injection";
export * from "./secrets";
