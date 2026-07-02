import { randomUUID } from "crypto";
import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateExtensionRequest } from "../_shared";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/extension/rateLimiter";
import { rejectDisallowedRawContent, sanitizeExtensionPreview } from "@/lib/extension/privacyGuard";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().min(1),
  employeeId: z.string().max(200).optional(),
  sourceDomain: z.string().max(255).optional(),
  sourceApp: z.string().min(1).max(120),
  sourceCategory: z.string().min(1).max(80),
  sourceUrlHash: z.string().max(128).optional(),
  sourceTitle: z.string().max(255).optional(),
  destinationDomain: z.string().min(1).max(255),
  destinationApp: z.string().min(1).max(120),
  destinationCategory: z.string().min(1).max(80),
  dataTypes: z.array(z.string().max(120)).max(50).default([]),
  riskScore: z.number().int().min(0).max(100).default(0),
  severity: z.string().max(40).default("low"),
  actionTaken: z.string().max(80).default("log_only"),
  policyId: z.string().max(200).optional(),
  fingerprintSetId: z.string().max(200).optional(),
  approvalRequestId: z.string().max(200).optional(),
  redactedPreview: z.string().max(1000).optional(),
  eventType: z.enum(["copy", "paste_to_ai", "upload_to_ai", "submit_to_ai", "response_scan", "approval_request"]),
});

export async function POST(request: Request) {
  try {
    const raw = await readJson(request);
    rejectDisallowedRawContent(raw);
    const body = schema.parse(raw);
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const rateLimit = await checkRateLimit("lineage-event", body.organizationId, { employeeId: body.employeeId, ip });
    if (!rateLimit.allowed) return jsonResponse({ error: true, message: "Too many lineage events." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
    const id = randomUUID();
    await db.$executeRaw`
      INSERT INTO "DataLineageEvent" (
        "id", "organizationId", "employeeId", "deviceId", "sourceDomain", "sourceApp", "sourceCategory",
        "sourceUrlHash", "sourceTitle", "destinationDomain", "destinationApp", "destinationCategory",
        "dataTypes", "riskScore", "severity", "actionTaken", "policyId", "fingerprintSetId",
        "approvalRequestId", "redactedPreview", "eventType", "createdAt"
      ) VALUES (
        ${id}, ${body.organizationId}, ${body.employeeId ?? null}, ${"deviceId" in auth ? auth.deviceId ?? null : null},
        ${body.sourceDomain ?? null}, ${body.sourceApp}, ${body.sourceCategory}, ${body.sourceUrlHash ?? null}, ${body.sourceTitle ?? null},
        ${body.destinationDomain}, ${body.destinationApp}, ${body.destinationCategory}, ${body.dataTypes}, ${body.riskScore},
        ${body.severity}, ${body.actionTaken}, ${body.policyId ?? null}, ${body.fingerprintSetId ?? null},
        ${body.approvalRequestId ?? null}, ${sanitizeExtensionPreview(body.redactedPreview, "lineage", body.dataTypes) ?? null}, ${body.eventType}::"DataLineageEventType", NOW()
      )
    `;
    return jsonResponse({ ok: true, lineageEventId: id }, { status: 201 });
  } catch (error) {
    return apiError(error, "Lineage event could not be recorded.");
  }
}
