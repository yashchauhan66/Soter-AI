import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueBackgroundJob, jobAcceptedResponse } from "@/lib/backgroundJobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const collectionId = new URL(request.url).searchParams.get("collectionId");
    const params = new URL(request.url).searchParams;
    const cursor = params.get("cursor");
    const limitValue = Number(params.get("limit") ?? 50);
    const limit = Number.isFinite(limitValue) ? Math.min(100, Math.max(10, limitValue)) : 50;
    if (!collectionId) return jsonResponse({ error: true, message: "collectionId required." }, { status: 400 });
    const collection = await db.ragCollection.findUnique({ where: { id: collectionId } });
    if (!collection) return jsonResponse({ error: true, message: "Collection not found." }, { status: 404 });
    await requireProjectPermission(collection.projectId, "rag:read");
    return jsonResponse(await db.ragDocument.findMany({
      where: { collectionId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        version: true,
        status: true,
        trustScore: true,
        riskTypes: true,
        pageCount: true,
        extractionMethod: true,
        createdAt: true,
        _count: { select: { chunks: true, findings: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }));
  } catch (error) { return apiError(error, "RAG documents could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const lengthHeader = request.headers.get("content-length");
    if (!lengthHeader) return jsonResponse({ error: true, message: "Content-Length is required for document uploads." }, { status: 411 });
    const declaredLength = Number(lengthHeader);
    const maxBytes = Number(process.env.RAG_MAX_FILE_BYTES ?? 10 * 1024 * 1024);
    if (!Number.isFinite(declaredLength) || declaredLength <= 0) return jsonResponse({ error: true, message: "Invalid Content-Length." }, { status: 400 });
    if (declaredLength > maxBytes + 1_000_000) return jsonResponse({ error: true, message: "Upload exceeds the configured document size limit." }, { status: 413 });
    const form = await request.formData();
    const collectionId = String(form.get("collectionId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File) || !collectionId) return jsonResponse({ error: true, message: "collectionId and file are required." }, { status: 400 });
    const collection = await db.ragCollection.findUnique({ where: { id: collectionId } });
    if (!collection) return jsonResponse({ error: true, message: "Collection not found." }, { status: 404 });
    const access = await requireProjectPermission(collection.projectId, "rag:manage");
    if (collection.organizationId !== access.org.id) return jsonResponse({ error: true, message: "Tenant boundary violation." }, { status: 403 });
    const contentBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const job = await enqueueBackgroundJob({
      type: "RAG_DOCUMENT_SCAN",
      dedupeKey: `rag-scan:${collectionId}:${file.name}:${file.size}:${Date.now()}`,
      payload: {
        collectionId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        uploadedById: access.user.id,
        contentBase64,
      },
      maxAttempts: 2,
    });
    return jsonResponse(jobAcceptedResponse(job, { collectionId, fileName: file.name }), { status: 202 });
  } catch (error) { return apiError(error, "Document could not be scanned."); }
}
