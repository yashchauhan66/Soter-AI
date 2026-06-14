import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { createEmailVerificationToken } from "@/lib/auth/tokens";
import { sendTemplateEmail } from "@/lib/email/send";

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
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          plan: "FREE",
          status: "TRIAL",
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

    const token = await createEmailVerificationToken(result.userId);
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify-email?token=${encodeURIComponent(token)}`;
    const email = await sendTemplateEmail({ to: body.email, template: "verify-email", data: { url: verifyUrl } });
    return jsonResponse({ ok: true, ...result, verificationEmailMocked: email.mocked, ...(email.mocked ? { developmentVerificationUrl: verifyUrl } : {}) }, { status: 201 });
  } catch (error) {
    return apiError(error, "Sign up failed.");
  }
}
