import { z } from "zod";
import { authenticateAgentFirewall, readAgentJson, routeError } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { checkCanaryContent } from "@/lib/agent-firewall/mvp3";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export const dynamic = "force-dynamic";

const schema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  content: z.string().min(1).max(50_000),
  location: z.enum(["agent_output", "tool_call", "email", "api_request", "browser_form", "external_post"]),
});

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, schema);
    const canaries = await db.$queryRaw<Array<{ id: string; tokenHash: string; tokenLabel: string; scope: string }>>`
      SELECT "id", "tokenHash", "tokenLabel", "scope"
      FROM "CanaryToken"
      WHERE "projectId" = ${authenticated.auth.project.id} AND "active" = true
    `;
    const result = checkCanaryContent(body.content, canaries);
    if (result.leakDetected) {
      const contentRedacted = redactCanaryTokens(sanitizeLogText(body.content));
      for (const canary of result.matchedCanaries) {
        await db.$executeRaw`
          UPDATE "CanaryToken"
          SET "triggeredAt" = NOW()
          WHERE "projectId" = ${authenticated.auth.project.id} AND "id" = ${canary.id}
        `;
        await db.$executeRaw`
          INSERT INTO "CanaryLeakEvent" ("id", "projectId", "canaryTokenId", "sessionId", "location", "decision", "riskLevel", "reason", "contentRedacted", "createdAt")
          VALUES (${crypto.randomUUID()}, ${authenticated.auth.project.id}, ${canary.id}, ${body.sessionId ?? null}, ${body.location}, 'BLOCK', 'CRITICAL', ${result.reason}, ${contentRedacted}, NOW())
        `;
      }
      await db.$executeRaw`
        INSERT INTO "AgentActionLog" ("id", "sessionId", "projectId", "tool", "action", "destination", "decision", "riskLevel", "reason", "originalContentRedacted", "metadataJson", "createdAt")
        VALUES (${crypto.randomUUID()}, ${body.sessionId ?? null}, ${authenticated.auth.project.id}, 'canary.check', ${body.location}, 'external', 'BLOCK', 'CRITICAL', ${result.reason}, ${contentRedacted}, ${JSON.stringify({ matchedCanaries: result.matchedCanaries })}::jsonb, NOW())
      `;
    }
    return jsonResponse(result);
  } catch (error) {
    return routeError(error, "Canary leak check could not be completed.");
  }
}

function redactCanaryTokens(value: string) {
  return value.replace(/\bCYBERGUARD_CANARY_[A-Za-z0-9_-]+\b/g, "[REDACTED_CANARY]");
}
