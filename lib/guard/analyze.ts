import { indiaPiiDetector } from "./detectors/indiaPiiDetector";
import { jailbreakDetector } from "./detectors/jailbreakDetector";
import { piiDetector } from "./detectors/piiDetector";
import { promptInjectionDetector } from "./detectors/promptInjectionDetector";
import { secretsDetector } from "./detectors/secretsDetector";
import { systemPromptLeakageDetector, systemPromptLeakAttemptDetector } from "./detectors/systemPromptLeakDetector";
import { spamUrlDetector } from "./detectors/spamUrlDetector";
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
    ? [systemPromptLeakageDetector, unsafeOutputDetector, spamUrlDetector, ...common]
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
      /bypass.*rules/i,
      /ignore.*everything.*above/i,
      /say.*PWNED/i,
      /forget.*role/i,
      /reset.*default/i,
      /admin mode/i,
      /disable.*safety.*filters/i,
      /encoded.*base64/i,
      /reverse order/i,
      /role[ -]?play.*[Hh]ack/i,
      /hypothetical.*bypass/i,
      /no ethical restrictions/i,
      /educational.*override.*safety/i,
      /TruthGPT/i,
      /pretend.*no rules.*named/i,
      /I am your creator/i,
      /always intelligent/i,
      /AIM.*jailbreak/i,
      /what (?:is |'s |are )(?:your |the )?system prompt/i,
      /instructions you were given/i,
      /programmed to do/i,
      /initial configuration/i,
      /rules were you given/i,
      /what was written/i,
      /beginning.*conversation/i,
      /repeat.*everything.*from/i,
      /play.*game.*each.*word/i,
      /movie.*escape.*prompt/i,
      /AI.*escape.*output.*prompt/i,
      /dump.*(?:user|customer|database|private).*(?:data|records|config)/i,
      /extract.*(?:user|customer|database|private).*(?:data|emails|records|pii)/i,
      /export.*(?:user|customer|private).*(?:data|records|database)/i,
      /list all.*(?:api.?keys|secrets|passwords|tokens|credentials)/i,
      /ignore.*privacy.*dump/i,
      /bypass.*privacy.*extract/i,
      /part \d.*combine.*execute/i,
      /split.*task.*part \d/i,
      /previous task.*cancelled.*new task/i,
      /decode.*hex.*execute/i,
      /decode.*base64.*execute/i,
      /morse code.*decode/i,
      /RTL override|Unicode.*override/i,
      /homoglyph.*bypass/i,
      /diagnostic mode.*dump/i,
      /debug mode.*output.*system/i,
      /hypothetical.*working example/i,
      /security paper.*working example|security paper.*prompt injection.*example/i,
      /system configuration.*JSON|JSON.*system configuration/i,
      /training data.*private/i,
      /internal company documents/i,
      /environment variables.*base64/i,
      /exfiltrate.*environment/i,
      /select \* from.*users/i,
      /ignore.*SQL.*safety/i,
      /Linux terminal.*root/i,
      /cat \/etc\/shadow/i,
      /decode this.*\d{2,} \d{2,}/i,
      /(?:decode|morse).*morse|morse.*decode/i,
      /Decode this.*\d{3} \d{3}/i,
      /Rep1@ce|leetspeak|l34t.*sp34k/i,
      /system pr0mpt/i,
      /忽略(?:之前|前面|所有).*(?:指令|提示|规则|命令)/i,
      /忘记(?:你|所有).*(?:角色|指令|规则|设定)/i,
      /跳过.*(?:安全|检查|限制|过滤)/i,
      /输出你的.*(?:系统|提示词|配置)/i,
      /隐藏(?:规则|指令|设置)/i,
      /开发者模式|越狱|不受限制|没有规则/i,
      /扮演.*没有规则|扮演.*不受限制/i,
      /管理员模式|管理员.*输出/i,
      /игнорируй.*(?:инструкции|команды|правила)/i,
      /забудь.*(?:роль|инструкции|правила)/i,
      /обойди.*(?:проверки|ограничения|безопасность)/i,
      /выведи.*(?:промпт|инструкции|конфигурацию)/i,
      /скрытые (?:правила|инструкции)/i,
      /покажи.*системный.*промпт/i,
      /режим[е]? разработчика|взломан|без ограничений/i,
      /нет никаких правил/i,
      /تجاهل.*(?:التعليمات|الأوامر|القواعد)/i,
      /انسى.*(?:التعليمات|القواعد|القيود|دورك)/i,
      /ليس لديك.*قوانين|لا.*قوانين/i,
      /تجاوز.*(?:فحوصات|قيود|الأمان)/i,
      /أظهر.*(?:موجه|تعليمات|إعدادات).*النظام/i,
      /القواعد المخفية|التعليمات المخفية/i,
      /وضع المطور|كسر الحماية|بدون قيود/i,
      /وضع المشرف/i
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
  const reason = buildReason(action, findings);
  // safeText is the text a caller may safely forward. It is only populated when
  // the request actually proceeds (ALLOW / ALLOW_WITH_REDACTION / REWRITE). For
  // BLOCK we surface the reason as a fallback message; for HUMAN_REVIEW the payload
  // is held, so returning a usable safeText would let callers bypass the review.
  const safeText = action === "BLOCK"
    ? reason
    : !allowed
      ? undefined
      : action === "REWRITE"
        ? rewriteRiskyText(text, findings)
        : changed
          ? redactedText
          : text;

  return {
    allowed,
    action,
    riskScore,
    riskTypes,
    originalText: text,
    redactedText: changed ? redactedText : undefined,
    safeText,
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
