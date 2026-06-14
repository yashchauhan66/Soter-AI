import { apiError, jsonResponse } from "@/lib/apiResponse";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { guardLogListSelect } from "@/lib/guard/logSelect";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse([]);
    const params = new URL(request.url).searchParams;
    const projectId = params.get("projectId");
    const cursor = params.get("cursor");
    const limitValue = Number(params.get("limit") ?? 50);
    const limit = Number.isFinite(limitValue) ? Math.min(100, Math.max(10, limitValue)) : 50;
    const logs = await db.guardLog.findMany({
      where: {
        project: { organizationId: active.org.id },
        ...(projectId ? { projectId } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { ...guardLogListSelect, project: { select: { name: true } } },
    });
    
    return jsonResponse(logs);
  } catch (error) { return apiError(error, "Guard logs could not be loaded."); }
}
