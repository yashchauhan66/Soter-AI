import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getActiveOrganization, requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse([]);
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    return jsonResponse(await db.ragCollection.findMany({ where: { organizationId: active.org.id, ...(projectId ? { projectId } : {}) }, include: { _count: { select: { documents: true } } }, orderBy: { createdAt: "desc" } }));
  } catch (error) { return apiError(error, "RAG collections could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const body = z.object({ projectId: z.string().min(1), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional() }).parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "rag:manage");
    const collection = await db.ragCollection.create({ data: { organizationId: access.org.id, projectId: access.project.id, name: body.name, description: body.description } });
    return jsonResponse(collection, { status: 201 });
  } catch (error) { return apiError(error, "RAG collection could not be created."); }
}
