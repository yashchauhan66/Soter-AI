import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  checkAndPersistToolChainStep,
  routeError,
  toolChainStepCheckSchema,
} from "@/lib/tool-chain/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, toolChainStepCheckSchema);
    return checkAndPersistToolChainStep(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Tool chain step could not be checked.");
  }
}
