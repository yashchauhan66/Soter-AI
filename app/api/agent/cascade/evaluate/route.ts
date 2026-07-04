import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { evaluateCascade, shouldSpawnAgent } from "@/lib/advanced-security/cascadeBreaker";
import type { AgentChainState, CascadeConfig } from "@/lib/advanced-security/cascadeBreaker";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as {
      state: AgentChainState;
      config?: CascadeConfig;
      checkSpawn?: boolean;
    };
    const decision = evaluateCascade(body.state, body.config);
    if (body.checkSpawn) {
      const spawn = shouldSpawnAgent(body.state, body.config);
      return jsonResponse({ ...decision, spawn });
    }
    return jsonResponse(decision);
  } catch (error) {
    return apiError(error, "Cascade evaluation could not be completed.");
  }
}
