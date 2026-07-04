import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { detectRogueAgent } from "@/lib/advanced-security/rogueAgentDetector";
import type { AgentActivity, BehaviorBaseline } from "@/lib/advanced-security/rogueAgentDetector";

export async function POST(request: Request) {
  try {
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
