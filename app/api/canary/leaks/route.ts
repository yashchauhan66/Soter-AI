import { authenticateAgentFirewall } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authenticated = await authenticateAgentFirewall(request);
  if (!authenticated.ok) return authenticated.response;

  const leaks = await db.$queryRaw<
    Array<{
      id: string;
      canaryTokenId: string | null;
      sessionId: string | null;
      location: string;
      decision: string;
      riskLevel: string;
      reason: string;
      contentRedacted: string;
      createdAt: string;
    }>
  >`
    SELECT
      "id",
      "canaryTokenId",
      "sessionId",
      "location",
      "decision",
      "riskLevel",
      "reason",
      "contentRedacted",
      "createdAt"
    FROM "CanaryLeakEvent"
    WHERE "projectId" = ${authenticated.auth.project.id}
    ORDER BY "createdAt" DESC
    LIMIT 200
  `;

  return jsonResponse({ leaks });
}
