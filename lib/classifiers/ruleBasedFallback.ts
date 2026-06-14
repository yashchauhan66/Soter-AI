import { analyzeText } from "../guard/analyze";
import type { ClassifierResult, TextClassifier } from "./types";

export class RuleBasedFallbackClassifier implements TextClassifier {
  async classify(text: string): Promise<ClassifierResult> {
    const result = analyzeText(text, "INPUT");
    const malicious = result.action === "BLOCK";
    const suspicious = result.riskScore >= 30;
    return {
      label: malicious ? "MALICIOUS" : suspicious ? "SUSPICIOUS" : "SAFE",
      confidence: Math.min(0.99, Math.max(0.55, result.riskScore / 100)),
      explanation: result.reason,
      riskType: result.riskTypes[0] ?? "LOW_RISK",
      recommendedAction: malicious ? "BLOCK" : suspicious ? "REVIEW" : "ALLOW",
      source: "rule-based",
    };
  }
}
