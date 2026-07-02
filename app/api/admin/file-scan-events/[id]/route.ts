import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const { id } = await params;
    const rows = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT *
      FROM "AIFileScanEvent"
      WHERE "id" = ${id} AND "organizationId" = ${organizationId}
      LIMIT 1
    `;
    if (!rows[0]) return jsonResponse({ error: true, message: "File scan event not found." }, { status: 404 });
    return jsonResponse({ event: rows[0] });
  } catch (error) {
    return apiError(error, "File scan event could not be loaded.");
  }
}
