import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sendTemplateEmail } from "@/lib/email/send";

export async function POST(request: Request) {
  
  try {
    const body = z.object({ organizationId: z.string().min(1), email: z.string().trim().toLowerCase().email(), role: z.enum(["ADMIN", "DEVELOPER", "SECURITY_ANALYST", "BILLING", "VIEWER"]).default("DEVELOPER") }).parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "member:manage");
    const token = randomBytes(32).toString("base64url");
    const invite = await db.invite.create({ data: { organizationId: body.organizationId, email: body.email, role: body.role, invitedById: access.user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/signup?invite=${encodeURIComponent(token)}`;
    const result = await sendTemplateEmail({ to: body.email, template: "invite-member", data: { url, organizationName: access.org.name } });
    return jsonResponse({ id: invite.id, emailMocked: result.mocked, ...(result.mocked ? { developmentInviteUrl: url } : {}) }, { status: 201 });
  } catch (error) { return apiError(error, "Invitation could not be sent."); }
}
