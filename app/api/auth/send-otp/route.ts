import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import {
  createEmailVerificationOtp,
  EMAIL_OTP_RESEND_COOLDOWN_MS,
} from "@/lib/auth/emailOtp";
import { resolveEmailDeliveryMode } from "@/lib/auth/signupPolicy";
import { sendTemplateEmail } from "@/lib/email/send";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
});

const GENERIC_MESSAGE = "If this email has a pending account, a new code has been sent.";

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const limited = await enforcePublicRateLimit({
      request,
      scope: "auth:send-otp",
      limit: 5,
      windowMs: 60 * 60_000,
      subject: body.email,
      message: "Too many code requests. Please try again later.",
    });
    if (limited) return limited;

    const deliveryMode = resolveEmailDeliveryMode();
    if (deliveryMode === "blocked") {
      return jsonResponse(
        { error: true, message: "Email delivery is temporarily unavailable." },
        { status: 503, headers: { "Retry-After": "60" } },
      );
    }

    const user = await db.user.findUnique({
      where: { email: body.email },
      select: { id: true, emailVerifiedAt: true },
    });

    // A generic success prevents account discovery through this public route.
    if (!user || user.emailVerifiedAt) {
      return jsonResponse({ ok: true, message: GENERIC_MESSAGE });
    }

    const latest = await db.emailVerificationOtp.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const elapsed = latest ? Date.now() - latest.createdAt.getTime() : EMAIL_OTP_RESEND_COOLDOWN_MS;
    if (elapsed < EMAIL_OTP_RESEND_COOLDOWN_MS) {
      const retryAfter = Math.max(1, Math.ceil((EMAIL_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
      return jsonResponse(
        { error: true, message: `Please wait ${retryAfter} seconds before requesting another code.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const code = await db.$transaction((tx) => createEmailVerificationOtp(user.id, new Date(), tx));
    try {
      await sendTemplateEmail({
        to: body.email,
        template: "verify-email-otp",
        data: { otp: code },
      });
    } catch (sendError) {
      console.error("send-otp.email_failed", {
        userId: user.id,
        reason: sendError instanceof Error ? sendError.name : "unknown",
      });
      return jsonResponse(
        { error: true, message: "We could not send the code. Please try again shortly." },
        { status: 503, headers: { "Retry-After": "60" } },
      );
    }

    return jsonResponse({
      ok: true,
      message: GENERIC_MESSAGE,
      ...(deliveryMode === "mock" ? { developmentOtp: code } : {}),
    });
  } catch (error) {
    return apiError(error, "Failed to send verification code.");
  }
}
