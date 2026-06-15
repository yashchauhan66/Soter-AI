// app/api/chat/route.ts
//
// Next.js Route Handler that guards a chatbot turn:
//   user input -> input guard -> your LLM -> output guard -> safe reply
//
// The CyberRakshak API key is read from the server environment and never sent
// to the browser. The browser only POSTs { message } to this route.

import { CyberRakshakClient } from "@cyberrakshak/guard";

export const runtime = "nodejs";

const guard = new CyberRakshakClient({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL || "https://api.cyberrakshak.dev",
  projectId: process.env.CYBERRAKSHAK_PROJECT_ID,
  timeoutMs: 5000,
});

// Replace with your real LLM call.
async function callLLM(prompt: string): Promise<string> {
  return `You said: ${prompt}`;
}

export async function POST(request: Request) {
  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: true, message: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: true, message: "message is required." }, { status: 400 });
  }

  try {
    const inputResult = await guard.guardInput({ text: message });
    if (guard.shouldBlock(inputResult)) {
      return Response.json({
        reply: inputResult.safeText ?? "This request was blocked for safety.",
        blocked: true,
      });
    }

    const safeInput = guard.getSafeText(inputResult, message) ?? message;
    const llmReply = await callLLM(safeInput);

    const outputResult = await guard.guardOutput({ text: llmReply });
    if (guard.shouldBlock(outputResult)) {
      return Response.json({
        reply: outputResult.safeText ?? "The response was withheld for safety.",
        blocked: true,
      });
    }

    return Response.json({
      reply: guard.getSafeText(outputResult, llmReply) ?? llmReply,
      blocked: false,
    });
  } catch (caught) {
    // Never echo the API key or raw error internals to the client.
    const status = (caught as { status?: number }).status ?? 500;
    return Response.json(
      { error: true, message: "The chat request could not be processed." },
      { status },
    );
  }
}
