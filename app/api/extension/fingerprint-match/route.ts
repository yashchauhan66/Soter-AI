import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateExtensionRequest } from "../_shared";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { checkRateLimit } from "@/lib/extension/rateLimiter";
import { rejectDisallowedRawContent, sanitizeExtensionPreview } from "@/lib/extension/privacyGuard";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().min(1),
  employeeId: z.string().max(200).optional(),
  destinationDomain: z.string().min(1).max(255),
  sourceApp: z.string().max(120).optional(),
  sourceUrlHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  textHash: z.string().regex(/^[a-f0-9]{64}$/i),
  localMatches: z.array(z.object({
    matchedFingerprintSetId: z.string().min(1).max(200),
    similarityScore: z.number().min(0).max(1),
    sensitivity: z.enum(["info", "low", "medium", "high", "critical"]).transform((value) => value === "info" ? "low" : value),
    recommendedAction: z.string().max(80),
    matchType: z.enum(["exact", "fuzzy"]).default("fuzzy"),
    category: z.string().max(120).optional(),
    matchedDocumentName: z.string().max(200).optional(),
    confidence: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
    matchedChunkCount: z.number().int().nonnegative().optional(),
    totalComparedChunks: z.number().int().nonnegative().optional(),
    evidence: z.string().max(200).refine((value) => !/\b(?:api[_-]?key|password|secret|token)\s*[:=]/i.test(value), "Fingerprint evidence must be metadata-only.").optional(),
  })).max(10).optional(),
  redactedPreview: z.string().max(1000).optional(),
  actionTaken: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await readJson(request);
    rejectDisallowedRawContent(raw);
    const body = schema.parse(raw);
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const rateLimit = await checkRateLimit("fingerprint-match", body.organizationId, { employeeId: body.employeeId, ip });
    if (!rateLimit.allowed) return jsonResponse({ error: true, message: "Too many fingerprint match events." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
    const matches = body.localMatches ?? [];
    if (body.localMatches?.length) {
      for (const match of body.localMatches.slice(0, 5)) {
        await db.$executeRaw`
          INSERT INTO "CompanyFingerprintMatch" (
            "id", "organizationId", "fingerprintSetId", "employeeId", "deviceId", "destinationDomain",
            "sourceApp", "sourceUrl", "matchType", "similarityScore", "confidence", "actionTaken", "redactedPreview", "createdAt"
          ) VALUES (
            ${randomUUID()}, ${body.organizationId}, ${match.matchedFingerprintSetId}, ${body.employeeId ?? null},
            ${"deviceId" in auth ? auth.deviceId ?? null : null}, ${body.destinationDomain}, ${body.sourceApp ?? null},
            ${body.sourceUrlHash ?? null}, ${match.matchType}::"CompanyFingerprintMatchType", ${match.similarityScore},
            ${match.sensitivity}::"CompanyFingerprintSensitivity", ${body.actionTaken ?? match.recommendedAction},
            ${sanitizeExtensionPreview(body.redactedPreview, "fingerprint", ["company_fingerprint_match"]) ?? null}, NOW()
          )
        `;
        await db.$executeRaw`UPDATE "CompanyFingerprintSet" SET "lastMatchedAt" = NOW() WHERE "id" = ${match.matchedFingerprintSetId} AND "organizationId" = ${body.organizationId}`;
      }
    }
    return jsonResponse({ matches });
  } catch (error) {
    return apiError(error, "Fingerprint match could not be recorded.");
  }
}
