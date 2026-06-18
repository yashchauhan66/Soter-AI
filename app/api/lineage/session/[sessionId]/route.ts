import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const { sessionId } = await params;
    const projectId = authenticated.auth.project.id;
    const [sources, flows, incidents] = await Promise.all([
      db.$queryRaw<Array<Record<string, unknown>>>`
        SELECT "id", "sourceType", "sourceName", "sourceTrustLevel", "sensitivityLevel", "contentHash", "createdAt"
        FROM "ContextSource" WHERE "projectId" = ${projectId} AND "sessionId" = ${sessionId} ORDER BY "createdAt" ASC
      `,
      db.$queryRaw<Array<Record<string, unknown>>>`
        SELECT "id", "sourceId", "destinationType", "destinationName", "destinationTrustLevel", "action", "decision", "riskLevel", "reason", "createdAt"
        FROM "ContextFlow" WHERE "projectId" = ${projectId} AND "sessionId" = ${sessionId} ORDER BY "createdAt" ASC
      `,
      db.$queryRaw<Array<Record<string, unknown>>>`
        SELECT "id", "incidentType", "riskLevel", "summary", "status", "createdAt"
        FROM "LineageIncident" WHERE "projectId" = ${projectId} AND "sessionId" = ${sessionId} ORDER BY "createdAt" ASC
      `,
    ]);
    return jsonResponse({ sessionId, sources, flows, incidents });
  } catch (error) {
    return routeError(error, "Lineage session could not be loaded.");
  }
}
