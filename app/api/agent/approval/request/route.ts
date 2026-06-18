import {
  approvalRequestSchema,
  authenticateAgentFirewall,
  createApprovalForAction,
  readAgentJson,
  routeError,
} from "@/lib/agent-firewall/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, approvalRequestSchema);
    return createApprovalForAction(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent approval could not be requested.");
  }
}
