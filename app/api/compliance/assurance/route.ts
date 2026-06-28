import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { evaluateContinuousAssurance } from "@/lib/compliance/assurance";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const freshnessDays = Math.min(365, Math.max(1, Number(url.searchParams.get("freshnessDays") ?? 30)));
    const access = await requireProjectPermission(projectId, "reports:read");
    const evidence = await db.complianceEvidenceItem.findMany({
      where: { projectId: access.project.id },
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: { id: true, evidenceType: true, controlName: true, status: true, riskLevel: true, contentHash: true, createdAt: true },
    });
    return jsonResponse({ projectId: access.project.id, assurance: evaluateContinuousAssurance({ evidence, freshnessDays }) });
  } catch (error) {
    return apiError(error, "Continuous assurance could not be evaluated.");
  }
}
