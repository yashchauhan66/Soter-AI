import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  getEscrowTransaction,
  routeError,
} from "@/lib/escrow/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { id } = await params;
    return getEscrowTransaction(authenticated.auth, id);
  } catch (error) {
    return routeError(error, "Escrow transaction could not be loaded.");
  }
}
