import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  checkAndPersistSemanticEgress,
  routeError,
  semanticEgressCheckSchema,
} from "@/lib/semantic-egress/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, semanticEgressCheckSchema);
    return checkAndPersistSemanticEgress(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Semantic egress could not be checked.");
  }
}
