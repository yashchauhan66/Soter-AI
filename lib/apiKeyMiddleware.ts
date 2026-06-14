import { jsonResponse } from "./apiResponse";
import { verifyApiKey } from "./apiKey";

export async function authenticateApiKeyRequest(request: Request) {
  const auth = await verifyApiKey(request.headers.get("x-api-key"));
  if (!auth.ok) {
    return {
      ok: false as const,
      response: jsonResponse({ error: true, message: auth.message }, { status: auth.status }),
    };
  }
  return { ok: true as const, auth };
}
