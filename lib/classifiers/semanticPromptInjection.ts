import type { ClassifierResult, TextClassifier } from "./types";

const semanticSignals = [
  /treat (?:this|the following) as (?:the )?(?:highest|system) priority/i,
  /instructions? (?:inside|within) (?:this|the) (?:document|context) (?:must|should) be followed/i,
  /do not mention (?:these|the) instructions?/i,
  /send (?:all|the) (?:context|documents?|data) to https?:\/\//i,
  /retrieve (?:private|confidential|other users?') (?:files?|documents?|records?)/i,
];

export class SemanticPromptInjectionClassifier implements TextClassifier {
  async classify(text: string): Promise<ClassifierResult> {
    const matches = semanticSignals.filter((pattern) => pattern.test(text)).length;
    const confidence = matches ? Math.min(0.95, 0.64 + matches * 0.1) : 0.58;
    return {
      label: matches >= 2 ? "MALICIOUS" : matches === 1 ? "SUSPICIOUS" : "SAFE",
      confidence,
      explanation: matches ? "Instruction hierarchy or data-exfiltration semantics were detected." : "No semantic injection heuristic matched.",
      riskType: matches ? "SEMANTIC_PROMPT_INJECTION" : "LOW_RISK",
      recommendedAction: matches >= 2 ? "BLOCK" : matches === 1 ? "REVIEW" : "ALLOW",
      source: "semantic",
    };
  }
}
