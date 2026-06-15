import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = z.object({ organizationId: z.string(), reason: z.string().trim().max(300).optional() }).parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "billing:update");
    const subscription = await db.subscription.findUnique({ where: { organizationId: access.org.id } });
    if (!subscription) return jsonResponse({ error: true, message: "No subscription on file." }, { status: 404 });
    const now = new Date();
    const stillPaid = subscription.cancelAt && subscription.cancelAt > now;
    if (!stillPaid && subscription.status !== "TRIAL") {
      return jsonResponse({ error: true, message: "This subscription period has ended. Start a server-verified checkout to reactivate." }, { status: 409 });
    }
    const updated = await db.subscription.update({ where: { id: subscription.id }, data: { status: subscription.status === "TRIAL" ? "TRIAL" : "ACTIVE", cancelAt: null, cancelledAt: null, reactivatedAt: now } });
    await db.planChangeLog.create({ data: { organizationId: access.org.id, fromPlan: subscription.plan, toPlan: subscription.plan, changedById: access.user.id, reason: body.reason ?? "User reactivated before period end" } });
    await db.organizationAuditLog.create({ data: { organizationId: access.org.id, actorUserId: access.user.id, action: "billing.subscription_reactivated", category: "BILLING", metadata: { subscriptionId: subscription.id } } });
    return jsonResponse({ ok: true, status: updated.status });
  } catch (error) { return apiError(error, "Subscription could not be reactivated."); }
}
