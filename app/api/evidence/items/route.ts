import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  listComplianceEvidenceItems,
  routeError,
} from "@/lib/evidence-vault/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    return listComplianceEvidenceItems(authenticated.auth);
  } catch (error) {
    return routeError(error, "Compliance evidence items could not be loaded.");
  }
}
