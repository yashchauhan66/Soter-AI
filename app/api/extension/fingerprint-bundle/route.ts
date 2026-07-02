import { apiError, jsonResponse } from "@/lib/apiResponse";
import { authenticateExtensionRequest } from "../_shared";
import { loadFingerprintRecords } from "@/lib/ai-data-security/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const auth = await authenticateExtensionRequest(request, organizationId);
    if (!auth.ok) return auth.response;
    return jsonResponse({ fingerprintBundle: await loadFingerprintRecords(organizationId), storageMode: "hashed_only" });
  } catch (error) {
    return apiError(error, "Fingerprint bundle could not be loaded.");
  }
}
