import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  listEvidenceReports,
  routeError,
} from "@/lib/evidence-vault/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    return listEvidenceReports(authenticated.auth);
  } catch (error) {
    return routeError(error, "Compliance evidence reports could not be loaded.");
  }
}
