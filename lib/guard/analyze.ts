import { indiaPiiDetector } from "./detectors/indiaPiiDetector";
import { jailbreakDetector } from "./detectors/jailbreakDetector";
import { piiDetector } from "./detectors/piiDetector";
import { promptInjectionDetector } from "./detectors/promptInjectionDetector";
import { secretsDetector } from "./detectors/secretsDetector";
import { systemPromptLeakageDetector, systemPromptLeakAttemptDetector } from "./detectors/systemPromptLeakDetector";
import { unsafeOutputDetector } from "./detectors/unsafeOutputDetector";
import { decideGuardAction } from "./decisionEngine";
import { redactText } from "./redactor";
import { rewriteRiskyText } from "./rewrite";
import { scoreRisk } from "./riskScoring";
import type { GuardDirection, GuardFinding, GuardResult, RiskType } from "./types";

export function analyzeText(text: string, direction: GuardDirection): GuardResult {
  const common = [piiDetector, indiaPiiDetector, secretsDetector];
  const detectors = direction === "OUTPUT"
    ? [systemPromptLeakageDetector, unsafeOutputDetector, ...common]
    : [promptInjectionDetector, jailbreakDetector, systemPromptLeakAttemptDetector, ...common];
  const findings: GuardFinding[] = detectors.flatMap((detector) => detector(text));

  if (text.length > 6000) {
    findings.push({ type: "TOKEN_ABUSE", label: "Large payload", severity: "MEDIUM", score: 30, message: "The payload is unusually large and may cause avoidable token usage." });
  }

  const riskScore = scoreRisk(findings);
  const riskTypes = ([...new Set(findings.map((finding) => finding.type))] as RiskType[]);
  if (riskTypes.length === 0) riskTypes.push("LOW_RISK");
  const action = decideGuardAction(riskScore, riskTypes, direction);
  const redactedText = redactText(text, findings);
  const changed = redactedText !== text;
  const allowed = action === "ALLOW" || action === "ALLOW_WITH_REDACTION" || action === "REWRITE";
  const safeText = action === "REWRITE"
    ? rewriteRiskyText(text, findings)
    : changed
      ? redactedText
      : text;
  const reason = buildReason(action, findings);

  return {
    allowed,
    action,
    riskScore,
    riskTypes,
    originalText: text,
    redactedText: changed ? redactedText : undefined,
    safeText: allowed ? safeText : undefined,
    reason,
    findings,
    metadata: { direction, findingCount: findings.length },
  };
}

function buildReason(action: GuardResult["action"], findings: GuardFinding[]) {
  if (findings.length === 0) return "No material risk patterns were detected by the Phase 1 rules.";
  const labels = [...new Set(findings.map((finding) => finding.label))].slice(0, 3).join(", ");
  if (action === "BLOCK") return `Blocked because high-risk patterns were detected: ${labels}.`;
  if (action === "HUMAN_REVIEW") return `Held for human review because sensitive or high-risk content was detected: ${labels}.`;
  if (action === "ALLOW_WITH_REDACTION") return `Allowed after sensitive values were redacted: ${labels}.`;
  if (action === "REWRITE") return `Risky instruction text was removed before use: ${labels}.`;
  return `Content requires a safer handling path: ${labels}.`;
}
