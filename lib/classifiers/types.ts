export type ClassifierLabel = "SAFE" | "SUSPICIOUS" | "MALICIOUS";

export interface ClassifierResult {
  label: ClassifierLabel;
  confidence: number;
  explanation: string;
  riskType: string;
  recommendedAction: "ALLOW" | "REVIEW" | "BLOCK";
  source: "semantic" | "multilingual" | "rule-based";
}

export interface TextClassifier {
  classify(text: string): Promise<ClassifierResult>;
}
