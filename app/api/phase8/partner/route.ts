import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getActiveOrganization, requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createUniqueReferralCode } from "@/lib/phase8/partner";

const schema = z.object({ website: z.string().url().max(300).optional().or(z.literal("")), focusMarkets: z.array(z.string().trim().min(1).max(60)).max(12).default([]) });

export async function POST(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 404 });
    const access = await requirePermission(active.org.id, "project:update");
    const body = schema.parse(await readJson(request));
    const existing = await db.partnerProfile.findUnique({ where: { organizationId: active.org.id } });
    const profile = existing
      ? await db.partnerProfile.update({ where: { id: existing.id }, data: { website: body.website || null, focusMarkets: body.focusMarkets } })
      : await db.partnerProfile.create({ data: { organizationId: active.org.id, website: body.website || null, focusMarkets: body.focusMarkets, referralCode: await createUniqueReferralCode(active.org.name) } });
    await db.organization.update({ where: { id: active.org.id }, data: { type: "AGENCY" } });
    await db.organizationAuditLog.create({ data: { organizationId: active.org.id, actorUserId: access.user.id, action: existing ? "partner.updated" : "partner.created", category: "PARTNER", metadata: { tier: profile.tier } } });
    return jsonResponse(profile, { status: existing ? 200 : 201 });
  } catch (error) { return apiError(error, "Partner profile could not be saved."); }
}
