import { apiError, jsonResponse } from "@/lib/apiResponse";
import { getComplianceGaps } from "@/lib/compliance/owaspMapping";

export async function GET() {
  try {
    const gaps = getComplianceGaps();
    const totalGaps = gaps.reduce((sum, item) => sum + item.gaps.length, 0);
    return jsonResponse({ totalGaps, gaps });
  } catch (error) {
    return apiError(error, "Failed to retrieve compliance gaps.");
  }
}
