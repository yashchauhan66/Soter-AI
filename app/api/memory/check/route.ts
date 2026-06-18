import { authenticateAdvancedSecurity, memoryCheckSchema, readAdvancedJson, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { analyzeMemoryContent } from "@/lib/advanced-security/memoryPoisoning";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, memoryCheckSchema);
    const analysis = analyzeMemoryContent(body.content, body.memoryType);
    return jsonResponse({
      decision: analysis.decision,
      riskLevel: analysis.riskLevel,
      reason: analysis.reason,
      safeContent: analysis.safeContent,
      findings: analysis.findings,
    });
  } catch (error) {
    return routeError(error, "Memory content could not be checked.");
  }
}
