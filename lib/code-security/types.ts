export const CODE_REVIEW_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type CodeReviewSeverity = (typeof CODE_REVIEW_SEVERITIES)[number];

export const CODE_REVIEW_CATEGORIES = [
  "SECRETS",
  "AUTHORIZATION",
  "INJECTION",
  "CRYPTOGRAPHY",
  "DATA_EXPOSURE",
  "SECURITY_CONFIG",
  "AI_BOUNDARY",
] as const;
export type CodeReviewCategory = (typeof CODE_REVIEW_CATEGORIES)[number];

export type CodeReviewContext = {
  environment: "development" | "staging" | "production";
  internetExposed: boolean;
  handlesSensitiveData: boolean;
  containsAuthCode: boolean;
  aiGenerated: boolean;
};

export type CodeReviewFinding = {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  remediation: string;
  severity: CodeReviewSeverity;
  category: CodeReviewCategory;
  line: number;
  evidence: string;
  standards: string[];
};

export type CodeReviewResult = {
  reviewId: string;
  generatedAt: string;
  decision: "PASS" | "REVIEW" | "FAIL";
  riskScore: number;
  summary: string;
  findings: CodeReviewFinding[];
  counts: Record<CodeReviewSeverity, number>;
  context: CodeReviewContext;
  metadata: {
    filename: string;
    language: string;
    linesReviewed: number;
    engineVersion: string;
    contentStored: false;
  };
  compliance: Array<{
    framework: string;
    status: "PASS" | "ATTENTION";
    controls: string[];
    note: string;
  }>;
  disclaimer: string;
};
