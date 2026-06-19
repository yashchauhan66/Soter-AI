import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  dryRunSimulateSchema,
  routeError,
  simulateAndPersistDryRun,
} from "@/lib/dry-run/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, dryRunSimulateSchema);
    return simulateAndPersistDryRun(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Dry-run simulation could not be created.");
  }
}
