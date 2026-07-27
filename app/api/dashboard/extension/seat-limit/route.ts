import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Sets the browser-extension seat cap for an org. `seatLimit: null` = unlimited.
const bodySchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  seatLimit: z.number().int().min(0).max(1_000_000).nullable(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { user } = await requirePermission(body.organizationId, "policy:manage");

    const activeSeats = await db.deviceAgent.count({
      where: { organizationId: body.organizationId, type: "browser_extension", status: "active" },
    });

    await db.organization.update({
      where: { id: body.organizationId },
      data: { extensionSeatLimit: body.seatLimit },
    });

    await db.adminAuditLog.create({
      data: {
        adminUserId: user.id,
        organizationId: body.organizationId,
        action: "extension_seat_limit_updated",
        targetType: "organization",
        targetId: body.organizationId,
        reason: "Updated browser-extension seat limit",
        metadata: { seatLimit: body.seatLimit, activeSeatsAtChange: activeSeats },
      },
    });

    return jsonResponse({ ok: true, seatLimit: body.seatLimit, activeSeats });
  } catch (error) {
    return apiError(error, "Extension seat limit could not be saved.");
  }
}
