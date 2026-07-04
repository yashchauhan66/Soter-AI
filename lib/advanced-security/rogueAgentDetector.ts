export interface BehaviorBaseline {
  agentId: string;
  avgToolCallsPerSession: number;
  avgSessionDurationMs: number;
  authorizedTools: string[];
  authorizedDestinations: string[];
  typicalDataVolume: number;
  avgRiskScore: number;
  lastUpdated: number;
}

export interface AgentActivity {
  agentId: string;
  sessionId: string;
  toolCalls: string[];
  destinations: string[];
  dataVolumeBytes: number;
  durationMs: number;
  riskScore: number;
  timestamp: number;
}

export interface RogueAgentResult {
  isRogue: boolean;
  confidence: number;
  deviations: RogueDeviation[];
  recommendation: "ALLOW" | "MONITOR" | "THROTTLE" | "SUSPEND" | "TERMINATE";
}

export interface RogueDeviation {
  type: "TOOL_ANOMALY" | "DESTINATION_ANOMALY" | "VOLUME_ANOMALY" | "DURATION_ANOMALY" | "RISK_SPIKE" | "SCOPE_EXPANSION" | "UNAUTHORIZED_TOOL" | "PATTERN_BREAK";
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number;
}

export function detectRogueAgent(
  activity: AgentActivity,
  baseline: BehaviorBaseline,
): RogueAgentResult {
  const deviations: RogueDeviation[] = [];

  const unauthorizedTools = activity.toolCalls.filter(
    (tool) => !baseline.authorizedTools.includes(tool),
  );
  if (unauthorizedTools.length > 0) {
    deviations.push({
      type: "UNAUTHORIZED_TOOL",
      message: `Agent used ${unauthorizedTools.length} unauthorized tool(s): ${unauthorizedTools.slice(0, 3).join(", ")}`,
      severity: unauthorizedTools.length > 2 ? "CRITICAL" : "HIGH",
      score: Math.min(40, unauthorizedTools.length * 15),
    });
  }

  const unauthorizedDests = activity.destinations.filter(
    (dest) => !baseline.authorizedDestinations.includes(dest),
  );
  if (unauthorizedDests.length > 0) {
    deviations.push({
      type: "DESTINATION_ANOMALY",
      message: `Agent contacted ${unauthorizedDests.length} unauthorized destination(s): ${unauthorizedDests.slice(0, 3).join(", ")}`,
      severity: "HIGH",
      score: Math.min(35, unauthorizedDests.length * 12),
    });
  }

  if (baseline.avgToolCallsPerSession > 0) {
    const toolCallRatio = activity.toolCalls.length / baseline.avgToolCallsPerSession;
    if (toolCallRatio > 3) {
      deviations.push({
        type: "PATTERN_BREAK",
        message: `Tool call volume is ${toolCallRatio.toFixed(1)}x the baseline average.`,
        severity: toolCallRatio > 5 ? "HIGH" : "MEDIUM",
        score: Math.min(30, Math.round((toolCallRatio - 3) * 10)),
      });
    }
  }

  if (baseline.typicalDataVolume > 0) {
    const volumeRatio = activity.dataVolumeBytes / baseline.typicalDataVolume;
    if (volumeRatio > 5) {
      deviations.push({
        type: "VOLUME_ANOMALY",
        message: `Data volume is ${volumeRatio.toFixed(1)}x the baseline (possible exfiltration).`,
        severity: volumeRatio > 10 ? "CRITICAL" : "HIGH",
        score: Math.min(40, Math.round((volumeRatio - 5) * 5)),
      });
    }
  }

  if (baseline.avgSessionDurationMs > 0) {
    const durationRatio = activity.durationMs / baseline.avgSessionDurationMs;
    if (durationRatio > 4) {
      deviations.push({
        type: "DURATION_ANOMALY",
        message: `Session duration is ${durationRatio.toFixed(1)}x the baseline average.`,
        severity: "MEDIUM",
        score: Math.min(20, Math.round((durationRatio - 4) * 5)),
      });
    }
  }

  if (baseline.avgRiskScore > 0) {
    const riskDelta = activity.riskScore - baseline.avgRiskScore;
    if (riskDelta > 30) {
      deviations.push({
        type: "RISK_SPIKE",
        message: `Risk score spiked ${riskDelta} points above baseline average.`,
        severity: riskDelta > 50 ? "CRITICAL" : "HIGH",
        score: Math.min(35, riskDelta),
      });
    }
  }

  const uniqueTools = new Set(activity.toolCalls);
  if (uniqueTools.size > baseline.authorizedTools.length * 1.5 && uniqueTools.size > 5) {
    deviations.push({
      type: "SCOPE_EXPANSION",
      message: `Agent is using ${uniqueTools.size} unique tools (authorized: ${baseline.authorizedTools.length}), suggesting scope expansion.`,
      severity: "HIGH",
      score: 25,
    });
  }

  const totalScore = deviations.reduce((sum, d) => sum + d.score, 0);
  const confidence = Math.min(100, totalScore);
  const isRogue = confidence >= 50;

  let recommendation: RogueAgentResult["recommendation"];
  if (confidence >= 80) recommendation = "TERMINATE";
  else if (confidence >= 60) recommendation = "SUSPEND";
  else if (confidence >= 40) recommendation = "THROTTLE";
  else if (confidence >= 20) recommendation = "MONITOR";
  else recommendation = "ALLOW";

  return { isRogue, confidence, deviations, recommendation };
}
