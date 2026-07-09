/**
 * Agent Behavioral Baseline — SoterAI Guard
 * Defines "normal" agent behavior and detects anomalies
 * This is the #1 unsolved problem in the market (per AgentMarketCap 2026)
 * No competitor has a working behavioral baseline system
 */

export type BaselineMetric =
  | "TOOL_CALL_FREQUENCY"
  | "TOKEN_USAGE"
  | "SESSION_DURATION"
  | "DATA_VOLUME"
  | "ENDPOINT访问"
  | "ERROR_RATE"
  | "RISK_SCORE"
  | "CONCURRENT_SESSIONS";

export type DeviationLevel = "NORMAL" | "ELEVATED" | "HIGH" | "CRITICAL";

export interface BehavioralBaseline {
  agentId: string;
  metrics: Record<BaselineMetric, {
    mean: number;
    stdDev: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  }>;
  normalToolCalls: string[];
  normalEndpoints: string[];
  normalDataVolumeRange: [number, number];
  sessionDurationRange: [number, number];
  lastUpdated: Date;
  sampleSize: number;
}

export interface BehaviorObservation {
  agentId: string;
  timestamp: Date;
  metrics: Partial<Record<BaselineMetric, number>>;
  toolCalls: string[];
  endpoints: string[];
  dataVolume: number;
  sessionDuration: number;
}

export interface BehaviorDeviation {
  metric: BaselineMetric;
  level: DeviationLevel;
  observed: number;
  expected: number;
  zScore: number;
  description: string;
}

export interface BehaviorAnalysis {
  agentId: string;
  timestamp: Date;
  overallLevel: DeviationLevel;
  deviations: BehaviorDeviation[];
  anomalies: string[];
  recommendation: string;
}

function calculateZScore(observed: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (observed - mean) / stdDev;
}

function getDeviationLevel(zScore: number): DeviationLevel {
  const abs = Math.abs(zScore);
  if (abs < 1) return "NORMAL";
  if (abs < 2) return "ELEVATED";
  if (abs < 3) return "HIGH";
  return "CRITICAL";
}

export function analyzeBehavior(
  observation: BehaviorObservation,
  baseline: BehavioralBaseline
): BehaviorAnalysis {
  const deviations: BehaviorDeviation[] = [];
  const anomalies: string[] = [];

  for (const [metric, value] of Object.entries(observation.metrics) as [BaselineMetric, number][]) {
    const baselineMetric = baseline.metrics[metric];
    if (!baselineMetric || !value) continue;

    const zScore = calculateZScore(value, baselineMetric.mean, baselineMetric.stdDev);
    const level = getDeviationLevel(zScore);

    if (level !== "NORMAL") {
      deviations.push({
        metric,
        level,
        observed: value,
        expected: baselineMetric.mean,
        zScore,
        description: `${metric} is ${Math.abs(zScore).toFixed(1)} standard deviations from baseline`,
      });
    }
  }

  const newTools = observation.toolCalls.filter((t) => !baseline.normalToolCalls.includes(t));
  if (newTools.length > 0) {
    anomalies.push(`New tools accessed: ${newTools.join(", ")}`);
    deviations.push({
      metric: "TOOL_CALL_FREQUENCY",
      level: "HIGH",
      observed: newTools.length,
      expected: 0,
      zScore: 3,
      description: `Agent accessed ${newTools.length} tools not in baseline`,
    });
  }

  const newEndpoints = observation.endpoints.filter((e) => !baseline.normalEndpoints.includes(e));
  if (newEndpoints.length > 0) {
    anomalies.push(`New endpoints accessed: ${newEndpoints.join(", ")}`);
  }

  if (observation.dataVolume > baseline.normalDataVolumeRange[1] * 2) {
    anomalies.push(`Data volume ${observation.dataVolume} exceeds 2x baseline max`);
  }

  const overallLevel = deviations.length === 0
    ? "NORMAL"
    : deviations.reduce((worst, d) => {
        const order: DeviationLevel[] = ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"];
        return order.indexOf(d.level) > order.indexOf(worst) ? d.level : worst;
      }, "NORMAL" as DeviationLevel);

  let recommendation = "No action needed — agent behavior is within normal parameters.";
  if (overallLevel === "CRITICAL") {
    recommendation = "SUSPEND agent immediately. Critical behavioral anomalies detected. Investigate for compromise.";
  } else if (overallLevel === "HIGH") {
    recommendation = "THROTTLE agent and alert security team. High-severity deviations from baseline.";
  } else if (overallLevel === "ELEVATED") {
    recommendation = "MONITOR agent closely. Elevated activity may be normal but warrants attention.";
  }

  return {
    agentId: observation.agentId,
    timestamp: observation.timestamp,
    overallLevel,
    deviations,
    anomalies,
    recommendation,
  };
}

export function buildBaseline(observations: BehaviorObservation[]): BehavioralBaseline {
  if (observations.length === 0) {
    return {
      agentId: "",
      metrics: {} as Record<BaselineMetric, { mean: number; stdDev: number; p95: number; p99: number; min: number; max: number }>,
      normalToolCalls: [],
      normalEndpoints: [],
      normalDataVolumeRange: [0, 1000],
      sessionDurationRange: [0, 3600],
      lastUpdated: new Date(),
      sampleSize: 0,
    };
  }

  const agentId = observations[0].agentId;
  const allTools = [...new Set(observations.flatMap((o) => o.toolCalls))];
  const allEndpoints = [...new Set(observations.flatMap((o) => o.endpoints))];
  const dataVolumes = observations.map((o) => o.dataVolume).sort((a, b) => a - b);
  const durations = observations.map((o) => o.sessionDuration).sort((a, b) => a - b);

  const metrics: Record<BaselineMetric, { mean: number; stdDev: number; p95: number; p99: number; min: number; max: number }> = {} as any;

  const metricKeys: BaselineMetric[] = ["TOOL_CALL_FREQUENCY", "TOKEN_USAGE", "SESSION_DURATION", "DATA_VOLUME", "ERROR_RATE", "RISK_SCORE", "CONCURRENT_SESSIONS"];
  for (const key of metricKeys) {
    const values = observations.map((o) => o.metrics[key] ?? 0).filter((v) => v > 0);
    if (values.length === 0) {
      metrics[key] = { mean: 0, stdDev: 0, p95: 0, p99: 0, min: 0, max: 0 };
      continue;
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const sorted = [...values].sort((a, b) => a - b);
    metrics[key] = {
      mean,
      stdDev,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
      p99: sorted[Math.floor(sorted.length * 0.99)] ?? sorted[sorted.length - 1],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  return {
    agentId,
    metrics,
    normalToolCalls: allTools,
    normalEndpoints: allEndpoints,
    normalDataVolumeRange: [dataVolumes[0] ?? 0, dataVolumes[dataVolumes.length - 1] ?? 1000],
    sessionDurationRange: [durations[0] ?? 0, durations[durations.length - 1] ?? 3600],
    lastUpdated: new Date(),
    sampleSize: observations.length,
  };
}
