import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { getVectorProvider } from "@/lib/rag/vector/vectorProvider";

const schema = z.object({
  projectId: z.string().min(1),
  query: z.string().trim().min(1).max(8_000),
  collectionId: z.string().min(1).optional(),
  allowedDocumentIds: z.array(z.string().min(1)).max(100).optional(),
  allowedSources: z.array(z.string().url()).max(100).optional(),
  allowedSensitivityLabels: z.array(z.string().min(1).max(50)).max(20).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "rag:read");
    const results = await (await getVectorProvider()).query(body.query, {
      organizationId: access.org.id,
      projectId: access.project.id,
      role: access.role,
      collectionId: body.collectionId,
      allowedDocumentIds: body.allowedDocumentIds,
      allowedSources: body.allowedSources,
      allowedSensitivityLabels: body.allowedSensitivityLabels,
    }, { collectionId: body.collectionId, allowedSources: body.allowedSources, allowedSensitivityLabels: body.allowedSensitivityLabels, limit: body.limit });
    return jsonResponse({ results: results.map(({ textRedacted, ...result }) => ({ ...result, text: textRedacted })) });
  } catch (error) {
    return apiError(error, "RAG retrieval failed.");
  }
}
