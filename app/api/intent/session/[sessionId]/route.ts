import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import { getIntentSession, routeError } from "@/lib/agent-intent/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { sessionId } = await params;
    return getIntentSession(authenticated.auth, decodeURIComponent(sessionId));
  } catch (error) {
    return routeError(error, "Agent intent session could not be loaded.");
  }
}
