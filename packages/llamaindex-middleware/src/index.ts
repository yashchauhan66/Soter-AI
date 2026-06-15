export function createCyberRakshakQueryWrapper<TResponse>(
  queryEngine: { query(input: { query: string }): Promise<TResponse> },
  guard: { guardInput(input: { message: string }): Promise<{ action: string; safeText?: string; redactedText?: string; reason?: string }> },
) {
  return {
    async query(input: { query: string }) {
      const decision = await guard.guardInput({ message: input.query });
      if (decision.action === "BLOCK") throw new Error(decision.reason ?? "CyberRakshak Guard blocked query.");
      return queryEngine.query({ query: decision.safeText ?? decision.redactedText ?? input.query });
    },
  };
}

