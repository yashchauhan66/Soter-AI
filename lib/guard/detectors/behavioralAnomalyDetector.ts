import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  {
    pattern:
      /(?:suddenly|unexpectedly|without approval|without confirmation|without consent)[\s\S]{0,160}(?:delete|transfer|send|export|download|email|deploy|rotate|disable|escalate)/i,
    label: "Behavioral anomaly",
    message: "The request describes an unexpected high-risk action that should be reviewed.",
    severity: "HIGH",
    score: 45,
  },
  {
    pattern:
      /(?:new|unknown|never used|first time)[\s\S]{0,140}(?:tool|api|integration|credential|permission)[\s\S]{0,140}(?:admin|write|delete|payment|production|secrets?)/i,
    label: "New high-risk capability use",
    message: "The request combines a new capability with a sensitive or destructive operation.",
    severity: "HIGH",
    score: 45,
  },
];

export function behavioralAnomalyDetector(text: string) {
  return detectPatterns(text, "BEHAVIORAL_ANOMALY", rules);
}
