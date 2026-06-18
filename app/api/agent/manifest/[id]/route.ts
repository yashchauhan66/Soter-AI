import {
  agentManifestSchema,
  authenticateAgentFirewall,
  deleteAgentManifest,
  readAgentJson,
  routeError,
  updateAgentManifest,
} from "@/lib/agent-firewall/server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const [{ id }, body] = await Promise.all([params, readAgentJson(request, agentManifestSchema)]);
    return updateAgentManifest(authenticated.auth, id, body);
  } catch (error) {
    return routeError(error, "Agent manifest could not be updated.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const { id } = await params;
    return deleteAgentManifest(authenticated.auth, id);
  } catch (error) {
    return routeError(error, "Agent manifest could not be deleted.");
  }
}
