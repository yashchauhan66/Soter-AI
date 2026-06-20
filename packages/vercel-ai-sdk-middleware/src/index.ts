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
