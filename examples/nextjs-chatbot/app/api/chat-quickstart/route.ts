// app/api/chat-quickstart/route.ts
//
// Same flow as ../chat/route.ts but using the one-line createGuardedRoute
// helper from @cyberrakshak/guard/next. Mount and you're done.

import { createGuardedRoute } from "@cyberrakshak/guard/next";

export const runtime = "nodejs";

async function callLLM(prompt: string): Promise<string> {
  return `You said: ${prompt}`;
}

export const POST = createGuardedRoute({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: process.env.CYBERRAKSHAK_BASE_URL || "https://api.cyberrakshak.dev",
  projectId: process.env.CYBERRAKSHAK_PROJECT_ID,
  timeoutMs: 5000,
  callLLM,
});
