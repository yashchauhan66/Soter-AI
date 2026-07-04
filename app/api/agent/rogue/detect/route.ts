import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity } from "@/lib/advanced-security/server";
import { detectRogueAgent } from "@/lib/advanced-security/rogueAgentDetector";
import type { AgentActivity, BehaviorBaseline } from "@/lib/advanced-security/rogueAgentDetector";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = (await readJson(request)) as {
      activity: AgentActivity;
      baseline: BehaviorBaseline;
    };
    const result = detectRogueAgent(body.activity, body.baseline);
    return jsonResponse(result);
  } catch (error) {
    return apiError(error, "Rogue agent detection could not be completed.");
  }
}
