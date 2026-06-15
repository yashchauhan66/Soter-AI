import { apiError, jsonResponse } from "@/lib/apiResponse";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { evaluateSubscriptionLifecycle } from "@/lib/phase8/billing";

export async function POST() {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 404 });
    const subscription = await db.subscription.findUnique({ where: { organizationId: active.org.id } });
    if (!subscription) return jsonResponse({ error: true, message: "No subscription on file." }, { status: 404 });
    const nextStatus = evaluateSubscriptionLifecycle(subscription);
    if (nextStatus !== subscription.status) {
      await db.subscription.update({ where: { id: subscription.id }, data: { status: nextStatus } });
      if (nextStatus === "EXPIRED") await db.organization.update({ where: { id: active.org.id }, data: { plan: "FREE" } });
    }
    return jsonResponse({ status: nextStatus, trialEndsAt: subscription.trialEndsAt, gracePeriodEndsAt: subscription.gracePeriodEndsAt });
  } catch (error) { return apiError(error, "Subscription lifecycle could not be evaluated."); }
}
