import {
  authenticateAgentPassport,
  getAgentSessionPassport,
  routeError,
} from "@/lib/agent-passport/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    const { sessionId } = await params;
    return getAgentSessionPassport(authenticated.auth, decodeURIComponent(sessionId));
  } catch (error) {
    return routeError(error, "Agent session passport could not be loaded.");
  }
}
