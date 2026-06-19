import {
  agentIdentityCreateSchema,
  authenticateAgentPassport,
  createAgentIdentity,
  readPassportJson,
  routeError,
} from "@/lib/agent-passport/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readPassportJson(request, agentIdentityCreateSchema);
    return createAgentIdentity(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent identity could not be created.");
  }
}
