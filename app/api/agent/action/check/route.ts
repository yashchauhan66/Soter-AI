import {
  agentActionSchema,
  authenticateAgentFirewall,
  decideAndPersistAgentAction,
  readAgentJson,
  routeError,
} from "@/lib/agent-firewall/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, agentActionSchema);
    return decideAndPersistAgentAction(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent action could not be checked.");
  }
}
