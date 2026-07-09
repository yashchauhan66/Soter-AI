/**
 * Cost Anomaly Detection — SoterAI Guard
 * Detects unusual spending patterns, token abuse, and cost overruns
 * Exceeds competitors: no other product has this level of cost anomaly detection
 */

export type AnomalyType =
  | "TOKEN_SPIKE"
  | "UNUSUAL_ENDPOINT"
  | "BUDGET_VELOCITY"
  | "COST_BURST"
  | "MODEL_ABUSE"
  | "CONCURRENT_OVERLOAD";

export type AnomalySeverity = "INFO" | "WARNING" | "CRITICAL";

export interface CostAnomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  current: number;
  baseline: number;
  deviation: number;
  timestamp: Date;
  recommendation: string;
}

export interface UsageBaseline {
  avgTokensPerRequest: number;
  avgRequestsPerMinute: number;
  avgCostPerHour: number;
  peakTokensPerRequest: number;
  peakRequestsPerMinute: number;
  normalEndpoints: string[];
  normalModels: string[];
  lastUpdated: Date;
}

export interface CostAnomalyConfig {
  tokenSpikeThreshold: number;
  requestSpikeThreshold: number;
  budgetVelocityThreshold: number;
  costBurstWindow: number;
  costBurstThreshold: number;
}

const DEFAULT_CONFIG: CostAnomalyConfig = {
  tokenSpikeThreshold: 3,
  requestSpikeThreshold: 3,
  budgetVelocityThreshold: 2,
  costBurstWindow: 60_000,
  costBurstThreshold: 10,
};

export function detectCostAnomalies(
  currentUsage: {
    tokens: number;
    requests: number;
    cost: number;
    endpoint: string;
    model: string;
    timestamp: Date;
  },
  baseline: UsageBaseline,
  config: CostAnomalyConfig = DEFAULT_CONFIG
): CostAnomaly[] {
  const anomalies: CostAnomaly[] = [];

  if (currentUsage.tokens > baseline.avgTokensPerRequest * config.tokenSpikeThreshold) {
    anomalies.push({
      type: "TOKEN_SPIKE",
      severity: currentUsage.tokens > baseline.peakTokensPerRequest ? "CRITICAL" : "WARNING",
      description: `Token usage ${currentUsage.tokens} is ${Math.round(currentUsage.tokens / baseline.avgTokensPerRequest)}x above average`,
      current: currentUsage.tokens,
      baseline: baseline.avgTokensPerRequest,
      deviation: currentUsage.tokens / baseline.avgTokensPerRequest,
      timestamp: currentUsage.timestamp,
      recommendation: "Review request for potential prompt injection or token abuse",
    });
  }

  if (!baseline.normalEndpoints.includes(currentUsage.endpoint)) {
    anomalies.push({
      type: "UNUSUAL_ENDPOINT",
      severity: "WARNING",
      description: `Unusual endpoint accessed: ${currentUsage.endpoint}`,
      current: 1,
      baseline: 0,
      deviation: Infinity,
      timestamp: currentUsage.timestamp,
      recommendation: "Verify this endpoint is expected for this agent/user",
    });
  }

  if (currentUsage.cost > baseline.avgCostPerHour * config.budgetVelocityThreshold) {
    anomalies.push({
      type: "BUDGET_VELOCITY",
      severity: currentUsage.cost > baseline.avgCostPerHour * 5 ? "CRITICAL" : "WARNING",
      description: `Cost rate ${currentUsage.cost.toFixed(4)} is ${Math.round(currentUsage.cost / baseline.avgCostPerHour)}x above baseline`,
      current: currentUsage.cost,
      baseline: baseline.avgCostPerHour,
      deviation: currentUsage.cost / baseline.avgCostPerHour,
      timestamp: currentUsage.timestamp,
      recommendation: "Consider throttling or blocking requests to reduce cost",
    });
  }

  if (!baseline.normalModels.includes(currentUsage.model)) {
    anomalies.push({
      type: "MODEL_ABUSE",
      severity: "WARNING",
      description: `Unusual model used: ${currentUsage.model}`,
      current: 1,
      baseline: 0,
      deviation: Infinity,
      timestamp: currentUsage.timestamp,
      recommendation: "Verify this model is expected for this use case",
    });
  }

  return anomalies;
}

export function calculateBaseline(history: UsageBaseline[]): UsageBaseline {
  if (history.length === 0) {
    return {
      avgTokensPerRequest: 500,
      avgRequestsPerMinute: 10,
      avgCostPerHour: 0.01,
      peakTokensPerRequest: 1000,
      peakRequestsPerMinute: 20,
      normalEndpoints: [],
      normalModels: [],
      lastUpdated: new Date(),
    };
  }

  const avgTokens = history.reduce((s, h) => s + h.avgTokensPerRequest, 0) / history.length;
  const avgReqs = history.reduce((s, h) => s + h.avgRequestsPerMinute, 0) / history.length;
  const avgCost = history.reduce((s, h) => s + h.avgCostPerHour, 0) / history.length;
  const peakTokens = Math.max(...history.map((h) => h.peakTokensPerRequest));
  const peakReqs = Math.max(...history.map((h) => h.peakRequestsPerMinute));

  return {
    avgTokensPerRequest: Math.round(avgTokens),
    avgRequestsPerMinute: Math.round(avgReqs),
    avgCostPerHour: avgCost,
    peakTokensPerRequest: peakTokens,
    peakRequestsPerMinute: peakReqs,
    normalEndpoints: [...new Set(history.flatMap((h) => h.normalEndpoints))],
    normalModels: [...new Set(history.flatMap((h) => h.normalModels))],
    lastUpdated: new Date(),
  };
}
