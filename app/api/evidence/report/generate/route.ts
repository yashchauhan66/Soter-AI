import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  evidenceReportGenerateSchema,
  generateEvidenceReport,
  routeError,
} from "@/lib/evidence-vault/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, evidenceReportGenerateSchema);
    return generateEvidenceReport(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Compliance evidence report could not be generated.");
  }
}
