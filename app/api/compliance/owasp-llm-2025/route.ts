import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireUser } from "@/lib/auth/guards";
import { generateOwaspLlm2025Report } from "@/lib/compliance/owaspMapping";

export async function GET() {
  try {
    await requireUser();
    const report = generateOwaspLlm2025Report();
    return jsonResponse(report);
  } catch (error) {
    return apiError(error, "Failed to generate OWASP LLM 2025 compliance report.");
  }
}
