import { authenticateAdvancedSecurity, readAdvancedJson, routeError, sourceRegisterSchema } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { classifyContent, hashContent } from "@/lib/advanced-security/lineage";
import { sanitizeMetadata } from "@/lib/guard/logSafety";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, sourceRegisterSchema);
    const classified = classifyContent(body.content);
    const contentHash = hashContent(body.content);
    const id = crypto.randomUUID();
    await db.$executeRaw`
      INSERT INTO "ContextSource" ("id", "projectId", "sessionId", "sourceType", "sourceName", "sourceTrustLevel", "sensitivityLevel", "metadataJson", "contentHash", "contentRedacted", "createdAt")
      VALUES (
        ${id}, ${authenticated.auth.project.id}, ${body.sessionId ?? null}, ${body.sourceType},
        ${body.sourceName ?? null}, ${body.sourceTrustLevel}, ${body.sensitivityLevel},
        ${JSON.stringify(sanitizeMetadata(body.metadata))}::jsonb, ${contentHash}, ${classified.safeContent}, NOW()
      )
    `;
    return jsonResponse({
      sourceId: id,
      contentHash,
      sensitivityLevel: body.sensitivityLevel,
      findings: classified.findings,
    });
  } catch (error) {
    return routeError(error, "Context source could not be registered.");
  }
}
