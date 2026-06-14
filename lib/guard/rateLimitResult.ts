import type { GuardResult } from "./types";

export function createRateLimitResult(reason: string): GuardResult {
  return {
    allowed: false,
    action: "BLOCK",
    riskScore: 30,
    riskTypes: ["RATE_LIMIT"],
    reason,
    findings: [
      {
        type: "RATE_LIMIT",
        label: "Usage limit exceeded",
        severity: "MEDIUM",
        score: 30,
        message: reason,
      },
    ],
  };
}
