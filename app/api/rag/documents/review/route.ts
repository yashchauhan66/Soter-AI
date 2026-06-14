import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getVectorProvider } from "@/lib/rag/vector/vectorProvider";

export async function POST(request: Request) {
  try {
    const body = z.object({ documentId: z.string().min(1), action: z.enum(["APPROVE", "REJECT", "INDEX"]) }).parse(await readJson(request));
    const document = await db.ragDocument.findUnique({ where: { id: body.documentId }, include: { collection: true, chunks: true } });
    if (!document) return jsonResponse({ error: true, message: "Document not found." }, { status: 404 });
    const access = await requireProjectPermission(document.collection.projectId, "rag:manage");
    if (!["OWNER", "ADMIN", "SECURITY_ANALYST"].includes(access.role) && !access.user.isAdmin) return jsonResponse({ error: true, message: "Security review role required." }, { status: 403 });
    if (body.action === "INDEX" && document.status !== "APPROVED") return jsonResponse({ error: true, message: "Document must be approved before indexing." }, { status: 409 });
    const status = body.action === "APPROVE" ? "APPROVED" : body.action === "REJECT" ? "REJECTED" : "INDEXED";
    if (body.action === "INDEX") {
      const provider = await getVectorProvider();
      await provider.createNamespace({ organizationId: access.org.id, projectId: access.project.id });
      await provider.indexChunks(document.chunks.map((chunk) => ({ id: chunk.id, organizationId: access.org.id, projectId: access.project.id, collectionId: document.collectionId, documentId: document.id, documentStatus: "INDEXED", textRedacted: chunk.textRedacted, allowedRoles: chunk.allowedRoles, sourceUrl: chunk.sourceUrl ?? undefined, sensitivityLabel: chunk.sensitivityLabel, metadata: chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata) ? chunk.metadata as Record<string, unknown> : undefined })));
    } else if (body.action === "REJECT" && document.status === "INDEXED") {
      await (await getVectorProvider()).deleteDocument(document.id, { organizationId: access.org.id, projectId: access.project.id });
    }
    return jsonResponse(await db.ragDocument.update({ where: { id: document.id }, data: { status } }));
  } catch (error) { return apiError(error, "Document review failed."); }
}
