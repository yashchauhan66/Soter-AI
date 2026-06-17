import { CyberRakshakGuard } from "@cyberrakshak/guard";

const guard = new CyberRakshakGuard({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL || "https://api.cyberrakshak.com",
});

async function callMyLLM(message: string) {
  return `Safe demo response for: ${message}`;
}

export async function POST(req: Request) {
  const { message, userId, sessionId } = await req.json();
  const result = await guard.protectChat({
    message,
    userId,
    sessionId,
    metadata: { source: "nextjs-chatbot" },
    callLLM: async (safeMessage) => callMyLLM(safeMessage),
  });

  return Response.json({
    allowed: result.allowed,
    blocked: result.blocked,
    response: result.safeResponse,
    inputAction: result.inputAction,
    outputAction: result.outputAction,
    llmCalled: result.llmCalled,
  });
}
