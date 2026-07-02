import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
    const statusFilter = url.searchParams.get("status");

    const integration = await db.siemIntegration.findUnique({ where: { id }, select: { id: true } });
    if (!integration) return jsonResponse({ error: true, message: "Integration not found." }, { status: 404 });

    const deliveries = await db.siemDelivery.findMany({
      where: {
        integrationId: id,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, eventId: true, status: true, attempts: true,
        responseCode: true, errorMessage: true, nextAttemptAt: true,
        deliveredAt: true, createdAt: true,
      },
    });

    return jsonResponse({ deliveries });
  } catch (error) {
    return apiError(error, "SIEM deliveries could not be loaded.");
  }
}
