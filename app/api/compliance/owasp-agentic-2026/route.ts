import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireUser } from "@/lib/auth/guards";
import { generateOwaspAgentic2026Report } from "@/lib/compliance/owaspMapping";

export async function GET() {
  try {
    await requireUser();
    const report = generateOwaspAgentic2026Report();
    return jsonResponse(report);
  } catch (error) {
    return apiError(error, "Failed to generate OWASP Agentic 2026 compliance report.");
  }
}
