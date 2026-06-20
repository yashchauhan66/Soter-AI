import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  collectComplianceEvidence,
  evidenceCollectSchema,
  routeError,
} from "@/lib/evidence-vault/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, evidenceCollectSchema);
    return collectComplianceEvidence(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Compliance evidence could not be collected.");
  }
}
