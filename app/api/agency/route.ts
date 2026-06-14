import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getOrCreateAgency } from "@/lib/agency";
import { requirePermission, getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agencySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agency = await getOrCreateAgency();
    return jsonResponse(agency);
  } catch (error) { return apiError(error, "Agency could not be loaded."); }
}

export async function PATCH(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 403 });
    await requirePermission(active.org.id, "agency:manage");
    const agency = await getOrCreateAgency();
    const body = agencySchema.parse(await readJson(request));
    const updated = await db.agency.update({
      where: { id: agency.id },
      data: { name: body.name, contactEmail: body.contactEmail ?? null },
    });
    return jsonResponse(updated);
  } catch (error) { return apiError(error, "Agency could not be updated."); }
}
