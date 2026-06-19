import {
  authenticateAgentPassport,
  listAgentIdentities,
  routeError,
} from "@/lib/agent-passport/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    return listAgentIdentities(authenticated.auth);
  } catch (error) {
    return routeError(error, "Agent identities could not be listed.");
  }
}
