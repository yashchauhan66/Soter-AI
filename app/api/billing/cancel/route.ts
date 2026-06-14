import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ organizationId: z.string().min(1), reason: z.string().max(300).optional() });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "billing:update");
    const sub = await db.subscription.findUnique({ where: { organizationId: access.org.id } });
    if (!sub) return jsonResponse({ error: true, message: "No subscription on file." }, { status: 404 });
    await db.subscription.update({
      where: { organizationId: access.org.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelAt: sub.currentPeriodEnd ?? new Date() },
    });
    await db.planChangeLog.create({
      data: {
        organizationId: access.org.id,
        fromPlan: sub.plan,
        toPlan: "FREE",
        reason: body.reason ?? "User-initiated cancel",
        changedById: access.user.id,
      },
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "Subscription could not be cancelled.");
  }
}
