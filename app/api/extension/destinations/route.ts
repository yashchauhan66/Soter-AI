import { apiError, jsonResponse } from "@/lib/apiResponse";
import { listAIDestinations } from "@/lib/ai-destinations";
import { authenticateExtensionRequest } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const auth = await authenticateExtensionRequest(request, organizationId);
    if (!auth.ok) return auth.response;
    return jsonResponse({ destinations: await listAIDestinations(organizationId, { enabledOnly: true }) });
  } catch (error) {
    return apiError(error, "Extension destinations could not be loaded.");
  }
}
