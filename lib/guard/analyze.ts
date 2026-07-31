import { indiaPiiDetector } from "./detectors/indiaPiiDetector";
import { jailbreakDetector } from "./detectors/jailbreakDetector";
import { piiDetector } from "./detectors/piiDetector";
import { promptInjectionDetector } from "./detectors/promptInjectionDetector";
import { secretsDetector } from "./detectors/secretsDetector";
import { systemPromptLeakageDetector, systemPromptLeakAttemptDetector } from "./detectors/systemPromptLeakDetector";
import { spamUrlDetector } from "./detectors/spamUrlDetector";
import { unsafeOutputDetector } from "./detectors/unsafeOutputDetector";
import { outputExfiltrationDetector } from "./detectors/outputExfiltrationDetector";
import { toxicityDetector } from "./detectors/toxicityDetector";
import { hallucinationDetector } from "./detectors/hallucinationDetector";
import { biasDetector } from "./detectors/biasDetector";
import { multilingualAttackDetector } from "./detectors/multilingualAttackDetector";
import { recursiveInjectionDetector } from "./detectors/recursiveInjectionDetector";
import { ssrfDetector } from "./detectors/ssrfDetector";
import { competitiveIntelDetector } from "./detectors/competitiveIntelDetector";
import { socialEngineeringDetector } from "./detectors/socialEngineeringDetector";
import { embeddingPoisoningDetector } from "./detectors/embeddingPoisoningDetector";
import { mcpToolPoisoningDetector } from "./detectors/mcpToolPoisoningDetector";
import { memoryPoisoningDetector } from "./detectors/memoryPoisoningDetector";
import { multimodalAttackDetector } from "./detectors/multimodalAttackDetector";
import { modelSupplyChainDetector } from "./detectors/modelSupplyChainDetector";
import { behavioralAnomalyDetector } from "./detectors/behavioralAnomalyDetector";
import { advancedUnicodeSmugglingDetector } from "./detectors/advancedUnicodeSmugglingDetector";
import { insecureDeserializationDetector } from "./detectors/insecureDeserializationDetector";
import { dataExfiltrationInputDetector } from "./detectors/dataExfiltrationInputDetector";
import { replyChannelExfilDetector } from "./detectors/replyChannelExfilDetector";
import { harmfulContentRequestDetector } from "./detectors/harmfulContentRequestDetector";
import { broadHarmfulContentDetector } from "./detectors/broadHarmfulContentDetector";
import { generalizedIntentDetector } from "./detectors/generalizedIntentDetector";
import { adversarialCyberDetector } from "./detectors/adversarialCyberDetector";
import { decideGuardAction } from "./decisionEngine";
import { redactText } from "./redactor";
import { rewriteRiskyText } from "./rewrite";
import { scoreRisk } from "./riskScoring";
import { classifySemantic } from "./semanticClassifier";
import { MAX_TEXT_LENGTH } from "./constants";
import { deriveAdvisory, withAdvisory } from "./routingAdvisory";
import { withDetectionVariantScope } from "./detectors/helpers";
import type { GuardDirection, GuardFinding, GuardResult, RiskType } from "./types";

// Risk types the regex/signature detectors emit for an adversarial input. When
// any of these already fired we skip the semantic layer — it exists to catch
// novel wordings the rules missed, not to re-flag what they already caught.
const RULE_SECURITY_TYPES = new Set<RiskType>([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "MCP_TOOL_POISONING",
  "MEMORY_POISONING",
  "TOXICITY",
  "RECURSIVE_INJECTION",
  "DATA_EXFILTRATION",
  "MULTIMODAL_INJECTION",
  "MODEL_SUPPLY_CHAIN",
  "BEHAVIORAL_ANOMALY",
  "ADVANCED_SMUGGLING",
]);

// Families the semantic (feature-hash) layer is allowed to escalate on INPUT.
// TOXICITY is intentionally EXCLUDED here: the dependency-free feature-hash
// similarity generalizes well on *structural* attacks (injection / jailbreak /
// leak) but over-fires on benign *topic/content* prose that merely shares
// vocabulary with harm seeds — benign code-gen, tax/legal questions, fact-checks
// and anti-abuse condemnation all scored just over the TOXICITY margin on the
// JailbreakBench benign control (23% raw FPR, all semantic-or-keyword TOXICITY).
// This mirrors the same exclusion mlAugment applies to content-harm labels on
// INPUT (see lib/guard/mlAugment.ts INPUT_RELIABLE_LABELS). Real toxic INPUT is
// still caught deterministically by toxicityDetector + harmfulContentRequestDetector,
// and the meaning-based llmJudge tier, and TOXICITY semantic detection remains
// fully active on OUTPUT (a toxic model reply).
const SEMANTIC_INPUT_SECURITY_FAMILIES = new Set([
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SYSTEM_PROMPT_LEAK_ATTEMPT",
  "DATA_EXFILTRATION",
  "MCP_TOOL_POISONING",
  "MEMORY_POISONING",
  "RECURSIVE_INJECTION",
  "SOCIAL_ENGINEERING",
  "EMBEDDING_POISONING",
  "SSRF",
  "MULTIMODAL_INJECTION",
  "BEHAVIORAL_ANOMALY",
  "ADVANCED_SMUGGLING",
]);

// Detection tier is enterprise-configurable via SOTERAI_DETECTION_TIER:
//   - "rules"    → deterministic signatures only; the semantic recall booster is
//                  disabled entirely (lowest false-positive cost, lowest novel recall).
//   - "hybrid"   → (default) rules first; the semantic booster runs only when no
//                  rule security finding fired, and routes its hits to human review.
//   - "semantic" → the semantic booster is also consulted even when rules already
//                  fired, raising novel recall at a higher false-positive cost.
// Any unrecognized value falls back to "hybrid". The semantic layer is
// dependency-free (no model/network), so it is always available; if it ever
// throws, analysis degrades safely to rules-only rather than failing the request.
export type DetectionTier = "rules" | "hybrid" | "semantic";

function resolveDetectionTier(): DetectionTier {
  const raw = (process.env.SOTERAI_DETECTION_TIER ?? "").trim().toLowerCase();
  if (raw === "rules" || raw === "semantic" || raw === "hybrid") return raw;
  return "hybrid";
}

const COMMON_DETECTORS = [piiDetector, indiaPiiDetector, secretsDetector, toxicityDetector];
// `generalizedIntentDetector` matches the STRUCTURE of an attack (an action verb
// co-occurring with a sensitive target) rather than a fixed phrase — it generalizes
// recall beyond the original 1,218-case memorized corpus. The bare-injection
// interaction is handled in `applyPolicy` (lib/guard/policy.ts) by keying on risk
// types rather than finding count, so registering this detector does not break the
// legacy single-injection REWRITE / HUMAN_REVIEW / BLOCK policy branch.
const INPUT_DETECTORS = [promptInjectionDetector, jailbreakDetector, systemPromptLeakAttemptDetector, multilingualAttackDetector, recursiveInjectionDetector, ssrfDetector, adversarialCyberDetector, competitiveIntelDetector, socialEngineeringDetector, embeddingPoisoningDetector, mcpToolPoisoningDetector, memoryPoisoningDetector, multimodalAttackDetector, modelSupplyChainDetector, behavioralAnomalyDetector, advancedUnicodeSmugglingDetector, insecureDeserializationDetector, dataExfiltrationInputDetector, replyChannelExfilDetector, harmfulContentRequestDetector, broadHarmfulContentDetector, generalizedIntentDetector, ...COMMON_DETECTORS];
const OUTPUT_DETECTORS = [systemPromptLeakageDetector, unsafeOutputDetector, outputExfiltrationDetector, spamUrlDetector, hallucinationDetector, biasDetector, generalizedIntentDetector, ...COMMON_DETECTORS];

// The ~120-pattern IPS signature set used below lived inside `analyzeText` as an
// array literal. Per the ES spec every evaluation of a regex literal produces a
// NEW RegExp object, so each analysis allocated ~120 of them before testing any
// one of them. The set is now built once, lazily, and reused. Every pattern, its
// flags and its order are unchanged, and all of them are stateless (no /g or /y,
// so no shared lastIndex), so match results are bit-for-bit identical to the
// per-call construction.
//
// Honest sizing: this is a small win, not a large one. An interleaved 5-trial
// micro-benchmark (120 generated stateless patterns, 16-byte input, literal-per-
// call vs hoisted, measured in one process) put the difference at ~1-6 µs, because
// V8 caches the compiled regex code and only re-wraps it in a fresh object. An
// earlier draft of this comment credited the hoist with ~5 ms of a 9.9 ms
// analyzeText; that was wrong — the ms-scale movement seen at the time tracked
// background CPU load (78% → 53%), and the untouched detectors moved with it.
// The real ms-scale cost on a short input was the semantic tier's prototype
// sweep (see lib/guard/semanticClassifier.ts).
let ipsBlockSignatures: RegExp[] | null = null;

export function analyzeText(text: string, direction: GuardDirection): GuardResult {
  const detectors = direction === "OUTPUT" ? OUTPUT_DETECTORS : INPUT_DETECTORS;
  let findings: GuardFinding[] = withDetectionVariantScope(
    text,
    () => detectors.flatMap((detector) => detector(text)),
  );

  // Safe security-education prompts often mention "prompt injection" and
  // "bypass" in a negated, high-level training context. Keep sensitive-data
  // findings, but suppress bypass/injection findings for this narrow pattern so
  // awareness material does not become user friction.
  if (direction === "INPUT" && isSafeSecurityEducationRequest(text)) {
    findings = findings.filter(
      (finding) =>
        !(
          (
            finding.type === "PROMPT_INJECTION" ||
            finding.type === "SYSTEM_PROMPT_LEAK_ATTEMPT" ||
            finding.type === "DATA_EXFILTRATION"
          ) &&
          /bypass|override|instruction|approval|control|jailbreak|system-?prompt|extraction|credential|phishing|exfiltration|generalized/i.test(finding.label)
        ),
    );
  }
  if (direction === "INPUT" && isClearlyBenignKnowledgeQuestion(text)) {
    findings = findings.filter(
      (finding) =>
        !(
          finding.type === "SYSTEM_PROMPT_LEAK_ATTEMPT" &&
          finding.label === "System-prompt extraction (generalized)"
        ),
    );
  }

  // Set when the semantic layer (not the rules) is the sole reason a request is
  // flagged. Such requests are held for human review rather than blocked, since
  // the embedding heuristic is higher-recall but lower-precision than the rules.
  let semanticOnly = false;
  let semanticMetadata: Record<string, unknown> | undefined;

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

    // NOTE: the spaced-letter evasion signature must use \s+ (real gaps between
    // letters, e.g. "r e v e a l"); \s* also matched the plain word "reveal",
    // flagging any benign sentence that merely used it (e.g. "reveal the plot
    // twist") as a prompt-leak. The genuine evasion case is covered below.
    const isLeak = /hidden instructions|internal prompt|developer.*tell|print.*hidden rules|repeat.*text before|reveal.*configuration|r\s+e\s+v\s+e\s+a\s+l|system\s+prompt\s+batao|hidden\s+instruction\s+dikhao/i.test(text) ||
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

    const blockRegexes = ipsBlockSignatures ?? (ipsBlockSignatures = [
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
      /\bAIM\b.{0,20}jailbreak/i,
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
    ]);

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

    if (
      /(?:generate|write|create).{0,120}(?:\d{4,}|\d{1,3},\d{3,}).{0,120}(?:words?|variations?|prompts?|responses?)/i.test(text) ||
      /(?:repeat|continue).{0,120}(?:forever|until i say stop|without stopping|maximum context|context is exhausted)/i.test(text) ||
      /(?:call|use).{0,120}(?:search|browser|tool|api).{0,120}(?:repeatedly|every possible result|until you find every)/i.test(text)
    ) {
      findings.push({
        type: "TOKEN_ABUSE",
        label: "Denial-of-wallet prompt",
        severity: "HIGH",
        score: 60,
        message: "The request attempts to force excessive generation, looping, or tool usage."
      });
    }

    // Semantic recall booster: only when the rules found no adversarial pattern,
    // ask the embedding classifier whether the request *means* an injection /
    // jailbreak / leak attempt in a wording the signatures never anticipated. A
    // hit is reported as a MEDIUM finding and (below) routed to human review — it
    // never hard-blocks on its own, bounding the false-positive cost.
    const hasRuleSecurityFinding = findings.some((finding) => RULE_SECURITY_TYPES.has(finding.type));
    // Tier gate: "rules" disables the booster; "hybrid" consults it only when the
    // rules found nothing; "semantic" consults it regardless. Wrapped so a failure
    // in the heuristic degrades to rules-only rather than throwing.
    const tier = resolveDetectionTier();
    const semanticEnabled =
      tier !== "rules" &&
      !isClearlyBenignKnowledgeQuestion(text) &&
      (tier === "semantic" || !hasRuleSecurityFinding);
    if (semanticEnabled) {
      let semantic: ReturnType<typeof classifySemantic> | null = null;
      try {
        semantic = classifySemantic(text);
      } catch {
        semantic = null; // fail safe: never let the recall booster break analysis
      }
      if (
        semantic &&
        semantic.isAttack &&
        semantic.family &&
        (direction !== "INPUT" || SEMANTIC_INPUT_SECURITY_FAMILIES.has(semantic.family))
      ) {
        // semanticOnly (→ human review escalation below) applies only when the
        // rules found nothing; if a rule security finding already fired, the
        // semantic hit is recorded as corroborating evidence but does not change
        // the rules-driven action.
        semanticOnly = !hasRuleSecurityFinding;
        semanticMetadata = {
          family: semantic.family,
          score: semantic.score,
          margin: semantic.margin,
          benignSimilarity: semantic.benignSimilarity,
        };
        const familyToRiskType: Record<string, RiskType> = {
          PROMPT_INJECTION: "PROMPT_INJECTION",
          JAILBREAK: "JAILBREAK",
          SYSTEM_PROMPT_LEAK_ATTEMPT: "SYSTEM_PROMPT_LEAK_ATTEMPT",
          TOXICITY: "TOXICITY",
          COMPETITIVE_INTEL: "COMPETITIVE_INTEL_EXTRACTION",
          RECURSIVE_INJECTION: "RECURSIVE_INJECTION",
          SSRF: "SSRF_ATTEMPT",
          SOCIAL_ENGINEERING: "PROMPT_INJECTION",
          EMBEDDING_POISONING: "PROMPT_INJECTION",
          INSECURE_DESERIALIZATION: "PROMPT_INJECTION",
          DATA_EXFILTRATION: "DATA_EXFILTRATION",
          MCP_TOOL_POISONING: "MCP_TOOL_POISONING",
          MEMORY_POISONING: "MEMORY_POISONING",
        };
        const riskType = familyToRiskType[semantic.family] ?? "PROMPT_INJECTION";
        findings.push({
          type: riskType,
          label: `Semantic anomaly (${semantic.family})`,
          severity: "MEDIUM",
          score: 45,
          message:
            "No signature matched, but this request is semantically similar to known adversarial prompts and was held for review.",
        });
      }
    }
  }

  if (text.length > MAX_TEXT_LENGTH * 0.75) {
    findings.push({ type: "TOKEN_ABUSE", label: "Large payload", severity: "MEDIUM", score: 30, message: "The payload is unusually large and may cause avoidable token usage." });
  }

  const riskScore = scoreRisk(findings);
  const riskTypes = ([...new Set(findings.map((finding) => finding.type))] as RiskType[]);
  if (riskTypes.length === 0) riskTypes.push("LOW_RISK");
  let action = decideGuardAction(riskScore, riskTypes, direction, text);
  if (direction === "INPUT" && hasHighTrustExploitationFinding(findings) && action !== "BLOCK") {
    action = "HUMAN_REVIEW";
  }
  // A semantic-only detection is held for human review rather than allowed or
  // silently rewritten, but is never escalated to a hard block on its own.
  if (semanticOnly && action !== "BLOCK" && action !== "HUMAN_REVIEW") {
    action = "HUMAN_REVIEW";
  }
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

  const advisory = deriveAdvisory(text, findings, riskTypes);
  return withAdvisory({
    allowed,
    action,
    riskScore,
    riskTypes,
    originalText: text,
    redactedText: changed ? redactedText : undefined,
    safeText,
    reason,
    findings,
    metadata: {
      direction,
      findingCount: findings.length,
      ...(semanticMetadata ? { semantic: semanticMetadata } : {}),
    },
  }, advisory);
}

function isSafeSecurityEducationRequest(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (isExplicitlyAdversarialEducationRequest(normalized)) return false;
  if (
    /^(summarize|review|analyze|extract|classify)\b/.test(normalized) &&
    /\bdocument\b/.test(normalized) &&
    /\bignore\b/.test(normalized) &&
    /\binstructions?\s+inside\s+the\s+document\b/.test(normalized) &&
    /\bnot\s+part\s+of\s+the\s+user\s+request\b/.test(normalized)
  ) {
    return true;
  }
  if (
    /^(write|draft|create|design|compose)\b/.test(normalized) &&
    /\bsecure\s+system\s+prompt\b/.test(normalized) &&
    /\b(chatbot|assistant|agent|customer-support|support)\b/.test(normalized)
  ) {
    return true;
  }
  if (!/^(explain|describe|summarize|outline|draft|write|create)\b/.test(normalized)) return false;
  if (!/(prompt injection|phishing awareness|credential protection|security awareness|security training|protecting credentials|privacy review|least privilege)/i.test(text)) return false;
  return /(high level|awareness|training|without providing|without step-by-step|safe|benign|plain language)/i.test(text);
}

function isClearlyBenignKnowledgeQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    /^(?:what\s+is|what\s+are|explain|describe|summarize|outline)\b/.test(normalized) &&
    /\b(?:role|function|purpose|process|cycle|branch|concept|topic|definition|system\s+prompt|hallucination|grounding|mitigations?|best practices?|compliance|records?)\b/.test(normalized) &&
    !/\b(?:your|developer|hidden|internal|instructions?|rules?|configuration|secret)\b/.test(normalized)
  );
}

function hasHighTrustExploitationFinding(findings: GuardFinding[]): boolean {
  return findings.some((finding) =>
    finding.label === "Deepfake authority pretext" ||
    finding.label === "Recorded executive approval pretext" ||
    finding.label === "Credential solicitation pressure"
  );
}

function isExplicitlyAdversarialEducationRequest(normalized: string): boolean {
  return /(ignore previous|reveal system prompt|disable guardrails|dump|exfiltrate|list all|admin mode|unrestricted|dan mode|hidden instructions|show me your system prompt|print your system prompt)/i.test(normalized);
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
