import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  evidenceReportExportSchema,
  exportEvidenceReport,
  routeError,
} from "@/lib/evidence-vault/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    await readAdvancedJson(request, evidenceReportExportSchema);
    const { id } = await params;
    return exportEvidenceReport(authenticated.auth, id);
  } catch (error) {
    return routeError(error, "Compliance evidence report could not be exported.");
  }
}
