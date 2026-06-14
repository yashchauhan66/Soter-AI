import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getOrCreateAgency } from "@/lib/agency";
import { getActiveOrganization, requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { clientSchema } from "@/lib/validations";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agency = await getOrCreateAgency();
    const clients = await db.client.findMany({
      where: { agencyId: agency.id },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
    });
    return jsonResponse(clients);
  } catch (error) { return apiError(error, "Clients could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 403 });
    await requirePermission(active.org.id, "agency:manage");
    const agency = await getOrCreateAgency();
    const body = clientSchema.parse(await readJson(request));
    const client = await db.client.create({
      data: { name: body.name, contactEmail: body.contactEmail ?? null, agencyId: agency.id },
    });
    return jsonResponse(client, { status: 201 });
  } catch (error) { return apiError(error, "Client could not be created."); }
}

export async function DELETE(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 403 });
    await requirePermission(active.org.id, "agency:manage");
    const agency = await getOrCreateAgency();
    const body = z.object({ id: z.string().min(1) }).parse(await readJson(request));
    const owned = await db.client.findFirst({ where: { id: body.id, agencyId: agency.id } });
    if (!owned) return jsonResponse({ error: true, message: "Client not found." }, { status: 404 });
    await db.client.delete({ where: { id: body.id } });
    return jsonResponse({ ok: true });
  } catch (error) { return apiError(error, "Client could not be deleted."); }
}
