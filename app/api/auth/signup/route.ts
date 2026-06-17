import bcrypt from "bcryptjs";
import { z } from "zod";
import { trialWindow } from "@/lib/ops/billing";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { createEmailVerificationToken } from "@/lib/auth/tokens";
import { sendTemplateEmail } from "@/lib/email/send";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  organizationName: z.string().trim().min(2).max(120).optional(),
  organizationType: z.enum(["DIRECT_BUSINESS", "AGENCY"]).default("DIRECT_BUSINESS"),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const limited = await enforcePublicRateLimit({
      request,
      scope: "auth:signup",
      limit: 5,
      windowMs: 60 * 60_000,
      subject: body.email,
      message: "Too many sign-up attempts. Please try again later.",
    });
    if (limited) return limited;
    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return jsonResponse({ error: true, message: "Email is already registered." }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const orgName = body.organizationName ?? `${body.name ?? body.email.split("@")[0]} workspace`;
    const slug = `org-${Math.random().toString(36).slice(2, 14)}`;

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash,
        },
      });
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          type: body.organizationType,
          plan: "FREE",
          contactEmail: body.email,
        },
      });
      await tx.organizationMember.create({
        data: { organizationId: org.id, userId: user.id, role: "OWNER" },
      });
      const trial = trialWindow(new Date());
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          plan: "FREE",
          status: "TRIAL",
          currentPeriodStart: trial.startedAt,
          currentPeriodEnd: trial.trialEndsAt,
          trialEndsAt: trial.trialEndsAt,
        },
      });
      await tx.onboardingProgress.create({
        data: { userId: user.id },
      });
      if (body.organizationType === "AGENCY") {
        await tx.agency.create({
          data: {
            name: orgName,
            contactEmail: body.email,
            userId: user.id,
            organizationId: org.id,
          },
        });
      }
      return { userId: user.id, organizationId: org.id };
    });

    // CRG-003: Email token is created and send attempted AFTER the DB transaction.
    // If the email send fails, the account exists but is unverified. We still
    // return 201 so the client can prompt the user to check their inbox or use
    // the resend-verification endpoint. The error is logged server-side.
    const token = await createEmailVerificationToken(result.userId);
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify-email?token=${encodeURIComponent(token)}`;
    let emailMocked = false;
    let emailFailed = false;
    try {
      const emailResult = await sendTemplateEmail({ to: body.email, template: "verify-email", data: { url: verifyUrl } });
      emailMocked = emailResult.mocked;
    } catch (emailError) {
      // Log the failure but do not expose details to the client. User can
      // request a new verification email via the resend endpoint.
      console.error("[CyberRakshak] Verification email failed to send for new signup:", body.email, emailError);
      emailFailed = true;
    }

    return jsonResponse({
      ok: true,
      ...result,
      verificationEmailMocked: emailMocked,
      verificationEmailFailed: emailFailed,
      ...(emailMocked ? { developmentVerificationUrl: verifyUrl } : {}),
    }, { status: 201 });
  } catch (error) {
    return apiError(error, "Sign up failed.");
  }
}
