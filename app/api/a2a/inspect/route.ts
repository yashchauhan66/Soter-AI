import { z } from "zod";
import { inspectA2AAgentCard, type A2AAgentCard } from "@/lib/a2a-security";
import { authenticateAgentPassport, checkAgentPassportForAction, readPassportJson, routeError } from "@/lib/agent-passport/server";
import { jsonResponse } from "@/lib/apiResponse";

const schema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  passportToken: z.string().trim().min(10).max(300),
  agentCard: z.record(z.unknown()),
  skillId: z.string().trim().min(1).max(200),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readPassportJson(request, schema);
    const inspection = inspectA2AAgentCard(body.agentCard as A2AAgentCard, body.skillId);
    if (inspection.decision === "BLOCK") return jsonResponse({ decision: "BLOCK", riskLevel: inspection.riskLevel, inspection, reason: "A2A Agent Card failed security inspection." }, { status: 403 });
    const passport = await checkAgentPassportForAction(authenticated.auth, {
      sessionId: body.sessionId,
      passportToken: body.passportToken,
      tool: `a2a.skill.${body.skillId}`,
      action: "a2a.invoke",
      target: inspection.endpoint ?? undefined,
      metadata: { a2aCardHash: inspection.cardHash, a2aSkillId: body.skillId },
    });
    const decision = inspection.decision === "REVIEW" && passport.decision === "ALLOW" ? "ASK_APPROVAL" : passport.decision;
    return jsonResponse({ decision, riskLevel: inspection.riskLevel === "LOW" ? passport.riskLevel : inspection.riskLevel, inspection, passport, reason: decision === "ALLOW" ? "A2A invocation passed Agent Card and passport authorization checks." : "A2A invocation requires review or is blocked." });
  } catch (error) {
    return routeError(error, "A2A invocation could not be inspected.");
  }
}
