import { requireProjectPermission } from "@/lib/auth/guards";
import { apiError, jsonResponse, loadAgentPolicy } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return jsonResponse({ error: true, message: "projectId required." }, { status: 400 });
    const access = await requireProjectPermission(projectId, "policy:manage");
    return jsonResponse(await loadAgentPolicy(access.org.id));
  } catch (error) {
    return apiError(error, "Agent policy could not be loaded.");
  }
}
