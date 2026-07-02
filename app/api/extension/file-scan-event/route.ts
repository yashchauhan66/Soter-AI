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
  destinationDomain: z.string().min(1).max(255),
  sourceApp: z.string().max(120).optional(),
  fileNameHash: z.string().min(16).max(128),
  originalExtension: z.string().max(32),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative(),
  scannedBytes: z.number().int().nonnegative(),
  supported: z.boolean(),
  encryptedOrBinary: z.boolean().default(false),
  detectedDataTypes: z.array(z.string().max(120)).max(50).default([]),
  fingerprintSetId: z.string().max(200).optional(),
  riskScore: z.number().int().min(0).max(100),
  severity: z.string().max(40),
  actionTaken: z.string().max(80),
  redactedPreview: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await readJson(request);
    rejectDisallowedRawContent(raw);
    const body = schema.parse(raw);
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const rateLimit = await checkRateLimit("file-scan-event", body.organizationId, { employeeId: body.employeeId, ip });
    if (!rateLimit.allowed) return jsonResponse({ error: true, message: "Too many file scan events." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
    const id = randomUUID();
    await db.$executeRaw`
      INSERT INTO "AIFileScanEvent" (
        "id", "organizationId", "employeeId", "deviceId", "destinationDomain", "sourceApp", "fileNameHash",
        "originalExtension", "mimeType", "sizeBytes", "scannedBytes", "supported", "encryptedOrBinary",
        "detectedDataTypes", "fingerprintSetId", "riskScore", "severity", "actionTaken", "redactedPreview", "createdAt"
      ) VALUES (
        ${id}, ${body.organizationId}, ${body.employeeId ?? null}, ${"deviceId" in auth ? auth.deviceId ?? null : null},
        ${body.destinationDomain}, ${body.sourceApp ?? null}, ${body.fileNameHash}, ${body.originalExtension}, ${body.mimeType ?? null},
        ${body.sizeBytes}, ${body.scannedBytes}, ${body.supported}, ${body.encryptedOrBinary}, ${body.detectedDataTypes},
        ${body.fingerprintSetId ?? null}, ${body.riskScore}, ${body.severity}, ${body.actionTaken}, ${sanitizeExtensionPreview(body.redactedPreview, "file", body.detectedDataTypes) ?? null}, NOW()
      )
    `;
    return jsonResponse({ ok: true, fileScanEventId: id }, { status: 201 });
  } catch (error) {
    return apiError(error, "File scan event could not be recorded.");
  }
}
