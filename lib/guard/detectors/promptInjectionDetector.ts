import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  { pattern: /ignore (?:all |any |the )?(?:previous|prior|above) instructions?/i, label: "Instruction override", message: "Attempts to supersede prior instructions.", severity: "HIGH", score: 40 },
  { pattern: /disregard (?:all |the )?(?:previous|prior|above|system) instructions?/i, label: "Instruction disregard", message: "Requests that earlier instructions be disregarded.", severity: "HIGH", score: 40 },
  { pattern: /(?:bypass|override) (?:the )?(?:assistant |system )?(?:rules|instructions?|safety|policy)/i, label: "Control bypass", message: "Attempts to bypass the assistant control layer.", severity: "HIGH", score: 40 },
  { pattern: /forget (?:all |your )?(?:previous )?instructions?/i, label: "Instruction reset", message: "Attempts to reset the assistant instructions.", severity: "HIGH", score: 40 },
  { pattern: /(?:you are now|new instructions?|follow my instructions? instead)/i, label: "Role or instruction replacement", message: "Attempts to replace the assistant role or instructions.", severity: "MEDIUM", score: 35 },
  { pattern: /(?:enter|enable|activate|switch to|you are now in) (?:the )?developer mode/i, label: "Developer mode override", message: "Requests a known instruction-override mode.", severity: "HIGH", score: 40 },
  { pattern: /(?:reveal hidden instructions?|show (?:the )?system prompt|act as unrestricted|do anything now)/i, label: "Hidden-control request", message: "Requests hidden instructions or unrestricted operation.", severity: "HIGH", score: 45 },
];

export function promptInjectionDetector(text: string) {
  return detectPatterns(text, "PROMPT_INJECTION", rules);
}
