import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import {
  getRazorpayClient,
  PLAN_PRICING,
  razorpayConfigDiagnostics,
  razorpayConfigured,
  razorpayKeyId,
} from "@/lib/billing/razorpay";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().min(1),
  plan: z.enum(["STARTER", "PRO", "AGENCY"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "billing:update");
    const config = PLAN_PRICING[body.plan];
    if (!config) return jsonResponse({ error: true, message: "Plan is not purchasable." }, { status: 400 });

    if (!razorpayConfigured()) {
      const diag = razorpayConfigDiagnostics();
      if (process.env.NODE_ENV === "production") {
        return jsonResponse({
          error: true,
          message: "Razorpay is not configured for production checkout.",
          missing: diag.missing,
        }, { status: 503 });
      }
      const mockOrderId = `order_mock_${Math.random().toString(36).slice(2, 12)}`;
      return jsonResponse({
        mock: true,
        orderId: mockOrderId,
        amount: config.amount,
        currency: "INR",
        plan: body.plan,
        keyId: "rzp_test_mock",
        message: "Razorpay credentials are not configured. Returning a sandbox order; set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to take real payments.",
        missing: diag.missing,
      });
    }
    const client = await getRazorpayClient();
    if (!client) {
      return jsonResponse({ error: true, message: "Razorpay client unavailable." }, { status: 503 });
    }
    let order: { id: string; amount: number | string; currency: string };
    try {
      order = await client.orders.create({
        amount: config.amount,
        currency: "INR",
        receipt: `org_${access.org.id.slice(0, 24)}_${Date.now()}`,
        notes: { organizationId: access.org.id, plan: body.plan },
      });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      return jsonResponse({
        error: true,
        message: "Razorpay rejected the order request. Verify the key id/secret pair and the test/live mode of the keys.",
        detail,
      }, { status: 502 });
    }

    return jsonResponse({
      mock: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan: body.plan,
      keyId: razorpayKeyId(),
    });

  } catch (error) {

    return apiError(error, "Checkout could not be created.");
  }
}
