import { createGatewayHandler } from "@/lib/gateway/core";
import { openaiAdapter } from "@/lib/gateway/providers";
import { verifyApiKey as authenticateApiKeyRequest } from "@/lib/apiKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createGatewayHandler(openaiAdapter);

/**
 * POST /api/gateway/openai/v1/chat/completions
 * OpenAI-compatible inline enforcement proxy. Point the OpenAI SDK's baseURL
 * at /api/gateway/openai/v1 and add the x-soterai-api-key header.
 */
export async function POST(request: Request) {
  if (!request.body) return new Response(JSON.stringify({ error: true, message: "Request body is required." }), { status: 400 });
  const verified = await authenticateApiKeyRequest(request.headers.get("x-soterai-api-key"));
  if (!verified.ok) {
    return new Response(JSON.stringify({ error: true, message: verified.message }), {
      status: verified.status,
      headers: { "content-type": "application/json" },
    });
  }
  return handler(request, verified);
}
