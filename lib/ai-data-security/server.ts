import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createPrivacySafeFingerprint, matchFingerprintText, redactedPreview, type FingerprintRecord } from "./fingerprint";

export async function createFingerprintSet(input: {
  organizationId: string;
  adminUserId?: string;
  name: string;
  description?: string;
  category: string;
  sensitivity: string;
  ownerDepartment?: string;
  action: string;
  sourceType: string;
  text: string;
  originalFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  retentionDays?: number;
}) {
  const id = randomUUID();
  const fingerprint = createPrivacySafeFingerprint(input.text);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "CompanyFingerprintSet" (
        "id", "organizationId", "name", "description", "category", "sensitivity", "ownerDepartment", "action",
        "enabled", "storageMode", "sourceType", "originalFileName", "mimeType", "sizeBytes", "retentionDays",
        "createdByAdminId", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${input.organizationId}, ${input.name}, ${input.description ?? null},
        ${input.category}::"CompanyFingerprintCategory", ${input.sensitivity}::"CompanyFingerprintSensitivity",
        ${input.ownerDepartment ?? null}, ${input.action}::"CompanyFingerprintAction", true,
        'hashed_only'::"CompanyFingerprintStorageMode", ${input.sourceType}::"CompanyFingerprintSourceType",
        ${input.originalFileName ?? null}, ${input.mimeType ?? null}, ${input.sizeBytes ?? null}, ${input.retentionDays ?? null},
        ${input.adminUserId ?? null}, NOW(), NOW()
      )
    `;
    const chunkRows = fingerprint.chunkHashes.map((hash, index) => Prisma.sql`(${randomUUID()}, ${input.organizationId}, ${id}, ${hash}, ${null}, ${index}, ${fingerprint.algorithms.exact})`);
    const shingleRows = fingerprint.shingleHashes.map((hash, index) => Prisma.sql`(${randomUUID()}, ${input.organizationId}, ${id}, ${hash}, ${hash}, ${index}, ${fingerprint.algorithms.fuzzy})`);
    const rows = [...chunkRows, ...shingleRows];
    if (rows.length) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "CompanyFingerprintChunk" ("id", "organizationId", "fingerprintSetId", "chunkHash", "shingleHash", "chunkIndex", "algorithm")
        VALUES ${Prisma.join(rows)}
      `);
    }
  });
  return { id, chunkHashCount: fingerprint.chunkHashes.length, shingleHashCount: fingerprint.shingleHashes.length, storageMode: "hashed_only" };
}

export async function listFingerprintSets(organizationId: string, filters: URLSearchParams) {
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>`
    SELECT s."id", s."name", s."description", s."category", s."sensitivity", s."ownerDepartment", s."action",
           s."enabled", s."storageMode", s."sourceType", s."originalFileName", s."mimeType", s."sizeBytes",
           s."retentionDays", s."createdAt", s."updatedAt", s."lastMatchedAt",
           COUNT(c."id")::int AS "fingerprintCount"
    FROM "CompanyFingerprintSet" s
    LEFT JOIN "CompanyFingerprintChunk" c ON c."fingerprintSetId" = s."id"
    WHERE s."organizationId" = ${organizationId} AND s."deletedAt" IS NULL
    GROUP BY s."id"
    ORDER BY s."createdAt" DESC
    LIMIT 200
  `;
  const category = filters.get("category")?.toLowerCase();
  const department = filters.get("department")?.toLowerCase();
  const sensitivity = filters.get("sensitivity")?.toLowerCase();
  const search = filters.get("q")?.toLowerCase();
  return rows.filter((row) => {
    if (category && String(row.category).toLowerCase() !== category) return false;
    if (department && String(row.ownerDepartment ?? "").toLowerCase() !== department) return false;
    if (sensitivity && String(row.sensitivity).toLowerCase() !== sensitivity) return false;
    if (search && !String(row.name).toLowerCase().includes(search)) return false;
    return true;
  });
}

export async function loadFingerprintRecords(organizationId: string): Promise<FingerprintRecord[]> {
  const sets = await db.$queryRaw<Array<{ id: string; name: string; category: string; sensitivity: string; action: string }>>`
    SELECT "id", "name", "category"::text, "sensitivity"::text, "action"::text
    FROM "CompanyFingerprintSet"
    WHERE "organizationId" = ${organizationId} AND "enabled" = true AND "deletedAt" IS NULL
  `;
  if (!sets.length) return [];
  const chunks = await db.$queryRaw<Array<{ fingerprintSetId: string; chunkHash: string; shingleHash: string | null }>>`
    SELECT "fingerprintSetId", "chunkHash", "shingleHash"
    FROM "CompanyFingerprintChunk"
    WHERE "organizationId" = ${organizationId}
  `;
  return sets.map((set) => {
    const setChunks = chunks.filter((chunk) => chunk.fingerprintSetId === set.id);
    return {
      fingerprintSetId: set.id,
      documentName: set.name,
      category: set.category,
      sensitivity: set.sensitivity as FingerprintRecord["sensitivity"],
      action: set.action as FingerprintRecord["action"],
      chunkHashes: setChunks.filter((chunk) => !chunk.shingleHash).map((chunk) => chunk.chunkHash),
      shingleHashes: setChunks.filter((chunk) => chunk.shingleHash).map((chunk) => chunk.shingleHash!),
    };
  });
}

export async function testFingerprintMatch(organizationId: string, text: string) {
  return matchFingerprintText(text, await loadFingerprintRecords(organizationId));
}

export async function recordFingerprintMatches(input: {
  organizationId: string;
  employeeId?: string;
  deviceId?: string;
  destinationDomain: string;
  sourceApp?: string;
  sourceUrl?: string;
  text: string;
  actionTaken?: string;
}) {
  const matches = await testFingerprintMatch(input.organizationId, input.text);
  for (const match of matches.slice(0, 5)) {
    await db.$executeRaw`
      INSERT INTO "CompanyFingerprintMatch" (
        "id", "organizationId", "fingerprintSetId", "employeeId", "deviceId", "destinationDomain",
        "sourceApp", "sourceUrl", "matchType", "similarityScore", "confidence", "actionTaken", "redactedPreview", "createdAt"
      ) VALUES (
        ${randomUUID()}, ${input.organizationId}, ${match.matchedFingerprintSetId}, ${input.employeeId ?? null}, ${input.deviceId ?? null},
        ${input.destinationDomain}, ${input.sourceApp ?? null}, ${input.sourceUrl ?? null}, ${match.matchType}::"CompanyFingerprintMatchType",
        ${match.similarityScore}, ${match.confidence}::"CompanyFingerprintSensitivity", ${input.actionTaken ?? match.recommendedAction},
        ${redactedPreview("Fingerprint match")}, NOW()
      )
    `;
    await db.$executeRaw`UPDATE "CompanyFingerprintSet" SET "lastMatchedAt" = NOW() WHERE "id" = ${match.matchedFingerprintSetId} AND "organizationId" = ${input.organizationId}`;
  }
  return matches;
}
