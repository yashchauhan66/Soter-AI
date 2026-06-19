import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  listSemanticEgressChecks,
  routeError,
} from "@/lib/semantic-egress/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    return listSemanticEgressChecks(authenticated.auth);
  } catch (error) {
    return routeError(error, "Semantic egress checks could not be loaded.");
  }
}
