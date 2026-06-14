import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getOrCreateAgency } from "@/lib/agency";
import { getActiveOrganization, requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { brandingSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agency = await getOrCreateAgency();
    const branding = await db.brandingSettings.findUnique({ where: { agencyId: agency.id } });
    return jsonResponse(branding ?? null);
  } catch (error) { return apiError(error, "Branding could not be loaded."); }
}

export async function PUT(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 403 });
    await requirePermission(active.org.id, "agency:manage");
    const agency = await getOrCreateAgency();
    const body = brandingSchema.parse(await readJson(request));
    const data = {
      agencyName: body.agencyName,
      logoUrl: body.logoUrl || null,
      contactEmail: body.contactEmail || null,
      reportFooter: body.reportFooter || null,
      brandColor: body.brandColor ? (body.brandColor.startsWith("#") ? body.brandColor : `#${body.brandColor}`) : null,
    };
    const branding = await db.brandingSettings.upsert({
      where: { agencyId: agency.id },
      create: { agencyId: agency.id, ...data },
      update: data,
    });
    return jsonResponse(branding);
  } catch (error) { return apiError(error, "Branding could not be saved."); }
}
