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

function sanitizeEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) return "";
  let value = raw.trim();
  const pairs: Array<[string, string]> = [
    ["\"", "\""],
    ["'", "'"],
    ["`", "`"],
    ["“", "”"], // “ ”
    ["‘", "’"], // ‘ ’
  ];
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    for (const [open, close] of pairs) {
      if (first === open && last === close) {
        value = value.slice(1, -1).trim();
        break;
      }
    }
  }
  return value;
}

export function razorpayKeyId(): string {
  return sanitizeEnv("RAZORPAY_KEY_ID");
}

export function razorpayKeySecret(): string {
  return sanitizeEnv("RAZORPAY_KEY_SECRET");
}

export function razorpayWebhookSecret(): string {
  return sanitizeEnv("RAZORPAY_WEBHOOK_SECRET");
}

export function razorpayPlanId(envName: string): string {
  return sanitizeEnv(envName);
}

export function razorpayConfigured(): boolean {
  return Boolean(razorpayKeyId() && razorpayKeySecret());
}

export function createRazorpayReceipt(organizationId: string, now = Date.now()): string {
  const organizationPart = organizationId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
  return `org_${organizationPart}_${now.toString(36)}`.slice(0, 40);
}

export function razorpayConfigDiagnostics(): { ok: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!razorpayKeyId()) missing.push("RAZORPAY_KEY_ID");
  if (!razorpayKeySecret()) missing.push("RAZORPAY_KEY_SECRET");
  if (!razorpayWebhookSecret()) warnings.push("RAZORPAY_WEBHOOK_SECRET is not set; webhook signature verification will fail.");
  for (const plan of ["RAZORPAY_PLAN_STARTER", "RAZORPAY_PLAN_PRO", "RAZORPAY_PLAN_AGENCY"]) {
    if (!razorpayPlanId(plan)) warnings.push(`${plan} is not set; subscription events for this plan will not map.`);
  }
  return { ok: missing.length === 0, missing, warnings };
}

let cachedClient: import("razorpay") | null = null;

export async function getRazorpayClient() {
  if (cachedClient) return cachedClient;
  if (!razorpayConfigured()) return null;
  // Dynamic import keeps the SDK out of edge bundles.
  const { default: Razorpay } = await import("razorpay");
  cachedClient = new Razorpay({
    key_id: razorpayKeyId(),
    key_secret: razorpayKeySecret(),
  });
  return cachedClient;
}

export function verifyRazorpayWebhook(rawBody: string, signature: string | null): boolean {
  const secret = razorpayWebhookSecret();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = razorpayKeySecret();
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function planForPriceId(razorpayPlanIdValue: string): ProjectPlan | null {
  if (!razorpayPlanIdValue) return null;
  for (const [plan, config] of Object.entries(PLAN_PRICING)) {
    if (razorpayPlanId(config.razorpayPlanIdEnv) === razorpayPlanIdValue) return plan as ProjectPlan;
  }
  return null;
}
