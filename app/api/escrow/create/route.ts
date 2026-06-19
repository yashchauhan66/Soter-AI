import { authenticateAdvancedSecurity, readAdvancedJson } from "@/lib/advanced-security/server";
import {
  createEscrowTransaction,
  escrowCreateSchema,
  routeError,
} from "@/lib/escrow/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, escrowCreateSchema);
    return createEscrowTransaction(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Escrow transaction could not be created.");
  }
}
