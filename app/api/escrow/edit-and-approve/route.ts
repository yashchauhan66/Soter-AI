import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  editAndApproveEscrow,
  escrowEditApproveSchema,
  routeError,
} from "@/lib/escrow/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, escrowEditApproveSchema);
    return editAndApproveEscrow(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Escrow transaction could not be edited and approved.");
  }
}
