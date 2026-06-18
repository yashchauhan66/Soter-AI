import { z } from "zod";
import { authenticateAgentFirewall, readAgentJson, routeError } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { scoreRagDocument } from "@/lib/agent-firewall/mvp3";

export const dynamic = "force-dynamic";

const schema = z.object({
  projectId: z.string().trim().max(200).optional(),
  documentId: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(50_000),
  source: z.enum(["upload", "url", "email", "api", "unknown"]).default("unknown"),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, schema);
    if (body.projectId && body.projectId !== authenticated.auth.project.id) {
      return jsonResponse({ error: true, message: "projectId must match the x-api-key project." }, { status: 403 });
    }
    const result = scoreRagDocument(body);
    await db.$executeRaw`
      INSERT INTO "RagDocumentTrust" ("id", "projectId", "documentId", "trustScore", "trustLevel", "findingsJson", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${authenticated.auth.project.id}, ${body.documentId}, ${result.trustScore}, ${result.trustLevel}, ${JSON.stringify(result.findings)}::jsonb, NOW(), NOW())
      ON CONFLICT ("projectId", "documentId") DO UPDATE
      SET "trustScore" = EXCLUDED."trustScore", "trustLevel" = EXCLUDED."trustLevel", "findingsJson" = EXCLUDED."findingsJson", "updatedAt" = NOW()
    `;
    return jsonResponse(result);
  } catch (error) {
    return routeError(error, "RAG document trust score could not be calculated.");
  }
}
