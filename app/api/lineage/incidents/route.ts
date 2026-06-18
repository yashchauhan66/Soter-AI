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
          SELECT "id", "sessionId", "incidentType", "riskLevel", "summary", "involvedSourcesJson", "involvedDestinationsJson", "recommendedFix", "status", "createdAt", "updatedAt"
          FROM "LineageIncident" WHERE "projectId" = ${projectId} AND "status" = ${status} ORDER BY "createdAt" DESC LIMIT 200
        `
      : await db.$queryRaw<Array<Record<string, unknown>>>`
          SELECT "id", "sessionId", "incidentType", "riskLevel", "summary", "involvedSourcesJson", "involvedDestinationsJson", "recommendedFix", "status", "createdAt", "updatedAt"
          FROM "LineageIncident" WHERE "projectId" = ${projectId} ORDER BY "createdAt" DESC LIMIT 200
        `;
    return jsonResponse({ incidents: rows });
  } catch (error) {
    return routeError(error, "Lineage incidents could not be listed.");
  }
}
