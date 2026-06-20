// app/api/chat-quickstart/route.ts
//
// Same flow as ../chat/route.ts but using the one-line createGuardedRoute
// helper from @soter/core/next. Mount and you're done.

import { createGuardedRoute } from "@soter/core/next";

export const runtime = "nodejs";

async function callLLM(prompt: string): Promise<string> {
  return `You said: ${prompt}`;
}

export const POST = createGuardedRoute({
  apiKey: process.env.SOTER_API_KEY!,
  baseUrl: process.env.SOTER_BASE_URL,
  projectId: process.env.SOTER_PROJECT_ID,
  timeoutMs: 5000,
  callLLM,
});
