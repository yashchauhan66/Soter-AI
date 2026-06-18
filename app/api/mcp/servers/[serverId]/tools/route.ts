import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ serverId: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { serverId } = await params;
    const projectId = authenticated.auth.project.id;
    const serverRows = await db.$queryRaw<Array<{ id: string; serverName: string; status: string; trustLevel: string }>>`
      SELECT "id", "serverName", "status", "trustLevel" FROM "McpServerRegistry" WHERE "id" = ${serverId} AND "projectId" = ${projectId} LIMIT 1
    `;
    if (!serverRows[0]) return jsonResponse({ error: true, message: "MCP server not found." }, { status: 404 });
    // Latest snapshot per tool for this server.
    const tools = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT DISTINCT ON ("toolName") "toolName", "riskLevel", "detectedCapabilitiesJson", "riskReasonsJson", "toolDescriptionRedacted", "createdAt"
      FROM "McpToolSnapshot"
      WHERE "projectId" = ${projectId} AND "serverId" = ${serverId}
      ORDER BY "toolName", "createdAt" DESC
    `;
    return jsonResponse({ server: serverRows[0], tools });
  } catch (error) {
    return routeError(error, "MCP server tools could not be loaded.");
  }
}
