import {
  agentManifestSchema,
  authenticateAgentFirewall,
  createAgentManifest,
  listAgentManifests,
  readAgentJson,
  routeError,
} from "@/lib/agent-firewall/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    return listAgentManifests(authenticated.auth);
  } catch (error) {
    return routeError(error, "Agent manifest could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, agentManifestSchema);
    return createAgentManifest(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent manifest could not be saved.");
  }
}
