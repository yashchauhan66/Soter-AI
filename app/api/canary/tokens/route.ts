import { authenticateAgentFirewall } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authenticated = await authenticateAgentFirewall(request);
  if (!authenticated.ok) return authenticated.response;

  // Do not return the stored digest to avoid misuse.
  const tokens = await db.$queryRaw<
    Array<{
      id: string;
      tokenLabel: string;
      scope: string;
      active: boolean;
      createdAt: string;
      triggeredAt: string | null;
    }>
  >`
    SELECT "id", "tokenLabel", "scope", "active", "createdAt", "triggeredAt"
    FROM "CanaryToken"
    WHERE "projectId" = ${authenticated.auth.project.id}
    ORDER BY "createdAt" DESC
  `;

  return jsonResponse({ tokens });
}
