import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  {
    pattern:
      /[\u202A-\u202E\u2066-\u2069\u200B-\u200F\uFEFF\u034F\u061C\u180B-\u180F]/,
    label: "Invisible Unicode smuggling",
    message: "Invisible or bidirectional Unicode control characters were detected in untrusted input.",
    severity: "MEDIUM",
    score: 35,
  },
  {
    pattern:
      /(?:unicode|homoglyph|confusable|zero-width|bidi|rtl override|variation selector|tag character)[\s\S]{0,160}(?:bypass|hide|smuggle|invisible|instruction|prompt)/i,
    label: "Advanced Unicode smuggling",
    message: "The request indicates an attempt to hide or smuggle instructions with Unicode tricks.",
    severity: "HIGH",
    score: 45,
  },
];

export function advancedUnicodeSmugglingDetector(text: string) {
  return detectPatterns(text, "ADVANCED_SMUGGLING", rules);
}
