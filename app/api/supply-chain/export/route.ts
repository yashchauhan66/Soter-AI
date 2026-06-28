import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { exportAiBomCycloneDx, generateAiBillOfMaterialsSnapshot } from "@/lib/supply-chain";

type Snapshot = ReturnType<typeof generateAiBillOfMaterialsSnapshot>;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const access = await requireProjectPermission(projectId, "reports:export");
    const rows = await db.$queryRaw<Array<{ snapshot: unknown; createdAt: Date }>>`
      SELECT "snapshot", "createdAt" FROM "AiBillOfMaterials"
      WHERE "organizationId" = ${access.org.id} AND "projectId" = ${access.project.id}
      ORDER BY "createdAt" DESC LIMIT 1
    `;
    if (!rows[0]) return jsonResponse({ error: true, message: "No AI-BOM snapshot is available for this project." }, { status: 404 });
    const exported = exportAiBomCycloneDx({ organizationId: access.org.id, projectId: access.project.id, snapshot: rows[0].snapshot as Snapshot, generatedAt: rows[0].createdAt.toISOString() });
    return jsonResponse({ export: exported });
  } catch (error) {
    return apiError(error, "AI-BOM export could not be generated.");
  }
}
