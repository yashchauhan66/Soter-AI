import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { createPasswordResetToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { sendTemplateEmail } from "@/lib/email/send";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

export async function POST(request: Request) {
  try {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(await readJson(request));
    const limited = await enforcePublicRateLimit({
      request,
      scope: "auth:password-reset-request",
      limit: 5,
      windowMs: 60 * 60_000,
      subject: email,
      message: "Too many password reset attempts. Please try again later.",
    });
    if (limited) return limited;
    const user = await db.user.findUnique({ where: { email } });
    let developmentResetUrl: string | undefined;
    if (user) {
      const token = await createPasswordResetToken(user.id);
      const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;
      const result = await sendTemplateEmail({ to: email, template: "password-reset", data: { url } });
      if (result.mocked) developmentResetUrl = url;
    }
    return jsonResponse({ ok: true, message: "If that account exists, a reset link has been sent.", ...(developmentResetUrl ? { developmentResetUrl } : {}) });
  } catch (error) { return apiError(error, "Password reset request failed."); }
}
