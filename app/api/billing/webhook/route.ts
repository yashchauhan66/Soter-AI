// SECURITY: Razorpay webhook receiver.
// - Reads the raw body BEFORE JSON parsing because the HMAC is computed over
//   the unparsed request body.
// - The signature header is `x-razorpay-signature`.
// - Every event is recorded to PaymentEvent regardless of validity, with
//   signatureValid set accordingly. We act on subscription.activated /
//   subscription.charged / payment.captured / subscription.cancelled only
//   when the signature checks out.

import crypto from "crypto";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { verifyRazorpayWebhook, planForPriceId } from "@/lib/billing/razorpay";
import type { ProjectPlan } from "@prisma/client";
import { sendTemplateEmail } from "@/lib/email/send";
import { failedPaymentWindow } from "@/lib/phase8/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const valid = verifyRazorpayWebhook(rawBody, signature);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: true, message: "Invalid JSON." }, { status: 400 });
  }

  const eventType = String(payload.event ?? "unknown");
  const eventId = String((payload as { id?: string }).id ?? `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  // Persist + dedupe via unique eventId.
  try {
    await db.paymentEvent.create({
      data: {
        eventId,
        eventType,
        payloadHash,
        signatureValid: valid,
        payload: payload as object,
      },
    });
  } catch (caught) {
    // Likely duplicate; treat as already-processed and ack.
    console.warn("Razorpay event dedup or error", caught);
    return jsonResponse({ ok: true, deduplicated: true });
  }

  if (!valid) {
    return jsonResponse({ error: true, message: "Signature invalid." }, { status: 400 });
  }

  try {
    await processRazorpayEvent(eventType, payload);
  } catch (caught) {
    console.error("Razorpay processing failed", caught);
    // Always 2xx so Razorpay does not flood retries; the event is on disk for replay.
    return jsonResponse({ ok: true, processed: false });
  }
  return jsonResponse({ ok: true });
}

async function processRazorpayEvent(eventType: string, payload: Record<string, unknown>) {
  const entityWrap = payload.payload as Record<string, unknown> | undefined;
  if (!entityWrap) return;

  // subscription.activated / subscription.charged / subscription.cancelled
  if (eventType.startsWith("subscription.")) {
    const sub = (entityWrap.subscription as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
    if (!sub) return;
    const subId = String(sub.id ?? "");
    const planRzpId = String(sub.plan_id ?? "");
    const targetPlan = planForPriceId(planRzpId);
    const status = mapSubStatus(eventType);
    const orgIdFromNotes = (sub.notes as Record<string, unknown> | undefined)?.organizationId as string | undefined;
    if (!orgIdFromNotes) return;

    const previous = await db.subscription.findUnique({ where: { organizationId: orgIdFromNotes } });
    await db.subscription.upsert({
      where: { organizationId: orgIdFromNotes },
      create: {
        organizationId: orgIdFromNotes,
        plan: targetPlan ?? "STARTER",
        status,
        razorpaySubscriptionId: subId,
        razorpayPlanId: planRzpId,
        currentPeriodStart: sub.current_start ? new Date(Number(sub.current_start) * 1000) : null,
        currentPeriodEnd: sub.current_end ? new Date(Number(sub.current_end) * 1000) : null,
        paymentFailedAt: status === "GRACE_PERIOD" || status === "PAST_DUE" ? new Date() : null,
        gracePeriodEndsAt: status === "GRACE_PERIOD" || status === "PAST_DUE" ? failedPaymentWindow(new Date()).gracePeriodEndsAt : null,
        cancelledAt: status === "CANCELLED" ? new Date() : null,
      },
      update: {
        status,
        razorpaySubscriptionId: subId,
        razorpayPlanId: planRzpId,
        plan: targetPlan ?? previous?.plan ?? "STARTER",
        currentPeriodStart: sub.current_start ? new Date(Number(sub.current_start) * 1000) : undefined,
        currentPeriodEnd: sub.current_end ? new Date(Number(sub.current_end) * 1000) : undefined,
        paymentFailedAt: status === "GRACE_PERIOD" || status === "PAST_DUE" ? new Date() : null,
        gracePeriodEndsAt: status === "GRACE_PERIOD" || status === "PAST_DUE" ? failedPaymentWindow(new Date()).gracePeriodEndsAt : null,
        cancelledAt: status === "CANCELLED" ? new Date() : null,
      },
    });
    if (targetPlan && status === "ACTIVE") {
      await db.organization.update({ where: { id: orgIdFromNotes }, data: { plan: targetPlan } });
      if (!previous || previous.plan !== targetPlan) {
        await db.planChangeLog.create({
          data: { organizationId: orgIdFromNotes, fromPlan: previous?.plan ?? null, toPlan: targetPlan, reason: `razorpay:${eventType}` },
        });
      }
    }
    if (status === "PAST_DUE" || status === "GRACE_PERIOD") {
      const org = await db.organization.findUnique({ where: { id: orgIdFromNotes }, select: { name: true, contactEmail: true } });
      if (org?.contactEmail) await sendTemplateEmail({ to: org.contactEmail, template: "payment-failed", data: { organizationName: org.name } });
    }
  }

  if (eventType === "payment.failed") {
    const payment = (entityWrap.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
    const organizationId = (payment?.notes as Record<string, unknown> | undefined)?.organizationId as string | undefined;
    if (!organizationId) return;
    const failedAt = new Date();
    const window = failedPaymentWindow(failedAt);
    await db.subscription.updateMany({ where: { organizationId }, data: { status: "GRACE_PERIOD", paymentFailedAt: failedAt, gracePeriodEndsAt: window.gracePeriodEndsAt } });
    const org = await db.organization.findUnique({ where: { id: organizationId }, select: { name: true, contactEmail: true } });
    if (org?.contactEmail) await sendTemplateEmail({ to: org.contactEmail, template: "payment-failed", data: { organizationName: org.name } });
  }

  // payment.captured / invoice.paid
  if (eventType === "payment.captured" || eventType === "invoice.paid") {
    const payment = (entityWrap.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
    const invoice = (entityWrap.invoice as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
    const orgId = (payment?.notes as Record<string, unknown> | undefined)?.organizationId as string | undefined
      || (invoice?.notes as Record<string, unknown> | undefined)?.organizationId as string | undefined;
    if (!orgId) return;
    await db.invoice.create({
      data: {
        organizationId: orgId,
        razorpayPaymentId: String(payment?.id ?? ""),
        razorpayInvoiceId: invoice ? String(invoice.id ?? "") : null,
        amount: Number(payment?.amount ?? invoice?.amount ?? 0),
        currency: String(payment?.currency ?? invoice?.currency ?? "INR"),
        status: "PAID",
        paidAt: new Date(),
        invoiceNumber: invoice ? String(invoice.id ?? "") : null,
        hostedUrl: invoice ? String(invoice.short_url ?? "") || null : null,
      },
    });
  }
}

function mapSubStatus(eventType: string): "ACTIVE" | "CANCELLED" | "PAST_DUE" | "GRACE_PERIOD" | "EXPIRED" | "TRIAL" {
  if (eventType === "subscription.cancelled") return "CANCELLED";
  if (eventType === "subscription.completed") return "EXPIRED";
  if (eventType === "subscription.halted") return "GRACE_PERIOD";
  if (eventType === "subscription.pending") return "PAST_DUE";
  return "ACTIVE";
}
