import {
  authenticateAgentFirewall,
  dataCheckSchema,
  persistDataCheck,
  readAgentJson,
  routeError,
} from "@/lib/agent-firewall/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, dataCheckSchema);
    return persistDataCheck(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent data could not be checked.");
  }
}
