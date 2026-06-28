import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { buildCausalSiemPayload, correlateCausalIncidents, correlateCausalTrace } from "@/lib/causal-siem";
import { db } from "@/lib/db";
import { isTrustEvent, recordTrustEvent, type TrustEventEnvelope } from "@/lib/trust-events";

const correlateSchema = z.object({
  projectId: z.string().min(1).max(200),
  traceId: z.string().regex(/^[a-fA-F0-9]{32}$/),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const traceId = url.searchParams.get("traceId")?.toLowerCase();
    if (traceId && !/^[a-f0-9]{32}$/.test(traceId)) return jsonResponse({ error: true, message: "traceId must be 32 hexadecimal characters." }, { status: 400 });
    const access = await requireProjectPermission(projectId, "forensics:read");
    const events = await loadTrustEvents(access.project.id, Math.min(5000, Math.max(1, Number(url.searchParams.get("limit") ?? 2000))));
    const filtered = traceId ? events.filter((event) => event.traceId === traceId) : events;
    return jsonResponse({ incidents: traceId ? [correlateCausalTrace(filtered)].filter(Boolean) : correlateCausalIncidents(filtered) });
  } catch (error) {
    return apiError(error, "Causal incidents could not be correlated.");
  }
}

export async function POST(request: Request) {
  try {
    const body = correlateSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "forensics:manage");
    const events = (await loadTrustEvents(access.project.id, 5000)).filter((event) => event.traceId === body.traceId.toLowerCase());
    const incident = correlateCausalTrace(events);
    if (!incident) return jsonResponse({ error: true, message: "No trust events were found for this trace." }, { status: 404 });
    const payload = buildCausalSiemPayload(incident);
    const existing = await db.securityEvent.findMany({
      where: { projectId: access.project.id, eventType: "CAUSAL_INCIDENT_CORRELATED" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, metadata: true },
    });
    const reused = existing.find((row) => isTrustEvent(row.metadata) && row.metadata.metadata.causalIncidentFingerprint === incident.incidentFingerprint);
    if (reused) return jsonResponse({ incident, siemPayload: payload, eventId: reused.id, reused: true });
    const last = events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()).at(-1)!;
    const recorded = await recordTrustEvent({
      organizationId: access.org.id,
      projectId: access.project.id,
      traceId: incident.traceId,
      parentSpanId: last.spanId,
      causalRefs: [last.eventId],
      eventType: "CAUSAL_INCIDENT_CORRELATED",
      source: "causal-siem",
      action: incident.containmentStatus,
      severity: incident.severity,
      decision: incident.containmentStatus === "ESCALATED" ? "ERROR" : incident.containmentStatus === "CONTAINED" ? "BLOCK" : "OBSERVE",
      riskTypes: incident.riskTypes,
      controlIds: ["AI-CTRL-05", ...incident.controlIds],
      metadata: { causalIncidentFingerprint: incident.incidentFingerprint, siemPayload: payload },
    });
    return jsonResponse({ incident, siemPayload: payload, eventId: recorded.eventId, reused: false }, { status: 201 });
  } catch (error) {
    return apiError(error, "Causal incident could not be exported to SIEM.");
  }
}

async function loadTrustEvents(projectId: string, limit: number) {
  const rows = await db.securityEvent.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: Number.isFinite(limit) ? limit : 2000, select: { metadata: true } });
  const events: TrustEventEnvelope[] = [];
  for (const row of rows) if (isTrustEvent(row.metadata) && row.metadata.eventType !== "CAUSAL_INCIDENT_CORRELATED") events.push(row.metadata);
  return events;
}
