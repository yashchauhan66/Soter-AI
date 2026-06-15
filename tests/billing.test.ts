import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import {
  PLAN_PRICING,
  planForPriceId,
  razorpayConfigDiagnostics,
  razorpayConfigured,
  razorpayKeyId,
  razorpayKeySecret,
  razorpayPlanId,
  razorpayWebhookSecret,
  verifyPaymentSignature,
  verifyRazorpayWebhook,
} from "../lib/billing/razorpay";

function setEnv(values: Record<string, string | undefined>) {
  const prior: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    prior[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("razorpay env values strip surrounding straight and smart quotes plus whitespace", () => {
  const restore = setEnv({
    RAZORPAY_KEY_ID: '  "rzp_test_abc"  ',
    RAZORPAY_KEY_SECRET: "'top-secret'",
    RAZORPAY_WEBHOOK_SECRET: "“hook-secret”",
    RAZORPAY_PLAN_STARTER: "plan_starter_xyz",
  });
  try {
    assert.equal(razorpayKeyId(), "rzp_test_abc");
    assert.equal(razorpayKeySecret(), "top-secret");
    assert.equal(razorpayWebhookSecret(), "hook-secret");
    assert.equal(razorpayPlanId("RAZORPAY_PLAN_STARTER"), "plan_starter_xyz");
    assert.equal(razorpayConfigured(), true);
  } finally {
    restore();
  }
});

test("razorpayConfigured returns false when key id or secret is empty or quote-only", () => {
  const restore = setEnv({
    RAZORPAY_KEY_ID: '""',
    RAZORPAY_KEY_SECRET: "valid-secret",
  });
  try {
    assert.equal(razorpayConfigured(), false);
    const diag = razorpayConfigDiagnostics();
    assert.ok(diag.missing.includes("RAZORPAY_KEY_ID"));
  } finally {
    restore();
  }
});

test("config diagnostics warn when webhook or plan ids are missing", () => {
  const restore = setEnv({
    RAZORPAY_KEY_ID: "rzp_test_abc",
    RAZORPAY_KEY_SECRET: "secret",
    RAZORPAY_WEBHOOK_SECRET: "",
    RAZORPAY_PLAN_STARTER: "",
    RAZORPAY_PLAN_PRO: "",
    RAZORPAY_PLAN_AGENCY: "",
  });
  try {
    const diag = razorpayConfigDiagnostics();
    assert.equal(diag.ok, true);
    assert.ok(diag.warnings.some((warning) => warning.includes("RAZORPAY_WEBHOOK_SECRET")));
    assert.ok(diag.warnings.some((warning) => warning.includes("RAZORPAY_PLAN_STARTER")));
  } finally {
    restore();
  }
});

test("verifyRazorpayWebhook fails closed when the secret is empty", () => {
  const restore = setEnv({ RAZORPAY_WEBHOOK_SECRET: "" });
  try {
    const fakeSignature = crypto.createHmac("sha256", "x").update("{}").digest("hex");
    assert.equal(verifyRazorpayWebhook("{}", fakeSignature), false);
  } finally {
    restore();
  }
});

test("verifyRazorpayWebhook accepts a real signature computed with the configured secret", () => {
  const restore = setEnv({ RAZORPAY_WEBHOOK_SECRET: "  'live-hook-secret'  " });
  try {
    const body = JSON.stringify({ event: "payment.captured", id: "evt_1" });
    const signature = crypto.createHmac("sha256", "live-hook-secret").update(body).digest("hex");
    assert.equal(verifyRazorpayWebhook(body, signature), true);
    assert.equal(verifyRazorpayWebhook(body, signature.replace(/.$/, signature.endsWith("0") ? "1" : "0")), false);
  } finally {
    restore();
  }
});

test("verifyPaymentSignature uses the sanitized key secret", () => {
  const restore = setEnv({ RAZORPAY_KEY_SECRET: "\"my-secret\"" });
  try {
    const orderId = "order_123";
    const paymentId = "pay_456";
    const signature = crypto.createHmac("sha256", "my-secret").update(`${orderId}|${paymentId}`).digest("hex");
    assert.equal(verifyPaymentSignature(orderId, paymentId, signature), true);
  } finally {
    restore();
  }
});

test("planForPriceId matches sanitized plan id env values, ignores empty", () => {
  const restore = setEnv({
    RAZORPAY_PLAN_STARTER: "plan_real_starter",
    RAZORPAY_PLAN_PRO: "",
    RAZORPAY_PLAN_AGENCY: "  plan_agency  ",
  });
  try {
    assert.equal(planForPriceId("plan_real_starter"), "STARTER");
    assert.equal(planForPriceId("plan_agency"), "AGENCY");
    assert.equal(planForPriceId(""), null);
    assert.equal(planForPriceId("plan_pro_xyz"), null);
  } finally {
    restore();
  }
});

test("plan pricing table covers the three purchasable plans", () => {
  assert.equal(PLAN_PRICING.STARTER.amount, 999_00);
  assert.equal(PLAN_PRICING.PRO.amount, 2_999_00);
  assert.equal(PLAN_PRICING.AGENCY.amount, 9_999_00);
});

test("activate route stores the real plan amount instead of zero", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync("app/api/billing/activate/route.ts", "utf8");
  assert.match(source, /PLAN_AMOUNT\[body\.plan\]/);
  assert.doesNotMatch(source, /amount:\s*0,\s*\/\/\s*will be replaced/);
});

test("checkout route returns a 502 when Razorpay rejects the order", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync("app/api/billing/checkout/route.ts", "utf8");
  assert.match(source, /Razorpay rejected the order request/);
  assert.match(source, /status:\s*502/);
});

test("billing diagnostics route is admin-only and never leaks the raw key", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync("app/api/billing/diagnostics/route.ts", "utf8");
  assert.match(source, /requireAdmin\(\)/);
  assert.match(source, /keyId\.slice\(0,\s*12\)/);
  assert.doesNotMatch(source, /razorpayKeySecret\(\)/);
});
