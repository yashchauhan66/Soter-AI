import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  listPendingEscrowTransactions,
  routeError,
} from "@/lib/escrow/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    return listPendingEscrowTransactions(authenticated.auth);
  } catch (error) {
    return routeError(error, "Pending escrow transactions could not be loaded.");
  }
}
