export interface SoterGuardClient {
  guardInput(input: { message: string; metadata?: Record<string, unknown> }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }>;
  guardOutput(input: { aiResponse: string; metadata?: Record<string, unknown> }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }>;
}

/** @deprecated Use SoterGuardClient for new integrations. */
export type GuardClient = SoterGuardClient;

export interface SoterAgentActionGuard {
  checkAgentAction(input: {
    sessionId?: string;
    agentName?: string;
    tool: string;
    action: string;
    target?: string;
    content?: string;
    destination?: "external" | "internal" | "local" | "unknown";
    metadata?: Record<string, unknown>;
  }): Promise<{
    decision: "ALLOW" | "BLOCK" | "REDACT" | "ASK_APPROVAL" | "SANDBOX_ONLY" | "READ_ONLY";
    safeContent?: string;
    reason?: string;
  }>;
}

export interface LangChainToolContext {
  sessionId?: string;
  agentName?: string;
  action?: string;
  target?: string;
  destination?: "external" | "internal" | "local" | "unknown";
  metadata?: Record<string, unknown>;
}

/**
 * Wrap a LangChain-compatible tool executor with a mandatory pre-execution
 * action check. BLOCK/ASK_APPROVAL/SANDBOX_ONLY never reach the executor.
 */
export function withSoterLangChainTool<TArgs, TResult>(
  toolName: string,
  executor: (args: TArgs) => TResult | Promise<TResult>,
  guard: SoterAgentActionGuard,
  context: LangChainToolContext = {},
) {
  return async (args: TArgs): Promise<{ executed: boolean; decision: Awaited<ReturnType<SoterAgentActionGuard["checkAgentAction"]>>; result?: TResult }> => {
    let content: string;
    try { content = JSON.stringify(args); } catch { content = "[unserializable tool arguments]"; }
    const decision = await guard.checkAgentAction({
      sessionId: context.sessionId,
      agentName: context.agentName ?? "langchain",
      tool: `langchain.${toolName}`,
      action: context.action ?? "tool_call",
      target: context.target,
      content,
      destination: context.destination,
      metadata: context.metadata,
    });
    if (!["ALLOW", "READ_ONLY", "REDACT"].includes(decision.decision)) {
      return { executed: false, decision };
    }
    const effectiveArgs = decision.decision === "REDACT" && typeof args === "string" && decision.safeContent
      ? decision.safeContent as TArgs
      : args;
    return { executed: true, decision, result: await executor(effectiveArgs) };
  };
}

export function withSoterLangChain<TInput extends { input: string }, TOutput extends { output: string }>(
  chain: { invoke(input: TInput): Promise<TOutput> },
  guard: SoterGuardClient,
) {
  return {
    async invoke(input: TInput) {
      const inputDecision = await guard.guardInput({ message: input.input });
      if (inputDecision.action === "BLOCK") throw new Error(inputDecision.reason ?? "Soter blocked input.");
      const result = await chain.invoke({ ...input, input: inputDecision.safeText ?? inputDecision.redactedText ?? input.input });
      const outputDecision = await guard.guardOutput({ aiResponse: result.output });
      if (outputDecision.action === "BLOCK") throw new Error(outputDecision.reason ?? "Soter blocked output.");
      return { ...result, output: outputDecision.safeText ?? outputDecision.redactedText ?? result.output };
    },
  };
}

/** @deprecated Use withSoterLangChain for new integrations. */
export const withCyberRakshakLangChain = withSoterLangChain;
