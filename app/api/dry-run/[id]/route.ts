import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  getDryRun,
  routeError,
} from "@/lib/dry-run/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { id } = await params;
    return getDryRun(authenticated.auth, id);
  } catch (error) {
    return routeError(error, "Dry-run simulation could not be loaded.");
  }
}
