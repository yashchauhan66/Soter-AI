import { apiError, authenticateAgentJson, jsonResponse, loadAgentPolicy } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const auth = await authenticateAgentJson(request, organizationId);
    if (!auth.ok) return auth.response;
    return jsonResponse(await loadAgentPolicy(organizationId));
  } catch (error) {
    return apiError(error, "Agent policy could not be loaded.");
  }
}
