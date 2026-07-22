import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  {
    pattern:
      /(?:image|screenshot|photo|pdf|audio|transcript|ocr|alt text|metadata)[\s\S]{0,180}(?:ignore|override|bypass|reveal|exfiltrate|system prompt|hidden instruction|developer message)/i,
    label: "Multimodal prompt injection",
    message: "Untrusted multimodal content appears to contain hidden agent-steering instructions.",
    severity: "HIGH",
    score: 50,
  },
  {
    pattern:
      /(?:hidden|invisible|tiny|white text|same color|metadata|steganograph)[\s\S]{0,160}(?:instruction|prompt|command|system message|tool call)/i,
    label: "Hidden multimodal instruction",
    message: "The payload describes hidden instructions embedded in a non-text or rendered artifact.",
    severity: "HIGH",
    score: 45,
  },
];

export function multimodalAttackDetector(text: string) {
  return detectPatterns(text, "MULTIMODAL_INJECTION", rules);
}
