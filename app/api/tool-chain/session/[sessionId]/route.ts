import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  getToolChainSession,
  routeError,
} from "@/lib/tool-chain/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(_request);
    if (!authenticated.ok) return authenticated.response;
    const { sessionId } = await params;
    return getToolChainSession(authenticated.auth, sessionId);
  } catch (error) {
    return routeError(error, "Tool chain session could not be loaded.");
  }
}
