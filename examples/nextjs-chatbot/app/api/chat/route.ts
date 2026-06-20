// app/api/chat/route.ts
//
// Next.js Route Handler that guards a chatbot turn:
//   user input -> input guard -> your LLM -> output guard -> safe reply
//
// The Soter API key is read from the server environment and never sent
// to the browser. The browser only POSTs { message } to this route.

import { Soter } from "@soter/core";

export const runtime = "nodejs";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
  projectId: process.env.SOTER_PROJECT_ID,
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
    const inputResult = await soter.guardInput({ text: message });
    if (soter.shouldBlock(inputResult)) {
      return Response.json({
        reply: inputResult.safeText ?? "This request was blocked for safety.",
        blocked: true,
      });
    }

    const safeInput = soter.getSafeText(inputResult, message) ?? message;
    const llmReply = await callLLM(safeInput);

    const outputResult = await soter.guardOutput({ text: llmReply });
    if (soter.shouldBlock(outputResult)) {
      return Response.json({
        reply: outputResult.safeText ?? "The response was withheld for safety.",
        blocked: true,
      });
    }

    return Response.json({
      reply: soter.getSafeText(outputResult, llmReply) ?? llmReply,
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
