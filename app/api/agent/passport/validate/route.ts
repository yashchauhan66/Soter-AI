import {
  agentPassportValidateSchema,
  authenticateAgentPassport,
  readPassportJson,
  routeError,
  validateAgentSessionPassport,
} from "@/lib/agent-passport/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readPassportJson(request, agentPassportValidateSchema);
    return validateAgentSessionPassport(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent session passport could not be validated.");
  }
}
