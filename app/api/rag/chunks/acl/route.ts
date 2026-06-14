import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getVectorProvider } from "@/lib/rag/vector/vectorProvider";

const roles = ["OWNER", "ADMIN", "DEVELOPER", "SECURITY_ANALYST", "BILLING", "VIEWER"] as const;
const schema = z.object({ chunkId: z.string().min(1), allowedRoles: z.array(z.enum(roles)).min(1).max(roles.length), sensitivityLabel: z.string().trim().min(1).max(50).default("INTERNAL"), sourceUrl: z.string().url().max(2_000).nullable().optional() });

export async function PUT(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const chunk = await db.ragChunk.findUnique({ where: { id: body.chunkId }, include: { document: { include: { collection: true } } } });
    if (!chunk) return jsonResponse({ error: true, message: "Chunk not found." }, { status: 404 });
    const access = await requireProjectPermission(chunk.document.collection.projectId, "rag:manage");
    if (!['OWNER', 'ADMIN', 'SECURITY_ANALYST'].includes(access.role) && !access.user.isAdmin) return jsonResponse({ error: true, message: "Security review role required." }, { status: 403 });
    const updated = await db.ragChunk.update({ where: { id: chunk.id }, data: { allowedRoles: body.allowedRoles, sensitivityLabel: body.sensitivityLabel, sourceUrl: body.sourceUrl } });
    if (chunk.document.status === "INDEXED") {
      await (await getVectorProvider()).indexChunks([{ id: updated.id, organizationId: access.org.id, projectId: access.project.id, collectionId: chunk.document.collectionId, documentId: chunk.documentId, documentStatus: "INDEXED", textRedacted: updated.textRedacted, allowedRoles: updated.allowedRoles, sourceUrl: updated.sourceUrl ?? undefined, sensitivityLabel: updated.sensitivityLabel, metadata: updated.metadata && typeof updated.metadata === "object" && !Array.isArray(updated.metadata) ? updated.metadata as Record<string, unknown> : undefined }]);
    }
    
    return jsonResponse({ id: updated.id, allowedRoles: updated.allowedRoles, sensitivityLabel: updated.sensitivityLabel, sourceUrl: updated.sourceUrl });
  } catch (error) {
    return apiError(error, "Chunk ACL could not be updated.");
  }
}
