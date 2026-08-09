import { runRegexDetectors, type DetectorFinding } from "./core";

const PROMPT_INJECTION_SPECS = [
  {
    type: "prompt_injection",
    label: "Prompt injection",
    severity: "high" as const,
    score: 26,
    pattern: /\b(ignore (?:all )?(?:previous|prior|above) instructions|developer mode|jailbreak|do anything now|DAN mode|reveal (?:the )?(?:system|developer) prompt|disable safety|bypass policy)\b/gi,
    message: "Prompt injection or jailbreak wording detected.",
  },
  {
    type: "prompt_injection",
    label: "Prompt injection",
    severity: "high" as const,
    score: 24,
    pattern: /\b(?:system|developer)\s*:\s*(?:you are|ignore|override)\b/gi,
    message: "Instruction-role override pattern detected.",
  },
  {
    type: "prompt_injection",
    label: "Jailbreak persona",
    severity: "high" as const,
    score: 26,
    pattern: /\b(?:DAN|jailbreak|unfiltered|no (?:ethics|restrictions|limits)|act as (?:an? )?(?:unrestricted|evil|uncensored))\b|forget (?:your )?(?:ethics|rules|instructions|safety)/gi,
    message: "Jailbreak persona or ethics-forgetting wording detected.",
  },
  {
    type: "prompt_injection",
    label: "Prompt injection (multilingual)",
    severity: "high" as const,
    score: 26,
    // Korean / Russian / Hindi / Chinese / Arabic / German etc. — "ignore previous instructions" + "system prompt"
    // Russian FIX: word-order flexible — "игнорируй предыдущие инструкции" OR "инструкции игнорируй" both match.
    pattern: /(?:이전|모든)?\s*(?:지시|규칙|명령).*(?:무시|잊어)|시스템\s*프롬프트|(?:игнор\w*|забуд\w*)[^\n]{0,40}(?:предыдущ\w*|инструкц\w*)|(?:предыдущ\w*|инструкц\w*)[^\n]{0,40}(?:игнор\w*|забуд\w*)|системн\w*\s*промпт|(?:पिछल|सभी)\s*(?:निर्देश|नियम).*(?:अनदेखा|भूल)|(?:忽略|无视).*(?:之前|以前|以上).*(?:指令|指示)|系统提示|(?:تجاهل|تجاوز).*(?:التعليمات|السابقة)|موجه\s*النظام|(?:ignorier|vergiss).*(?:anweisung|instruktion)/giu,
    message: "Multilingual prompt-injection wording detected.",
  },
  {
    type: "prompt_injection",
    label: "Prompt extraction",
    severity: "high" as const,
    score: 26,
    pattern: /\b(?:reveal|show|print|leak|display|tell me|expose)\b[^\n]{0,40}\b(?:system prompt|your instructions|hidden prompt|developer message|api keys?|credentials?)\b/gi,
    message: "Attempt to extract system prompt or credentials detected.",
  },
];


export function detectPromptInjection(text: string): DetectorFinding[] {
  return runRegexDetectors(text, PROMPT_INJECTION_SPECS);
}
