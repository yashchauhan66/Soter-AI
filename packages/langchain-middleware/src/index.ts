export interface GuardClient {
  guardInput(input: { message: string; metadata?: Record<string, unknown> }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }>;
  guardOutput(input: { aiResponse: string; metadata?: Record<string, unknown> }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }>;
}

export function withCyberRakshakLangChain<TInput extends { input: string }, TOutput extends { output: string }>(
  chain: { invoke(input: TInput): Promise<TOutput> },
  guard: GuardClient,
) {
  return {
    async invoke(input: TInput) {
      const inputDecision = await guard.guardInput({ message: input.input });
      if (inputDecision.action === "BLOCK") throw new Error(inputDecision.reason ?? "CyberRakshak Guard blocked input.");
      const result = await chain.invoke({ ...input, input: inputDecision.safeText ?? inputDecision.redactedText ?? input.input });
      const outputDecision = await guard.guardOutput({ aiResponse: result.output });
      if (outputDecision.action === "BLOCK") throw new Error(outputDecision.reason ?? "CyberRakshak Guard blocked output.");
      return { ...result, output: outputDecision.safeText ?? outputDecision.redactedText ?? result.output };
    },
  };
}

