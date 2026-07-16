import { readJson } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
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
    const body = semanticEgressCheckSchema.parse(await readJson(request));
    return await checkAndPersistSemanticEgress(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Semantic egress check could not be completed.");
  }
}
