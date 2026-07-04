import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import { checkInterAgentMessage } from "@/lib/advanced-security/interAgentSecurity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = (await readJson(request)) as {
      fromAgentId: string;
      toAgentId: string;
      content: string;
      sessionId: string;
      delegationChain?: string[];
      timestamp?: number;
    };
    const result = checkInterAgentMessage({
      ...body,
      timestamp: body.timestamp ?? Date.now(),
    });
    return jsonResponse(result);
  } catch (error) {
    return apiError(error, "Inter-agent message could not be checked.");
  }
}
