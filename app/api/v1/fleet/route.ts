// GET /api/v1/fleet — estate-wide AI asset inventory for the org (Gap-1)
import { buildFleetInventory } from "@/lib/fleet-inventory";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { apiError } from "@/lib/apiResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateApiKeyRequest(request);
  if (!auth.ok) return auth.response;
  // verifyApiKey returns { ok:true, apiKey, project }; org id is on the project.
  const organizationId = auth.auth.project?.organizationId;
  if (!organizationId) {
    return apiError(new Error("No organization associated with this API key."), "API key has no organization scope.");
  }
  try {
    const inventory = await buildFleetInventory(organizationId);
    return Response.json(inventory, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return apiError(e, "Failed to build fleet inventory.");
  }
}
