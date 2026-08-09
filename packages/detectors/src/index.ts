import { detectBusinessSensitive } from "./business-sensitive";
import { detectSourceCode } from "./code";
import type { DetectorFinding, ScanTextResult } from "./core";
import { looksObfuscated, normalizeForDetection } from "./normalize";
import { detectPiiGlobal } from "./pii-global";
import { detectPiiIndia } from "./pii-india";
import { detectPromptInjection } from "./prompt-injection";
import { detectSecrets } from "./secrets";
import { detectSemanticInjection } from "./semantic";

/**
 * Scan text for secrets, PII, source code, business-sensitive content and
 * prompt-injection. When the text looks obfuscated (zero-width chars, homoglyphs,
 * leetspeak, base64, ROT13…) we additionally scan the normalized candidate views
 * so evasion attempts still match the plain-language rules.
 */
export function scanText(text: string): ScanTextResult {
  const findings = dedupeFindings([
    ...detectSecrets(text),
    ...detectPiiIndia(text),
    ...detectPiiGlobal(text),
    ...detectSourceCode(text),
    ...detectBusinessSensitive(text),
    ...detectPromptInjection(text),
  ]);

  // Anti-evasion: only pay the multi-view cost when obfuscation is plausible.
  if (looksObfuscated(text)) {
    for (const view of normalizeForDetection(text)) {
      if (view === text) continue;
      for (const finding of detectPromptInjection(view)) {
        findings.push({ ...finding, message: `${finding.message} (de-obfuscated)` });
      }
      for (const finding of detectSecrets(view)) {
        findings.push({ ...finding, message: `${finding.message} (de-obfuscated)` });
      }
    }
  }

  // Semantic injection shield: paraphrase-resistant intent scoring, merged as an
  // additive detector finding (only fires above its internal threshold).
  findings.push(...detectSemanticInjection(text));

  const merged = dedupeFindings(findings);
  const detectedDataTypes = Array.from(new Set(merged.map((finding) => finding.type))).sort();
  const riskScore = Math.min(100, merged.reduce((sum, finding) => sum + finding.score, 0));
  return { findings: merged, detectedDataTypes, riskScore };
}

function dedupeFindings(findings: DetectorFinding[]) {
  const seen = new Set<string>();
  return findings
    .sort((a, b) => a.start - b.start || b.score - a.score)
    .filter((finding) => {
      const key = `${finding.type}:${finding.match}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export * from "./business-sensitive";
export * from "./code";
export * from "./core";
export * from "./normalize";
export * from "./pii-global";
export * from "./pii-india";
export * from "./prompt-injection";
export * from "./secrets";
export * from "./semantic";
