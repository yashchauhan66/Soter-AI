import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { verifyPaymentSignature, razorpayConfigured, PLAN_PRICING } from "@/lib/billing/razorpay";
import { z } from "zod";

const PLAN_AMOUNT: Record<"STARTER" | "PRO" | "AGENCY", number> = {
  STARTER: PLAN_PRICING.STARTER.amount,
  PRO: PLAN_PRICING.PRO.amount,
  AGENCY: PLAN_PRICING.AGENCY.amount,
};

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().min(1),
  plan: z.enum(["STARTER", "PRO", "AGENCY"]),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().optional(),
  mock: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "billing:update");

    // SECURITY: in production we MUST verify the signature server-side.
    // In sandbox/mock mode (Razorpay not configured) we accept the mock
    // session because no real payment was made.
    if (body.mock && process.env.NODE_ENV === "production") {
      return jsonResponse({ error: true, message: "Mock billing activation is disabled in production." }, { status: 403 });
    }
    if (!body.mock) {
      if (!razorpayConfigured()) {
        return jsonResponse({ error: true, message: "Razorpay is not configured." }, { status: 503 });
      }
      if (!body.razorpaySignature || !verifyPaymentSignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)) {
        await db.paymentEvent.create({
          data: {
            organizationId: access.org.id,
            eventId: `verify_failed_${body.razorpayPaymentId}`,
            eventType: "payment.verification.failed",
            payloadHash: body.razorpayPaymentId,
            signatureValid: false,
            payload: body as object,
          },
        });
        return jsonResponse({ error: true, message: "Payment signature verification failed." }, { status: 400 });
      }
    }

    const periodEnd = new Date();
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    await db.$transaction(async (tx) => {
      const previous = await tx.subscription.findUnique({ where: { organizationId: access.org.id } });
      await tx.subscription.upsert({
        where: { organizationId: access.org.id },
        create: {
          organizationId: access.org.id,
          plan: body.plan,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
        update: {
          plan: body.plan,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          cancelledAt: null,
          cancelAt: null,
        },
      });
      await tx.organization.update({
        where: { id: access.org.id },
        data: { plan: body.plan },
      });
      await tx.invoice.create({
        data: {
          organizationId: access.org.id,
          razorpayPaymentId: body.razorpayPaymentId,
          amount: body.mock ? 0 : (PLAN_AMOUNT[body.plan] ?? 0),
          status: body.mock ? "MOCK_PAID" : "PAID",
          paidAt: new Date(),
          invoiceNumber: `INV-${Date.now()}`,
        },
      });
      await tx.planChangeLog.create({
        data: {
          organizationId: access.org.id,
          fromPlan: previous?.plan ?? null,
          toPlan: body.plan,
          reason: body.mock ? "Sandbox checkout completion" : "Razorpay checkout success",
          changedById: access.user.id,
        },
      });
    });

    return jsonResponse({ ok: true, plan: body.plan, status: "ACTIVE", mock: !!body.mock });
  } catch (error) {
    return apiError(error, "Plan could not be activated.");
  }
}
