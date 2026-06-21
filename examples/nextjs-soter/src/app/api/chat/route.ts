import { secureChatHandler } from "@soterai/core/next";

/**
 * Mock LLM — replace this with your actual AI model (e.g. OpenAI, Anthropic, etc.)
 */
async function mockLLM({ safeInput }: { safeInput: string }): Promise<string> {
  // Simulate a small delay
  await new Promise((r) => setTimeout(r, 600));

  const lower = safeInput.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi")) {
    return "Hello! How can I help you today? I'm running with Soter safety protection!";
  }
  if (lower.includes("who are you")) {
    return "I am a Soter-protected AI assistant. My responses are guarded against unsafe content.";
  }
  if (lower.includes("joke") || lower.includes("funny")) {
    return "Why do AI developers prefer dark mode? Because light attracts bugs! 😄";
  }
  if (lower.includes("weather")) {
    return "I don't have access to live weather data, but I hope it's sunny where you are! ☀️";
  }

  return `I received your message: "${safeInput}". I'm a simulated AI running behind the Soter safety layer.`;
}

/**
 * POST /api/chat
 *
 * Uses Soter's secureChatHandler which automatically:
 * 1. Guards the user's input (blocks prompt injection, jailbreaks, PII leaks)
 * 2. Calls your LLM only with safe/redacted text
 * 3. Guards the model's output before returning it
 */
export const POST = secureChatHandler({
  // Falls back to SOTER_API_KEY env var when not passed explicitly
  apiKey: process.env.SOTER_API_KEY!,
  baseUrl: process.env.SOTER_BASE_URL || "https://api.soter.dev",
  callLLM: async ({ safeInput }) => mockLLM({ safeInput }),
  blockedResponse: "⛔ This message was blocked by Soter's AI safety layer.",
  withholdResponse: "🛡️ The AI response was withheld by Soter's output guard.",
});
