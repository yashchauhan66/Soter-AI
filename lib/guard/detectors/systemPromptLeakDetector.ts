import { detectPatterns, type PatternRule } from "./helpers";

const inputRules: PatternRule[] = [
  { pattern: /(?:show|reveal|print|expose|repeat) (?:your |the )?(?:hidden |confidential )?(?:system|initial|developer|hidden) (?:prompt|message|instructions?)/i, label: "System prompt request", message: "Requests confidential model instructions.", severity: "HIGH", score: 45 },
  { pattern: /(?:show|reveal|print|repeat) (?:all of )?your instructions?/i, label: "Instruction disclosure request", message: "Requests the assistant's confidential instructions.", severity: "HIGH", score: 45 },
  { pattern: /what are your internal rules/i, label: "Internal rule request", message: "Requests internal control rules.", severity: "HIGH", score: 45 },
  { pattern: /repeat the text above/i, label: "Context extraction", message: "May attempt to extract hidden preceding context.", severity: "HIGH", score: 45 },
  { pattern: /expose your policies/i, label: "Policy extraction", message: "Requests non-public policy context.", severity: "HIGH", score: 45 },
  { pattern: /(?:show|print|repeat) (?:every|all) instructions? (?:that )?(?:appeared|came) before/i, label: "Preceding instruction extraction", message: "Requests hidden instructions from preceding context.", severity: "HIGH", score: 45 },
];

const outputRules: PatternRule[] = [
  { pattern: /\b(?:system prompt|developer message|hidden instructions?|internal policy|confidential instructions?|assistant instructions?)\s*:/i, label: "System instruction disclosure", message: "The output appears to disclose internal instructions.", severity: "CRITICAL", score: 60 },
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
