import { readJson } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import {
  fingerprintAndPersistSemanticSource,
  routeError,
  semanticSourceFingerprintSchema,
} from "@/lib/semantic-egress/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = semanticSourceFingerprintSchema.parse(await readJson(request));
    return await fingerprintAndPersistSemanticSource(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Semantic source fingerprint could not be completed.");
  }
}
