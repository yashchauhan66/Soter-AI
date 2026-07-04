import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import { detectModelDrift, type ModelBehaviorSnapshot } from "@/lib/advanced-security/modelDrift";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = (await readJson(request)) as {
      baseline: ModelBehaviorSnapshot;
      current: ModelBehaviorSnapshot;
    };
    const result = detectModelDrift(body.baseline, body.current);
    return jsonResponse(result);
  } catch (error) {
    return apiError(error, "Model drift detection could not be completed.");
  }
}
