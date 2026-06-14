import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  { pattern: /\bDAN\b/i, label: "DAN jailbreak", message: "Known jailbreak persona token detected.", severity: "HIGH", score: 35 },
  { pattern: /(?:enter|enable|activate|switch to|you are now in|answer in) (?:the )?(?:developer|unfiltered|uncensored|free) mode\b/i, label: "Unrestricted mode", message: "Requests an unrestricted operating mode.", severity: "HIGH", score: 35 },
  { pattern: /\b(?:no restrictions?|jailbreak|bypass safety)\b/i, label: "Safety bypass", message: "Explicit safety bypass language detected.", severity: "HIGH", score: 35 },
  { pattern: /pretend you are not an AI/i, label: "Identity bypass", message: "Attempts to bypass controls through role play.", severity: "MEDIUM", score: 30 },
  { pattern: /answer without (?:policy|rules?|restrictions?)/i, label: "Policy-free answer", message: "Requests a response without policy constraints.", severity: "HIGH", score: 35 },
];

export function jailbreakDetector(text: string) {
  return detectPatterns(text, "JAILBREAK", rules);
}
