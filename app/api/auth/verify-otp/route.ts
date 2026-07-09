import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { emailOtpMatches, EMAIL_OTP_MAX_ATTEMPTS } from "@/lib/auth/emailOtp";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  otp: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit code."),
});

const INVALID_MESSAGE = "The code is invalid or expired. Request a new code and try again.";

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const limited = await enforcePublicRateLimit({
      request,
      scope: "auth:verify-otp",
      limit: 10,
      windowMs: 60 * 60_000,
      subject: body.email,
      message: "Too many verification attempts. Please try again later.",
    });
    if (limited) return limited;

    const user = await db.user.findUnique({
      where: { email: body.email },
      select: { id: true, emailVerifiedAt: true },
    });
    if (!user) return jsonResponse({ error: true, message: INVALID_MESSAGE }, { status: 400 });
    if (user.emailVerifiedAt) {
      return jsonResponse({ ok: true, message: "Email is already verified." });
    }

    const now = new Date();
    const record = await db.emailVerificationOtp.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!record) return jsonResponse({ error: true, message: INVALID_MESSAGE }, { status: 400 });

    if (!emailOtpMatches(user.id, body.otp, record.codeHash)) {
      const updated = await db.emailVerificationOtp.update({
        where: { id: record.id },
        data: {
          attempts: { increment: 1 },
          ...(record.attempts + 1 >= EMAIL_OTP_MAX_ATTEMPTS ? { usedAt: now } : {}),
        },
        select: { attempts: true },
      });
      const exhausted = updated.attempts >= EMAIL_OTP_MAX_ATTEMPTS;
      return jsonResponse(
        {
          error: true,
          message: exhausted ? "Too many failed attempts. Request a new code." : "The code is incorrect.",
          attemptsRemaining: Math.max(0, EMAIL_OTP_MAX_ATTEMPTS - updated.attempts),
        },
        { status: exhausted ? 429 : 400 },
      );
    }

    const verified = await db.$transaction(async (tx) => {
      // Conditional consume makes two simultaneous submissions one-time safe.
      const consumed = await tx.emailVerificationOtp.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      await tx.emailVerificationOtp.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      return true;
    });

    if (!verified) return jsonResponse({ error: true, message: INVALID_MESSAGE }, { status: 400 });
    return jsonResponse({ ok: true, message: "Email verified successfully." });
  } catch (error) {
    return apiError(error, "OTP verification failed.");
  }
}
