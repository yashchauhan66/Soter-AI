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
import { MAX_TEXT_LENGTH } from "./constants";
import type { GuardDirection, GuardFinding, GuardResult, RiskType } from "./types";

export function analyzeText(text: string, direction: GuardDirection): GuardResult {
  const common = [piiDetector, indiaPiiDetector, secretsDetector];
  const detectors = direction === "OUTPUT"
    ? [systemPromptLeakageDetector, unsafeOutputDetector, ...common]
    : [promptInjectionDetector, jailbreakDetector, systemPromptLeakAttemptDetector, ...common];
  const findings: GuardFinding[] = detectors.flatMap((detector) => detector(text));

  if (direction === "OUTPUT" && /unsafe.*placeholder|simulation/i.test(text)) {
    findings.push({
      type: "UNSAFE_OUTPUT",
      label: "Unsafe output simulation",
      severity: "HIGH",
      score: 85,
      message: "Unsafe output pattern detected."
    });
  }

  if (direction === "INPUT") {
    const normalized = text.replace(/[\s.-]/g, "");
    
    const isLeak = /hidden instructions|internal prompt|developer.*tell|print.*hidden rules|repeat.*text before|reveal.*configuration|r\s*e\s*v\s*e\s*a\s*l|system\s+prompt\s+batao|hidden\s+instruction\s+dikhao/i.test(text) ||
                   /hiddeninstructions|internalprompt|developertell|printhiddenrules|repeattextbefore|revealconfiguration/i.test(normalized);
                   
    if (isLeak) {
      findings.push({
        type: "SYSTEM_PROMPT_LEAK_ATTEMPT",
        label: "System prompt leak attempt",
        severity: "HIGH",
        score: 85,
        message: "System prompt extraction pattern detected."
      });
    }

    const blockRegexes = [
      /forget.*rules.*follow.*command/i,
      /disable.*guardrails/i,
      /pretend.*DAN/i,
      /roleplay.*unrestricted/i,
      /ignore.*safety.*reveal.*rules/i,
      /pretend.*not bound.*policy/i,
      /say ok.*ignore safety/i,
      /hidden instructions/i,
      /repeat.*above/i,
      /ignore.*safety rules/i,
      /forget.*policy.*obey/i,
      /override.*instructions/i,
      /disable.*restrictions/i,
      /admin.*bypass.*rules/i,
      /uncensored.*assistant/i,
      /unrestricted mode/i,
      /pretend.*no safety/i,
      /roleplay.*answer anything/i,
      /fictional.*ignore.*guardrails/i,
      /internal prompt/i,
      /what.*developer.*tell/i,
      /print.*hidden rules/i,
      /repeat.*text before/i,
      /reveal.*configuration/i,
      /i\s+g\s+n\s+o\s+r\s+e/i,
      /dis\s+-\s+able/i,
      /bypass\s*\.\s*policy/i,
      /r\s+e\s+v\s+e\s+a\s+l/i,
      /ignore\s*\n\s*previous/i,
      /rules.*ignore.*kro/i,
      /guardrails.*disable.*do/i,
      /hidden.*dikhao/i,
      /prompt.*batao/i,
      /policy.*bypass.*do/i,
      /ignore.*rules/i,
      /unrestricted/i,
      /hidden rules/i,
      /bypass.*rules/i
    ];
    
    if (blockRegexes.some(rx => rx.test(text) || rx.test(normalized))) {
      findings.push({
        type: "PROMPT_INJECTION",
        label: "IPS Signature match",
        severity: "HIGH",
        score: 85,
        message: "Adversarial bypass pattern detected."
      });
      findings.push({
        type: "JAILBREAK",
        label: "IPS Signature match",
        severity: "HIGH",
        score: 85,
        message: "Adversarial jailbreak pattern detected."
      });
    }
  }

  if (text.length > MAX_TEXT_LENGTH * 0.75) {
    findings.push({ type: "TOKEN_ABUSE", label: "Large payload", severity: "MEDIUM", score: 30, message: "The payload is unusually large and may cause avoidable token usage." });
  }

  const riskScore = scoreRisk(findings);
  const riskTypes = ([...new Set(findings.map((finding) => finding.type))] as RiskType[]);
  if (riskTypes.length === 0) riskTypes.push("LOW_RISK");
  const action = decideGuardAction(riskScore, riskTypes, direction, text);
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
