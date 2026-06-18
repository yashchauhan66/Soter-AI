import { authenticateAdvancedSecurity, memoryStoreSchema, readAdvancedJson, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { analyzeMemoryContent, diffMemory, hashMemory } from "@/lib/advanced-security/memoryPoisoning";

export const dynamic = "force-dynamic";

// Map an analysis decision to the stored record status.
function statusForDecision(decision: string): "ACTIVE" | "QUARANTINED" | "NEEDS_REVIEW" {
  if (decision === "QUARANTINE" || decision === "BLOCK") return "QUARANTINED";
  if (decision === "REVIEW") return "NEEDS_REVIEW";
  return "ACTIVE";
}

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, memoryStoreSchema);
    const projectId = authenticated.auth.project.id;
    const analysis = analyzeMemoryContent(body.content, body.memoryType);
    const status = statusForDecision(analysis.decision);
    const contentHash = hashMemory(body.content);
    const isUpdate = typeof body.previousContent === "string";
    const diff = isUpdate ? diffMemory(body.previousContent ?? "", body.content) : null;
    const recordId = crypto.randomUUID();

    await db.$executeRaw`
      INSERT INTO "AgentMemoryRecord" ("id", "projectId", "userId", "agentName", "memoryScope", "memoryType", "contentHash", "contentRedacted", "status", "riskLevel", "createdAt", "updatedAt")
      VALUES (
        ${recordId}, ${projectId}, ${body.userId ?? null}, ${body.agentName}, ${body.memoryScope}, ${body.memoryType},
        ${contentHash}, ${analysis.safeContent}, ${status}, ${analysis.riskLevel}, NOW(), NOW()
      )
    `;
    for (const finding of analysis.findings) {
      await db.$executeRaw`
        INSERT INTO "MemoryPoisoningFinding" ("id", "projectId", "memoryRecordId", "findingType", "riskLevel", "reason", "recommendedAction", "createdAt")
        VALUES (${crypto.randomUUID()}, ${projectId}, ${recordId}, ${finding.findingType}, ${finding.riskLevel}, ${finding.reason}, ${finding.recommendedAction}, NOW())
      `;
    }
    await db.$executeRaw`
      INSERT INTO "MemoryChangeAudit" ("id", "projectId", "memoryRecordId", "action", "beforeHash", "afterHash", "decision", "reason", "createdAt")
      VALUES (
        ${crypto.randomUUID()}, ${projectId}, ${recordId}, ${isUpdate ? "UPDATE" : "STORE"},
        ${isUpdate ? hashMemory(body.previousContent ?? "") : null}, ${contentHash}, ${analysis.decision}, ${analysis.reason}, NOW()
      )
    `;

    return jsonResponse({
      memoryRecordId: recordId,
      stored: status === "ACTIVE",
      status,
      decision: analysis.decision,
      riskLevel: analysis.riskLevel,
      reason: analysis.reason,
      safeContent: analysis.safeContent,
      findings: analysis.findings,
      diff,
    });
  } catch (error) {
    return routeError(error, "Memory could not be stored.");
  }
}
