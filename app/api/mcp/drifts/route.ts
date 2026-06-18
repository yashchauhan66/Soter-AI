import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const projectId = authenticated.auth.project.id;
    const status = new URL(request.url).searchParams.get("status");
    const rows = status
      ? await db.$queryRaw<Array<Record<string, unknown>>>`
          SELECT "id", "serverId", "toolName", "driftType", "riskBefore", "riskAfter", "summary", "recommendation", "status", "createdAt"
          FROM "McpToolDrift" WHERE "projectId" = ${projectId} AND "status" = ${status} ORDER BY "createdAt" DESC LIMIT 200
        `
      : await db.$queryRaw<Array<Record<string, unknown>>>`
          SELECT "id", "serverId", "toolName", "driftType", "riskBefore", "riskAfter", "summary", "recommendation", "status", "createdAt"
          FROM "McpToolDrift" WHERE "projectId" = ${projectId} ORDER BY "createdAt" DESC LIMIT 200
        `;
    return jsonResponse({ drifts: rows });
  } catch (error) {
    return routeError(error, "MCP drifts could not be listed.");
  }
}
