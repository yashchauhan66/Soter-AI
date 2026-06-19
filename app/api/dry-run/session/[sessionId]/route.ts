import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  getDryRunsForSession,
  routeError,
} from "@/lib/dry-run/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { sessionId } = await params;
    return getDryRunsForSession(authenticated.auth, sessionId);
  } catch (error) {
    return routeError(error, "Dry-run session simulations could not be loaded.");
  }
}
