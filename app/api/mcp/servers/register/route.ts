import { authenticateAdvancedSecurity, mcpServerRegisterSchema, readAdvancedJson, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { sanitizeMetadata } from "@/lib/guard/logSafety";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, mcpServerRegisterSchema);
    const projectId = authenticated.auth.project.id;
    const id = crypto.randomUUID();
    await db.$executeRaw`
      INSERT INTO "McpServerRegistry" ("id", "projectId", "serverName", "serverUrl", "status", "trustLevel", "metadataJson", "createdAt", "updatedAt")
      VALUES (${id}, ${projectId}, ${body.serverName}, ${body.serverUrl ?? null}, 'ACTIVE', ${body.trustLevel}, ${JSON.stringify(sanitizeMetadata(body.metadata))}::jsonb, NOW(), NOW())
      ON CONFLICT ("projectId", "serverName") DO UPDATE
      SET "serverUrl" = EXCLUDED."serverUrl", "trustLevel" = EXCLUDED."trustLevel", "metadataJson" = EXCLUDED."metadataJson", "updatedAt" = NOW()
    `;
    const rows = await db.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status" FROM "McpServerRegistry" WHERE "projectId" = ${projectId} AND "serverName" = ${body.serverName} LIMIT 1
    `;
    return jsonResponse({ serverId: rows[0]?.id ?? id, serverName: body.serverName, status: rows[0]?.status ?? "ACTIVE", trustLevel: body.trustLevel });
  } catch (error) {
    return routeError(error, "MCP server could not be registered.");
  }
}
