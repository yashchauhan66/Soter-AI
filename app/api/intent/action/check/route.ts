import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  checkAndPersistIntentAction,
  intentActionCheckSchema,
  routeError,
} from "@/lib/agent-intent/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, intentActionCheckSchema);
    return checkAndPersistIntentAction(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent intent action could not be checked.");
  }
}
