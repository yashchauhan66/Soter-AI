import { detectPatterns, type PatternRule } from "./helpers";

const inputRules: PatternRule[] = [
  { pattern: /(?:show|reveal|print|expose|repeat|what\s+(?:is|are)) (?:your |the )?(?:hidden |confidential |internal |developer |system )*(?:prompt|message|instructions?|rules?|configuration)/i, label: "System prompt request", message: "Requests confidential model instructions.", severity: "HIGH", score: 45 },
  { pattern: /(?:show|reveal|print|repeat) (?:all of )?your instructions?/i, label: "Instruction disclosure request", message: "Requests the assistant's confidential instructions.", severity: "HIGH", score: 45 },
  { pattern: /what are your internal rules/i, label: "Internal rule request", message: "Requests internal control rules.", severity: "HIGH", score: 45 },
  { pattern: /repeat the text (?:above|before)/i, label: "Context extraction", message: "May attempt to extract hidden preceding context.", severity: "HIGH", score: 45 },
  { pattern: /expose your policies/i, label: "Policy extraction", message: "Requests non-public policy context.", severity: "HIGH", score: 45 },
  { pattern: /(?:show|print|repeat) (?:every|all) instructions? (?:that )?(?:appeared|came) before/i, label: "Preceding instruction extraction", message: "Requests hidden instructions from preceding context.", severity: "HIGH", score: 45 },
  { pattern: /what did the developer tell you/i, label: "Developer instruction request", message: "Requests developer prompt settings.", severity: "HIGH", score: 45 },
  { pattern: /show me the instructions? (?:you were given|given to you)/i, label: "Instructions request", message: "Requests the assistant's instructions.", severity: "HIGH", score: 45 },
  { pattern: /what were you programmed (?:to do|for)/i, label: "Programming query", message: "Queries the assistant's programming/configuration.", severity: "HIGH", score: 45 },
  { pattern: /(?:tell me|show me|reveal|what is) your (?:initial|original|base) (?:configuration|setup|prompt|programming)/i, label: "Configuration request", message: "Requests the assistant's initial configuration.", severity: "HIGH", score: 45 },
  { pattern: /what rules? (?:were you given|do you have|did you get|were you provided) (?:at |in )?(?:the start|the beginning)/i, label: "Rules extraction", message: "Requests the rules provided at initialization.", severity: "HIGH", score: 45 },
  { pattern: /what (?:is |'s |are )your system prompt/i, label: "System prompt query", message: "Direct query about the system prompt.", severity: "HIGH", score: 45 },
  { pattern: /what['’]s (?:your |the )system prompt/i, label: "System prompt query", message: "Direct query about the system prompt.", severity: "HIGH", score: 45 },
  { pattern: /tell me your (?:system prompt|initial instructions?|original prompt)/i, label: "System prompt disclosure", message: "Requests disclosure of system prompt.", severity: "HIGH", score: 45 },
  { pattern: /(?:show|tell|reveal|share) (?:me )?(?:what )?(?:the |your )?(?:system |hidden |initial )?(?:instructions?|prompt|rules?|guidelines?)(?: you were given)?/i, label: "Prompt disclosure request", message: "Requests disclosure of system instructions.", severity: "HIGH", score: 45 },
];

const outputRules: PatternRule[] = [
  { pattern: /\b(?:system prompt|developer message|hidden instructions?|internal policy|confidential instructions?|assistant instructions?)\s*(?:is\b)?\s*:/i, label: "System instruction disclosure", message: "The output appears to disclose internal instructions.", severity: "CRITICAL", score: 60 },
  { pattern: /\b(?:the )?(?:hidden |confidential )?(?:system prompt|developer message|hidden instructions?|internal policy|confidential instructions?|assistant instructions?)\s+(?:is|are|says|contains)\b/i, label: "System instruction disclosure", message: "The output appears to disclose internal instructions.", severity: "CRITICAL", score: 60 },
  { pattern: /you are ChatGPT with instructions/i, label: "Prompt disclosure phrase", message: "The output resembles leaked model setup text.", severity: "CRITICAL", score: 60 },
  { pattern: /["']?(?:system_prompt|developer_message|hidden_instructions)["']?\s*[:=]/i, label: "Structured prompt disclosure", message: "The output appears to expose internal instructions in a structured format.", severity: "CRITICAL", score: 60 },
  { pattern: /<(?:system|developer|instructions)>[\s\S]{1,2000}<\/(?:system|developer|instructions)>/i, label: "Tagged prompt disclosure", message: "The output appears to expose tagged internal instructions.", severity: "CRITICAL", score: 60 },
];

export function systemPromptLeakAttemptDetector(text: string) {
  return detectPatterns(text, "SYSTEM_PROMPT_LEAK_ATTEMPT", inputRules);
}

export function systemPromptLeakageDetector(text: string) {
  return detectPatterns(text, "SYSTEM_PROMPT_LEAKAGE", outputRules);
}
