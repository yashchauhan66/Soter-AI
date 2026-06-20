export interface SoterGuardClient {
  guardInput(input: { message: string; metadata?: Record<string, unknown> }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }>;
  guardOutput(input: { aiResponse: string; metadata?: Record<string, unknown> }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }>;
}

/** @deprecated Use SoterGuardClient for new integrations. */
export type GuardClient = SoterGuardClient;

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
