import { apiError, jsonResponse } from "@/lib/apiResponse";
import { authenticateExtensionRequest } from "../_shared";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const auth = await authenticateExtensionRequest(request, organizationId);
    if (!auth.ok) return auth.response;
    const sourceApps = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "name", "domains", "category", "enabled", "sensitivity"
      FROM "SourceAppConfig"
      WHERE "organizationId" = ${organizationId} AND "enabled" = true
      ORDER BY "name" ASC
    `;
    return jsonResponse({ sourceApps });
  } catch (error) {
    return apiError(error, "Source apps could not be loaded.");
  }
}
