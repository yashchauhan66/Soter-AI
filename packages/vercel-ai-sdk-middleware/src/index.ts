export function soterVercelAiMiddleware(guard: {
  guardInput(input: { message: string }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }>;
  guardOutput(input: { aiResponse: string }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }>;
}) {
  return {
    async preparePrompt(prompt: string) {
      const decision = await guard.guardInput({ message: prompt });
      if (decision.action === "BLOCK") throw new Error(decision.reason ?? "Soter blocked prompt.");
      return decision.safeText ?? decision.redactedText ?? prompt;
    },
    async finalizeText(text: string) {
      const decision = await guard.guardOutput({ aiResponse: text });
      if (decision.action === "BLOCK") throw new Error(decision.reason ?? "Soter blocked response.");
      return decision.safeText ?? decision.redactedText ?? text;
    },
  };
}

/** @deprecated Use soterVercelAiMiddleware for new integrations. */
export const cyberRakshakVercelAiMiddleware = soterVercelAiMiddleware;

export interface VercelAgentActionGuard {
  checkAgentAction(input: {
    sessionId?: string;
    agentName?: string;
    tool: string;
    action: string;
    target?: string;
    content?: string;
    destination?: "external" | "internal" | "local" | "unknown";
  }): Promise<{
    decision: "ALLOW" | "BLOCK" | "REDACT" | "ASK_APPROVAL" | "SANDBOX_ONLY" | "READ_ONLY";
    safeContent?: string;
    reason?: string;
  }>;
}

/** Pre-execution wrapper for Vercel AI SDK tool execute functions. */
export function soterVercelTool<TArgs, TResult>(
  toolName: string,
  execute: (args: TArgs) => TResult | Promise<TResult>,
  guard: VercelAgentActionGuard,
  context: {
    sessionId?: string;
    agentName?: string;
    action?: string;
    target?: string;
    destination?: "external" | "internal" | "local" | "unknown";
  } = {},
) {
  return {
    async execute(args: TArgs): Promise<{ executed: boolean; decision: Awaited<ReturnType<VercelAgentActionGuard["checkAgentAction"]>>; result?: TResult }> {
      let content: string;
      try { content = JSON.stringify(args); } catch { content = "[unserializable tool arguments]"; }
      const decision = await guard.checkAgentAction({
        sessionId: context.sessionId,
        agentName: context.agentName ?? "vercel-ai-sdk",
        tool: `vercel-ai.${toolName}`,
        action: context.action ?? "tool_call",
        target: context.target,
        content,
        destination: context.destination,
      });
      if (!["ALLOW", "READ_ONLY", "REDACT"].includes(decision.decision)) {
        return { executed: false, decision };
      }
      const effectiveArgs = decision.decision === "REDACT" && typeof args === "string" && decision.safeContent
        ? decision.safeContent as TArgs
        : args;
      return { executed: true, decision, result: await execute(effectiveArgs) };
    },
  };
}
