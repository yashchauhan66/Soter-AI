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
];

export function detectPromptInjection(text: string): DetectorFinding[] {
  return runRegexDetectors(text, PROMPT_INJECTION_SPECS);
}
