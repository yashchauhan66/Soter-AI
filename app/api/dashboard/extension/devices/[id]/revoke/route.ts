import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  reason: z.string().trim().max(500).optional().default("Revoked from dashboard"),
});

// Revoking a device flips its status to "revoked"; the extension's device token
// then fails authentication on its next policy sync / heartbeat.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = schema.parse(await readJson(request));
    const { user } = await requirePermission(body.organizationId, "policy:manage");
    const device = await db.deviceAgent.findFirst({
      where: { id, organizationId: body.organizationId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!device) return jsonResponse({ error: true, message: "Device not found." }, { status: 404 });
    await db.deviceAgent.update({ where: { id }, data: { status: "revoked" } });
    await db.adminAuditLog.create({
      data: {
        adminUserId: user.id,
        organizationId: device.organizationId,
        action: "extension_device_revoked",
        targetType: "device_agent",
        targetId: id,
        reason: body.reason,
        metadata: { previousStatus: device.status, source: "dashboard" },
      },
    });
    return jsonResponse({ ok: true, id, status: "revoked" });
  } catch (error) {
    return apiError(error, "Device could not be revoked.");
  }
}
