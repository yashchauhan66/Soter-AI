import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { checkInterAgentMessage } from "@/lib/advanced-security/interAgentSecurity";

export async function POST(request: Request) {
  try {
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
