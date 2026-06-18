import {
  authenticateAgentFirewall,
  listPendingAgentApprovals,
  routeError,
} from "@/lib/agent-firewall/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    return listPendingAgentApprovals(authenticated.auth);
  } catch (error) {
    return routeError(error, "Pending agent approvals could not be loaded.");
  }
}
