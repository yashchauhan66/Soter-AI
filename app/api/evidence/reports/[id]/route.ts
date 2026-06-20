import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  getEvidenceReport,
  routeError,
} from "@/lib/evidence-vault/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { id } = await params;
    return getEvidenceReport(authenticated.auth, id);
  } catch (error) {
    return routeError(error, "Compliance evidence report could not be loaded.");
  }
}
