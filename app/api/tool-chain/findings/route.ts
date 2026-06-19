import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  listToolChainFindings,
  routeError,
} from "@/lib/tool-chain/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { searchParams } = new URL(request.url);
    return listToolChainFindings(authenticated.auth, searchParams.get("sessionId") ?? undefined);
  } catch (error) {
    return routeError(error, "Tool chain findings could not be loaded.");
  }
}
