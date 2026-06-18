import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const projectId = authenticated.auth.project.id;
    const url = new URL(request.url);
    // By default, quarantined memory is NOT returned to the agent. Pass
    // ?includeQuarantined=true (dashboard/admin view) to see everything.
    const includeQuarantined = url.searchParams.get("includeQuarantined") === "true";
    const agentName = url.searchParams.get("agentName");

    let rows: Row[];
    if (includeQuarantined && agentName) {
      rows = await db.$queryRaw<Row[]>`SELECT "id", "agentName", "memoryScope", "memoryType", "contentRedacted", "status", "riskLevel", "createdAt", "updatedAt" FROM "AgentMemoryRecord" WHERE "projectId" = ${projectId} AND "agentName" = ${agentName} ORDER BY "createdAt" DESC LIMIT 200`;
    } else if (includeQuarantined) {
      rows = await db.$queryRaw<Row[]>`SELECT "id", "agentName", "memoryScope", "memoryType", "contentRedacted", "status", "riskLevel", "createdAt", "updatedAt" FROM "AgentMemoryRecord" WHERE "projectId" = ${projectId} ORDER BY "createdAt" DESC LIMIT 200`;
    } else if (agentName) {
      rows = await db.$queryRaw<Row[]>`SELECT "id", "agentName", "memoryScope", "memoryType", "contentRedacted", "status", "riskLevel", "createdAt", "updatedAt" FROM "AgentMemoryRecord" WHERE "projectId" = ${projectId} AND "status" = 'ACTIVE' AND "agentName" = ${agentName} ORDER BY "createdAt" DESC LIMIT 200`;
    } else {
      rows = await db.$queryRaw<Row[]>`SELECT "id", "agentName", "memoryScope", "memoryType", "contentRedacted", "status", "riskLevel", "createdAt", "updatedAt" FROM "AgentMemoryRecord" WHERE "projectId" = ${projectId} AND "status" = 'ACTIVE' ORDER BY "createdAt" DESC LIMIT 200`;
    }
    return jsonResponse({ records: rows });
  } catch (error) {
    return routeError(error, "Memory records could not be listed.");
  }
}
