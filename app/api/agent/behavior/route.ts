import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { assessBehaviorSequence, buildAgentBehaviorProfile } from "@/lib/behavior-baseline";
import { db } from "@/lib/db";
import { isTrustEvent, type TrustEventEnvelope } from "@/lib/trust-events";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const agentIdentityId = url.searchParams.get("agentIdentityId") ?? "";
    if (!agentIdentityId) return jsonResponse({ error: true, message: "agentIdentityId is required." }, { status: 400 });
    const access = await requireProjectPermission(projectId, "forensics:read");
    const rows = await db.securityEvent.findMany({ where: { projectId: access.project.id }, orderBy: { createdAt: "desc" }, take: 2000, select: { metadata: true } });
    const events: TrustEventEnvelope[] = [];
    for (const row of rows) if (isTrustEvent(row.metadata) && row.metadata.agentIdentityId === agentIdentityId) events.push(row.metadata);
    const ordered = events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    const assessmentWindow = Math.min(20, Math.max(1, Number(url.searchParams.get("assessmentWindow") ?? 10)));
    const baselineEvents = ordered.slice(0, Math.max(0, ordered.length - assessmentWindow));
    const recentEvents = ordered.slice(-assessmentWindow);
    const profile = buildAgentBehaviorProfile({ agentIdentityId, events: baselineEvents });
    return jsonResponse({ profile, recentAssessments: assessBehaviorSequence({ profile, events: recentEvents }), notice: profile.state === "LEARNING" ? "At least 30 historical events are required before anomaly enforcement." : null });
  } catch (error) {
    return apiError(error, "Agent behavior baseline could not be evaluated.");
  }
}
