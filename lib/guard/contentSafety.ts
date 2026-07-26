/**
 * Content Safety Filter — SoterAI Guard
 * Detects and blocks harmful, toxic, or policy-violating outputs
 * Competitors: Lakera Guard (toxic language), OpenAI Moderation, Perspective API
 */

export type SafetyCategory =
  | "HATE_SPEECH"
  | "HARASSMENT"
  | "VIOLENCE"
  | "SELF_HARM"
  | "SEXUAL_CONTENT"
  | "DRUGS"
  | "WEAPONS"
  | "DANGEROUS_ACTIVITY"
  | "MISINFORMATION"
  | "SPAM";

export type SafetyDecision = "ALLOW" | "BLOCK" | "REDACT" | "WARN";

export interface SafetyFinding {
  category: SafetyCategory;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  span?: { start: number; end: number };
  description: string;
}

export interface SafetyResult {
  decision: SafetyDecision;
  findings: SafetyFinding[];
  overallRisk: number;
  categoriesChecked: SafetyCategory[];
}

const SAFETY_PATTERNS: Record<SafetyCategory, { pattern: RegExp; severity: SafetyFinding["severity"] }[]> = {
  HATE_SPEECH: [
    { pattern: /\b(kill|murder|exterminate|eliminate)\s+(all\s+)?(people|humans|men|women|children)\b/gi, severity: "CRITICAL" },
    { pattern: /\b(go\s+back\s+to|deport|expel)\s+(your\s+)?(country|nation)\b/gi, severity: "HIGH" },
  ],
  HARASSMENT: [
    { pattern: /\b(kill\s+yourself|kys|commit\s+suicide)\b/gi, severity: "CRITICAL" },
    { pattern: /\b(i['']?ll\s+find\s+you|i['']?ll\s+hunt\s+you|i['']?ll\s+destroy)\b/gi, severity: "HIGH" },
    { pattern: /\b(doxx|dox|swat|swatting)\b/gi, severity: "HIGH" },
  ],
  VIOLENCE: [
    { pattern: /\b(make|build|construct|create)\s+(a\s+)?(bomb|explosive|weapon|gun|rifle)\b/gi, severity: "CRITICAL" },
    { pattern: /\b(how\s+to\s+(kill|murder|assassinate|harm))\b/gi, severity: "CRITICAL" },
    { pattern: /\b(poison|suffocate|strangle|drown)\s+(someone|a\s+person|them)\b/gi, severity: "HIGH" },
  ],
  SELF_HARM: [
    { pattern: /\b(how\s+to\s+(cut|harm|hurt)\s+(myself|yourself|oneself))\b/gi, severity: "CRITICAL" },
    { pattern: /\b(best\s+way\s+to\s+(die|commit\s+suicide|end\s+(it|my\s+life)))\b/gi, severity: "CRITICAL" },
  ],
  SEXUAL_CONTENT: [
    { pattern: /\b(child|minor|underage|loli)\s*(porn|sex|nude|explicit)\b/gi, severity: "CRITICAL" },
    { pattern: /\b(rape|rapist|date\s+rape|roofie)\b/gi, severity: "HIGH" },
  ],
  DRUGS: [
    { pattern: /\b(how\s+to\s+(make|cook|synthesize|manufacture))\s+(meth|cocaine|heroin|fentanyl|lsd|mdma)\b/gi, severity: "CRITICAL" },
    { pattern: /\b(sell|buy|deal|distribute)\s+(drugs|cocaine|meth|heroin|fentanyl)\b/gi, severity: "HIGH" },
  ],
  WEAPONS: [
    { pattern: /\b(how\s+to\s+(make|build|modify|convert))\s+(a\s+)?(gun|firearm|silencer|suppressor|auto)\b/gi, severity: "CRITICAL" },
    { pattern: /\b(3d\s+print|printable)\s+(gun|firearm|weapon)\b/gi, severity: "HIGH" },
  ],
  DANGEROUS_ACTIVITY: [
    { pattern: /\b(how\s+to\s+(hack|compromise|breach|exploit))\s+(a\s+)?(system|network|server|database)\b/gi, severity: "HIGH" },
    { pattern: /\b(steal|exfiltrate|exfiltrate)\s+(data|credentials|passwords|secrets)\b/gi, severity: "HIGH" },
  ],
  MISINFORMATION: [
    { pattern: /\b(vaccines?\s+cause|covid\s+is\s+a\s+hoax|5g\s+causes)\b/gi, severity: "MEDIUM" },
    { pattern: /\b(election\s+was\s+stolen|climate\s+change\s+is\s+fake)\b/gi, severity: "MEDIUM" },
  ],
  SPAM: [
    { pattern: /\b(buy\s+now|act\s+now|limited\s+time|click\s+here|free\s+money)\b/gi, severity: "LOW" },
    { pattern: /\b(100%\s+free|no\s+cost|risk\s+free|guaranteed)\b/gi, severity: "LOW" },
  ],
};

export function analyzeContentSafety(
  text: string,
  options?: { categories?: SafetyCategory[]; threshold?: number }
): SafetyResult {
  const categories = options?.categories ?? (Object.keys(SAFETY_PATTERNS) as SafetyCategory[]);
  const threshold = options?.threshold ?? 0.5;
  const findings: SafetyFinding[] = [];
  const startTime = Date.now();
  // Security hardening: max 500ms for content safety scanning
  const CONTENT_SAFETY_TIMEOUT_MS = 500;
  // Security hardening: max 200 matches per category (runaway guard)
  const MAX_FINDINGS_PER_CATEGORY = 200;

  for (const category of categories) {
    if (Date.now() - startTime > CONTENT_SAFETY_TIMEOUT_MS) break;
    const patterns = SAFETY_PATTERNS[category];
    if (!patterns) continue;
    let categoryFindings = 0;

    for (const { pattern, severity } of patterns) {
      if (Date.now() - startTime > CONTENT_SAFETY_TIMEOUT_MS) break;
      if (categoryFindings >= MAX_FINDINGS_PER_CATEGORY) break;

      try {
        const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
        for (const match of matches) {
          categoryFindings++;
          if (categoryFindings > MAX_FINDINGS_PER_CATEGORY) break;
          findings.push({
            category,
            severity,
            confidence: severity === "CRITICAL" ? 0.95 : severity === "HIGH" ? 0.85 : severity === "MEDIUM" ? 0.7 : 0.6,
            span: { start: match.index!, end: match.index! + match[0].length },
            description: `Detected ${category.toLowerCase().replace(/_/g, " ")} pattern: "${match[0]}"`,
          });
        }
      } catch {
        // Scanner isolation: a crash in one pattern must not cascade
        continue;
      }
    }
  }

  const hasCritical = findings.some((f) => f.severity === "CRITICAL");
  const hasHigh = findings.some((f) => f.severity === "HIGH");
  const overallRisk = findings.length === 0 ? 0 : Math.min(1, findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length);

  let decision: SafetyDecision = "ALLOW";
  if (hasCritical || overallRisk > 0.9) decision = "BLOCK";
  else if (hasHigh || overallRisk > 0.7) decision = "REDACT";
  else if (findings.length > 0) decision = "WARN";

  return {
    decision,
    findings,
    overallRisk,
    categoriesChecked: categories,
  };
}

export function getSafetyCategories(): SafetyCategory[] {
  return Object.keys(SAFETY_PATTERNS) as SafetyCategory[];
}
