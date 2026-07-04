import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { detectModelDrift, type ModelBehaviorSnapshot } from "@/lib/advanced-security/modelDrift";

export async function POST(request: Request) {
  try {
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
