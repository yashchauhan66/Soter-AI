export interface CascadeConfig {
  maxChainDepth: number;
  maxConcurrentAgents: number;
  timeoutPerDepthMs: number;
  errorThresholdPercent: number;
  failOpenOnTimeout: boolean;
}

export interface AgentChainState {
  chainId: string;
  depth: number;
  agents: AgentChainNode[];
  startedAt: number;
  errors: ChainError[];
  status: "RUNNING" | "COMPLETED" | "CIRCUIT_OPEN" | "TIMED_OUT" | "ROLLED_BACK";
}

export interface AgentChainNode {
  agentId: string;
  depth: number;
  startedAt: number;
  completedAt?: number;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "ROLLED_BACK";
  error?: string;
}

export interface ChainError {
  agentId: string;
  depth: number;
  error: string;
  timestamp: number;
  recoverable: boolean;
}

export interface CascadeDecision {
  action: "CONTINUE" | "CIRCUIT_OPEN" | "ROLLBACK" | "TIMEOUT" | "THROTTLE";
  reason: string;
  affectedAgents: string[];
}

const DEFAULT_CONFIG: CascadeConfig = {
  maxChainDepth: 8,
  maxConcurrentAgents: 16,
  timeoutPerDepthMs: 30_000,
  errorThresholdPercent: 40,
  failOpenOnTimeout: false,
};

export function evaluateCascade(
  state: AgentChainState,
  config: CascadeConfig = DEFAULT_CONFIG,
): CascadeDecision {
  if (state.depth > config.maxChainDepth) {
    return {
      action: "CIRCUIT_OPEN",
      reason: `Chain depth ${state.depth} exceeds maximum allowed depth of ${config.maxChainDepth}. Possible infinite delegation loop.`,
      affectedAgents: state.agents.filter((a) => a.status === "RUNNING").map((a) => a.agentId),
    };
  }

  const runningAgents = state.agents.filter((a) => a.status === "RUNNING");
  if (runningAgents.length > config.maxConcurrentAgents) {
    return {
      action: "THROTTLE",
      reason: `${runningAgents.length} concurrent agents exceed limit of ${config.maxConcurrentAgents}. Throttling new agent spawns.`,
      affectedAgents: runningAgents.slice(config.maxConcurrentAgents).map((a) => a.agentId),
    };
  }

  const now = Date.now();
  const maxAllowedDuration = config.timeoutPerDepthMs * state.depth;
  const elapsed = now - state.startedAt;
  if (elapsed > maxAllowedDuration) {
    return {
      action: config.failOpenOnTimeout ? "CONTINUE" : "TIMEOUT",
      reason: `Chain has been running for ${Math.round(elapsed / 1000)}s, exceeding timeout of ${Math.round(maxAllowedDuration / 1000)}s for depth ${state.depth}.`,
      affectedAgents: runningAgents.map((a) => a.agentId),
    };
  }

  const totalAgents = state.agents.length;
  const failedAgents = state.agents.filter((a) => a.status === "FAILED").length;
  if (totalAgents > 2) {
    const errorRate = (failedAgents / totalAgents) * 100;
    if (errorRate >= config.errorThresholdPercent) {
      return {
        action: "ROLLBACK",
        reason: `Error rate ${errorRate.toFixed(0)}% exceeds threshold of ${config.errorThresholdPercent}%. Rolling back completed actions.`,
        affectedAgents: state.agents.filter((a) => a.status === "COMPLETED").map((a) => a.agentId),
      };
    }
  }

  const recentErrors = state.errors.filter((e) => now - e.timestamp < 10_000);
  if (recentErrors.length >= 3) {
    const allSameDepth = recentErrors.every((e) => e.depth === recentErrors[0].depth);
    if (allSameDepth) {
      return {
        action: "CIRCUIT_OPEN",
        reason: `${recentErrors.length} errors in the last 10s at depth ${recentErrors[0].depth}. Circuit opened to prevent cascade failure.`,
        affectedAgents: recentErrors.map((e) => e.agentId),
      };
    }
  }

  const unrecoverableErrors = state.errors.filter((e) => !e.recoverable);
  if (unrecoverableErrors.length > 0) {
    const criticalDepths = unrecoverableErrors.filter((e) => e.depth <= 2);
    if (criticalDepths.length > 0) {
      return {
        action: "ROLLBACK",
        reason: `Unrecoverable error at critical depth ${criticalDepths[0].depth}. Rolling back chain.`,
        affectedAgents: state.agents.map((a) => a.agentId),
      };
    }
  }

  return {
    action: "CONTINUE",
    reason: "Chain operating within normal parameters.",
    affectedAgents: [],
  };
}

export function shouldSpawnAgent(
  currentState: AgentChainState,
  config: CascadeConfig = DEFAULT_CONFIG,
): { allowed: boolean; reason: string } {
  if (currentState.depth + 1 > config.maxChainDepth) {
    return { allowed: false, reason: `Would exceed max chain depth of ${config.maxChainDepth}.` };
  }

  const running = currentState.agents.filter((a) => a.status === "RUNNING").length;
  if (running >= config.maxConcurrentAgents) {
    return { allowed: false, reason: `Already at max concurrent agent limit (${config.maxConcurrentAgents}).` };
  }

  const decision = evaluateCascade(currentState, config);
  if (decision.action !== "CONTINUE") {
    return { allowed: false, reason: `Chain is in ${decision.action} state: ${decision.reason}` };
  }

  return { allowed: true, reason: "Within safe operating parameters." };
}
