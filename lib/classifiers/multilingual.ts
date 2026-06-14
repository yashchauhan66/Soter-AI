import type { ClassifierResult, TextClassifier } from "./types";

// Phase 6: expanded Hindi / Hinglish signal patterns. These remain heuristic;
// the rule-based fallback continues to run, and the ML registry can shadow or
// promote a richer classifier on top. Patterns are conservative — they fire on
// adversarial instruction-override phrasing rather than benign user questions.
const hindiHinglishSignals = [
  // PROMPT_INJECTION — instruction override
  { pattern: /pichl[ei] (?:sabhi |saare )?(?:nirdesh|instructions?) (?:ignore|bhool|nazandaz|nazarandaz) karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /pichle instruction(?:s)? ignore karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /pehle (?:wale |ke )?instructions? (?:ignore|bhool)(?: karo)?/i, riskType: "PROMPT_INJECTION" },
  { pattern: /pehle ke (?:sabhi |saare )?nirdesh (?:ignore|bhool|nazarandaz) karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /tumhe jo rule(?:s)? diye gaye hain unhe ignore karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /upar wale (?:rules?|nirdesh) (?:ko )?ignore karke/i, riskType: "PROMPT_INJECTION" },
  { pattern: /developer instruction(?:s)? print karo/i, riskType: "PROMPT_INJECTION" },

  // JAILBREAK — bypass safeguards or unlock dev mode
  { pattern: /rules? (?:ko )?(?:bhool jao|ignore(?: karo)?|bypass karo)/i, riskType: "JAILBREAK" },
  { pattern: /tum ab (?:developer|dev|admin) mode me ho/i, riskType: "JAILBREAK" },
  { pattern: /policy (?:ko )?bypass karo/i, riskType: "JAILBREAK" },
  { pattern: /bina (?:kisi )?restriction ke jawab do/i, riskType: "JAILBREAK" },
  { pattern: /suraksha (?:niyam|rules) (?:hata do|tod do|bypass karo)/i, riskType: "JAILBREAK" },
  { pattern: /safety (?:ko )?bypass karke (?:jawab|response) do/i, riskType: "JAILBREAK" },

  // SYSTEM_PROMPT_LEAK_ATTEMPT — show hidden prompt / dev instructions
  { pattern: /(?:system|hidden) prompt (?:dikhao|batao|reveal karo)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /gupt (?:jaankari|jankari|nirdesh) (?:dikhao|batao)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /andar (?:ka|ke) (?:confidential |hidden )?(?:prompt|rules?|nirdesh) (?:dikha do|dikhao|batao)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },
  { pattern: /developer (?:instruction|prompt) (?:dikhao|batao|reveal karo)/i, riskType: "SYSTEM_PROMPT_LEAK_ATTEMPT" },

  // DATA_EXFILTRATION_ATTEMPT — try to extract org-private data
  { pattern: /private (?:data|documents?|information) (?:dikhao|bhejo|nikalo|reveal karo|share karo)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /admin data (?:dikhao|bhejo|reveal karo)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /private document(?:s)? ka content reveal karo/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
  { pattern: /confidential (?:file|file ka content|jaankari) (?:bhejo|dikhao|share karo)/i, riskType: "DATA_EXFILTRATION_ATTEMPT" },
];

function mapToLabel(riskType: string): "PROMPT_INJECTION" | "JAILBREAK" | "SYSTEM_PROMPT_LEAK_ATTEMPT" | "DATA_EXFILTRATION_ATTEMPT" | "LOW_RISK" {
  if (riskType === "PROMPT_INJECTION" || riskType === "JAILBREAK" || riskType === "SYSTEM_PROMPT_LEAK_ATTEMPT" || riskType === "DATA_EXFILTRATION_ATTEMPT") return riskType;
  return "LOW_RISK";
}

export class MultilingualClassifier implements TextClassifier {
  async classify(text: string): Promise<ClassifierResult> {
    const matched = hindiHinglishSignals.filter((signal) => signal.pattern.test(text));
    const matches = matched.length;
    const top = matched[0]?.riskType ?? "LOW_RISK";
    return {
      label: matches >= 2 ? "MALICIOUS" : matches === 1 ? "SUSPICIOUS" : "SAFE",
      confidence: matches ? Math.min(0.95, 0.7 + matches * 0.08) : 0.55,
      explanation: matches
        ? `Hindi/Hinglish risk heuristic matched (${matched.length} signal${matched.length === 1 ? "" : "s"}).`
        : "No Hindi/Hinglish risk heuristic matched.",
      riskType: mapToLabel(top),
      recommendedAction: matches ? "BLOCK" : "ALLOW",
      source: "multilingual",
    };
  }
}

export const __testing = { hindiHinglishSignals };
