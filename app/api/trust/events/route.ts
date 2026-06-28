import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { buildCausalGraph, isTrustEvent, recordTrustEvent, type TrustEventEnvelope } from "@/lib/trust-events";

const trustEventSchema = z.object({
  projectId: z.string().min(1).max(200),
  eventType: z.string().trim().min(1).max(160),
  source: z.string().trim().min(1).max(160),
  action: z.string().trim().min(1).max(160),
  severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("INFO"),
  decision: z.enum(["ALLOW", "BLOCK", "ASK_APPROVAL", "OBSERVE", "ERROR"]).default("OBSERVE"),
  riskTypes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  traceId: z.string().regex(/^[a-fA-F0-9]{32}$/).optional(),
  spanId: z.string().regex(/^[a-fA-F0-9]{16}$/).optional(),
  parentSpanId: z.string().regex(/^[a-fA-F0-9]{16}$/).nullable().optional(),
  causalRefs: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  correlationId: z.string().trim().max(200).nullable().optional(),
  sessionId: z.string().trim().max(200).nullable().optional(),
  agentIdentityId: z.string().trim().max(200).nullable().optional(),
  passportId: z.string().trim().max(200).nullable().optional(),
  policyDecisionId: z.string().trim().max(200).nullable().optional(),
  controlIds: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  resource: z.object({ type: z.string().trim().min(1).max(120), id: z.string().trim().max(300).nullable().optional(), classification: z.string().trim().max(80).nullable().optional() }).optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  try {
    const body = trustEventSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "forensics:manage");
    const event = await recordTrustEvent({ ...body, organizationId: access.org.id, projectId: access.project.id });
    return jsonResponse({ event }, { status: 201 });
  } catch (error) {
    return apiError(error, "Trust event could not be recorded.");
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const traceId = url.searchParams.get("traceId")?.toLowerCase();
    if (traceId && !/^[a-f0-9]{32}$/.test(traceId)) return jsonResponse({ error: true, message: "traceId must be 32 hexadecimal characters." }, { status: 400 });
    const access = await requireProjectPermission(projectId, "forensics:read");
    const rows = await db.securityEvent.findMany({
      where: { projectId: access.project.id },
      orderBy: { createdAt: "desc" },
      take: Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 500))),
      select: { metadata: true },
    });
    const events: TrustEventEnvelope[] = [];
    for (const row of rows) {
      if (isTrustEvent(row.metadata) && (!traceId || row.metadata.traceId === traceId)) events.push(row.metadata);
    }
    return jsonResponse({ events, graph: traceId ? buildCausalGraph(events.reverse()) : null });
  } catch (error) {
    return apiError(error, "Trust events could not be loaded.");
  }
}
