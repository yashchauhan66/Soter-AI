import { apiError, jsonResponse } from "@/lib/apiResponse";
import { generateOwaspLlm2025Report } from "@/lib/compliance/owaspMapping";

export async function GET() {
  try {
    const report = generateOwaspLlm2025Report();
    return jsonResponse(report);
  } catch (error) {
    return apiError(error, "Failed to generate OWASP LLM 2025 compliance report.");
  }
}
