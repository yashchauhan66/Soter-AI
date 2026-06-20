import bcrypt from "bcryptjs";
import { z } from "zod";
import { trialWindow } from "@/lib/ops/billing";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { createEmailVerificationToken } from "@/lib/auth/tokens";
import { sendTemplateEmail } from "@/lib/email/send";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";
import {
  planSignup,
  resolveEmailDeliveryMode,
  requireVerifiedEmailForLogin,
  type EmailDeliveryMode,
} from "@/lib/auth/signupPolicy";

export const dynamic = "force-dynamic";

// The signup transaction creates the user, workspace, membership, trial,
// onboarding state, and verification token. On a cold serverless Postgres
// connection those sequential writes can legitimately exceed Prisma's
// 5-second interactive-transaction default.
const SIGNUP_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  organizationName: z.string().trim().min(2).max(120).optional(),
  organizationType: z.enum(["DIRECT_BUSINESS", "AGENCY"]).default("DIRECT_BUSINESS"),
});

function verifyUrlFor(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

// Sends the verification email. Returns whether it was mocked, or surfaces a
// delivery failure to the caller WITHOUT leaking the raw token into logs.
async function deliverVerification(to: string, token: string) {
  const email = await sendTemplateEmail({ to, template: "verify-email", data: { url: verifyUrlFor(token) } });
  return { mocked: email.mocked };
}

// Shapes the success body. In mock mode we expose the verification URL so local
// and e2e flows can complete; in live mode we never return the token.
function successBody(opts: {
  deliveryMode: EmailDeliveryMode;
  token: string;
  emailSent: boolean;
  extra?: Record<string, unknown>;
}) {
  const verificationRequired = requireVerifiedEmailForLogin();
  return {
    ok: true,
    verificationRequired,
    emailSent: opts.emailSent,
    verificationEmailMocked: opts.deliveryMode === "mock",
    ...(opts.deliveryMode === "mock" ? { developmentVerificationUrl: verifyUrlFor(opts.token) } : {}),
    ...opts.extra,
  };
}

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

    // Fail fast BEFORE any database write if email cannot be delivered. This
    // is the core CRG-RT-005 fix: never commit a half-created account behind a
    // production mock-email misconfiguration.
    const deliveryMode = resolveEmailDeliveryMode();

    const existing = await db.user.findUnique({
      where: { email: body.email },
      select: { id: true, emailVerifiedAt: true, passwordHash: true, ssoOnly: true },
    });

    const plan = planSignup({ existingUser: existing, deliveryMode });

    if (plan.kind === "blocked-email-provider") {
      return jsonResponse(
        { error: true, message: "Sign-up is temporarily unavailable while email delivery is being configured. Please try again shortly." },
        { status: 503 },
      );
    }

    // Idempotent recovery: an existing UNVERIFIED password account regenerates
    // and resends verification instead of erroring or duplicating the user.
    if (plan.kind === "resend") {
      const userId = existing!.id;
      const token = await createEmailVerificationToken(userId);
      let emailSent = true;
      try {
        await deliverVerification(body.email, token);
      } catch (sendError) {
        console.error("signup.resend.email_failed", { userId, reason: sendError instanceof Error ? sendError.name : "unknown" });
        emailSent = false;
      }
      return jsonResponse(successBody({ deliveryMode, token, emailSent, extra: { resent: true } }), { status: 200 });
    }

    // A verified / SSO / passwordless account already owns this email.
    if (plan.kind === "reject-existing") {
      return jsonResponse({ error: true, message: "Email is already registered. Please sign in instead." }, { status: 409 });
    }

    // New account. User + workspace + token are created atomically so a later
    // email failure can only ever leave a consistent, recoverable pending state.
    const passwordHash = await bcrypt.hash(body.password, 12);
    const orgName = body.organizationName ?? `${body.name ?? body.email.split("@")[0]} workspace`;
    const slug = `org-${Math.random().toString(36).slice(2, 14)}`;

    let created: { userId: string; organizationId: string; token: string };
    try {
      created = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: body.email, name: body.name, passwordHash },
        });
        const org = await tx.organization.create({
          data: { name: orgName, slug, type: body.organizationType, plan: "FREE", contactEmail: body.email },
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
        await tx.onboardingProgress.create({ data: { userId: user.id } });
        if (body.organizationType === "AGENCY") {
          await tx.agency.create({
            data: { name: orgName, contactEmail: body.email, userId: user.id, organizationId: org.id },
          });
        }
        // Token created inside the transaction: a user without a usable token
        // (or a token without a user) can never be committed.
        const token = await createEmailVerificationToken(user.id, new Date(), tx);
        return { userId: user.id, organizationId: org.id, token };
      }, SIGNUP_TRANSACTION_OPTIONS);
    } catch (txError) {
      // Unique-constraint race: a concurrent request created the same email.
      if (txError && typeof txError === "object" && "code" in txError && (txError as { code?: string }).code === "P2002") {
        return jsonResponse({ error: true, message: "Email is already registered. Please sign in instead." }, { status: 409 });
      }
      throw txError;
    }

    // Email send happens AFTER commit, but the committed state is already
    // consistent (complete user + valid token). A failure here is recoverable:
    // the user simply re-submits signup and hits the idempotent resend path.
    let emailSent = true;
    try {
      await deliverVerification(body.email, created.token);
    } catch (sendError) {
      console.error("signup.create.email_failed", { userId: created.userId, reason: sendError instanceof Error ? sendError.name : "unknown" });
      emailSent = false;
    }

    return jsonResponse(
      successBody({
        deliveryMode,
        token: created.token,
        emailSent,
        extra: { userId: created.userId, organizationId: created.organizationId },
      }),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, "Sign up failed.");
  }
}
