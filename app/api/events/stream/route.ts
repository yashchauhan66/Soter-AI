import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireOrganizationAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    await requireOrganizationAccess(organizationId);
    const cursor = url.searchParams.get("cursor");
    const events = await db.securityEvent.findMany({ where: { organizationId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) }, orderBy: { createdAt: "desc" }, take: Math.min(100, Number(url.searchParams.get("limit") ?? 50)), select: { id: true, organizationId: true, projectId: true, eventType: true, severity: true, riskTypes: true, action: true, source: true, metadata: true, createdAt: true } });
    return jsonResponse({ events, nextCursor: events.at(-1)?.createdAt.toISOString() ?? null });
  } catch (error) { return apiError(error, "Security event stream could not be loaded."); }
}
