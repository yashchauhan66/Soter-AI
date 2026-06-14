// SECURITY: Razorpay billing integration.
// - Webhook signatures are verified server-side using the configured
//   RAZORPAY_WEBHOOK_SECRET. Any payload that fails verification is recorded
//   to PaymentEvent with signatureValid=false and ignored.
// - The server NEVER trusts client-side payment status. Plan changes only
//   happen after a verified subscription.activated / payment.captured event.
// - In sandbox mode (no RAZORPAY_KEY_ID), checkout creation returns a mock
//   order id so the UI flow stays exercisable in development.

import crypto from "crypto";
import type { ProjectPlan } from "@prisma/client";

export const PLAN_PRICING: Record<Exclude<ProjectPlan, "DEMO" | "ENTERPRISE">, { amount: number; razorpayPlanIdEnv: string; label: string }> = {
  FREE:    { amount: 0,           razorpayPlanIdEnv: "RAZORPAY_PLAN_FREE",    label: "Free" },
  STARTER: { amount: 999_00,      razorpayPlanIdEnv: "RAZORPAY_PLAN_STARTER", label: "Starter" },
  PRO:     { amount: 2_999_00,    razorpayPlanIdEnv: "RAZORPAY_PLAN_PRO",     label: "Pro" },
  AGENCY:  { amount: 9_999_00,    razorpayPlanIdEnv: "RAZORPAY_PLAN_AGENCY",  label: "Agency" },
};

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

let cachedClient: import("razorpay") | null = null;

export async function getRazorpayClient() {
  if (cachedClient) return cachedClient;
  if (!razorpayConfigured()) return null;
  // Dynamic import keeps the SDK out of edge bundles.
  const { default: Razorpay } = await import("razorpay");
  cachedClient = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
  return cachedClient;
}

export function verifyRazorpayWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function planForPriceId(razorpayPlanId: string): ProjectPlan | null {
  for (const [plan, config] of Object.entries(PLAN_PRICING)) {
    if (process.env[config.razorpayPlanIdEnv] === razorpayPlanId) return plan as ProjectPlan;
  }
  return null;
}
