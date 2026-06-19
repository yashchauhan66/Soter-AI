import { Prisma } from "@prisma/client";
import { z } from "zod";
import { jsonResponse } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { db } from "@/lib/db";
import {
  SEMANTIC_DESTINATION_TYPES,
  SEMANTIC_SENSITIVITY_LEVELS,
  checkSemanticEgress,
  createSemanticEgressCheckId,
  createSemanticSourceFingerprintId,
  fingerprintSemanticSource,
  normalizeSemanticFingerprint,
  sanitizeSemanticText,
  type SemanticSensitivityLevel,
  type SemanticSourceSnapshot,
} from "@/lib/semantic-egress";

const sensitivityLevel = z.enum(SEMANTIC_SENSITIVITY_LEVELS);
const destinationType = z.enum(SEMANTIC_DESTINATION_TYPES);

export const semanticSourceFingerprintSchema = z.object({
  sourceId: z.string().trim().min(1).max(200),
  sourceType: z.string().trim().min(1).max(120),
  sensitivityLevel,
  content: z.string().max(50_000),
  metadata: z.record(z.unknown()).optional(),
});

export const semanticEgressCheckSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  sourceIds: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  destinationType,
  destinationName: z.string().trim().max(500).optional(),
  content: z.string().max(50_000),
  metadata: z.record(z.unknown()).optional(),
});

type SemanticAuth = Extract<Awaited<ReturnType<typeof authenticateAdvancedSecurity>>, { ok: true }>["auth"];

type SemanticSourceRow = {
  id: string;
  projectId: string;
  sourceId: string;
  sourceType: string;
  sensitivityLevel: string;
  fingerprintJson: unknown;
  contentHash: string;
  createdAt: Date;
};

type SemanticCheckRow = {
  id: string;
  projectId: string;
  sessionId: string;
  sourceIdsJson: unknown;
  destinationType: string;
  destinationName: string | null;
  contentHash: string;
  contentRedacted: string;
  semanticRiskScore: number;
  decision: string;
  riskLevel: string;
  reason: string;
  findingsJson: unknown;
  createdAt: Date;
};

export async function fingerprintAndPersistSemanticSource(auth: SemanticAuth, input: z.infer<typeof semanticSourceFingerprintSchema>) {
  const fingerprint = fingerprintSemanticSource(input);
  const id = createSemanticSourceFingerprintId();

  await db.$executeRaw`
    INSERT INTO "SemanticSourceFingerprint" (
      "id", "projectId", "sourceId", "sourceType", "sensitivityLevel", "fingerprintJson", "contentHash", "createdAt"
    )
    VALUES (
      ${id},
      ${auth.project.id},
      ${fingerprint.sourceId},
      ${fingerprint.sourceType},
      ${fingerprint.sensitivityLevel},
      ${JSON.stringify(fingerprint.fingerprint)}::jsonb,
      ${fingerprint.contentHash},
      NOW()
    )
    ON CONFLICT ("projectId", "sourceId")
    DO UPDATE SET
      "sourceType" = EXCLUDED."sourceType",
      "sensitivityLevel" = EXCLUDED."sensitivityLevel",
      "fingerprintJson" = EXCLUDED."fingerprintJson",
      "contentHash" = EXCLUDED."contentHash",
      "createdAt" = NOW()
  `;

  return jsonResponse({
    source: {
      sourceId: fingerprint.sourceId,
      sourceType: fingerprint.sourceType,
      sensitivityLevel: fingerprint.sensitivityLevel,
      contentHash: fingerprint.contentHash,
      fingerprint: fingerprint.fingerprint,
    },
  }, { status: 201 });
}

export async function checkAndPersistSemanticEgress(auth: SemanticAuth, input: z.infer<typeof semanticEgressCheckSchema>) {
  const rows = await loadSemanticSources(auth.project.id, input.sourceIds);
  const sources = rows.map(snapshotSource);
  const result = checkSemanticEgress({
    sessionId: input.sessionId,
    sourceIds: input.sourceIds,
    destinationType: input.destinationType,
    destinationName: input.destinationName,
    content: input.content,
    sources,
    metadata: input.metadata,
  });
  const missingSourceIds = input.sourceIds.filter((sourceId) => !sources.some((source) => source.sourceId === sourceId));
  if (missingSourceIds.length > 0) {
    result.findings.push({
      id: "semantic.source_missing",
      label: "Some requested source fingerprints were not found in this project.",
      severity: "MEDIUM",
      details: missingSourceIds.slice(0, 5).join(", "),
    });
  }

  const id = createSemanticEgressCheckId();
  await db.$executeRaw`
    INSERT INTO "SemanticEgressCheck" (
      "id", "projectId", "sessionId", "sourceIdsJson", "destinationType", "destinationName",
      "contentHash", "contentRedacted", "semanticRiskScore", "decision", "riskLevel", "reason", "findingsJson", "createdAt"
    )
    VALUES (
      ${id},
      ${auth.project.id},
      ${input.sessionId},
      ${JSON.stringify(input.sourceIds)}::jsonb,
      ${input.destinationType},
      ${sanitizeSemanticText(input.destinationName)},
      ${result.contentHash},
      ${result.contentRedacted},
      ${result.semanticRiskScore},
      ${result.decision}::"SemanticEgressDecision",
      ${result.riskLevel},
      ${result.reason},
      ${JSON.stringify(result.findings)}::jsonb,
      NOW()
    )
  `;

  return jsonResponse({
    checkId: id,
    sessionId: input.sessionId,
    decision: result.decision,
    riskLevel: result.riskLevel,
    semanticRiskScore: result.semanticRiskScore,
    reason: result.reason,
    findings: result.findings,
    matchedSources: result.matchedSources,
    contentRedacted: result.contentRedacted,
  }, { status: 201 });
}

export async function listSemanticEgressChecks(auth: SemanticAuth) {
  const [checks, sources] = await Promise.all([
    db.$queryRaw<SemanticCheckRow[]>`
      SELECT "id", "projectId", "sessionId", "sourceIdsJson", "destinationType", "destinationName",
        "contentHash", "contentRedacted", "semanticRiskScore", "decision", "riskLevel", "reason",
        "findingsJson", "createdAt"
      FROM "SemanticEgressCheck"
      WHERE "projectId" = ${auth.project.id}
      ORDER BY "createdAt" DESC
      LIMIT 200
    `,
    db.$queryRaw<SemanticSourceRow[]>`
      SELECT "id", "projectId", "sourceId", "sourceType", "sensitivityLevel", "fingerprintJson", "contentHash", "createdAt"
      FROM "SemanticSourceFingerprint"
      WHERE "projectId" = ${auth.project.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
  ]);

  return jsonResponse({
    checks: checks.map(publicCheck),
    sources: sources.map(publicSource),
  });
}

export { routeError };

async function loadSemanticSources(projectId: string, sourceIds: string[]) {
  if (sourceIds.length === 0) return [];
  return db.$queryRaw<SemanticSourceRow[]>(Prisma.sql`
    SELECT "id", "projectId", "sourceId", "sourceType", "sensitivityLevel", "fingerprintJson", "contentHash", "createdAt"
    FROM "SemanticSourceFingerprint"
    WHERE "projectId" = ${projectId} AND "sourceId" IN (${Prisma.join(sourceIds)})
    LIMIT 50
  `);
}

function snapshotSource(row: SemanticSourceRow): SemanticSourceSnapshot {
  return {
    sourceId: row.sourceId,
    sourceType: row.sourceType,
    sensitivityLevel: normalizeSensitivity(row.sensitivityLevel),
    contentHash: row.contentHash,
    fingerprint: normalizeSemanticFingerprint(row.fingerprintJson),
  };
}

function publicCheck(row: SemanticCheckRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    sourceIds: Array.isArray(row.sourceIdsJson) ? row.sourceIdsJson : [],
    destinationType: row.destinationType,
    destinationName: row.destinationName,
    contentHash: row.contentHash,
    contentRedacted: row.contentRedacted,
    semanticRiskScore: row.semanticRiskScore,
    decision: row.decision,
    riskLevel: row.riskLevel,
    reason: row.reason,
    findings: Array.isArray(row.findingsJson) ? row.findingsJson : [],
    createdAt: row.createdAt,
  };
}

function publicSource(row: SemanticSourceRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    sourceId: row.sourceId,
    sourceType: row.sourceType,
    sensitivityLevel: row.sensitivityLevel,
    fingerprint: normalizeSemanticFingerprint(row.fingerprintJson),
    contentHash: row.contentHash,
    createdAt: row.createdAt,
  };
}

function normalizeSensitivity(value: string): SemanticSensitivityLevel {
  return SEMANTIC_SENSITIVITY_LEVELS.includes(value as SemanticSensitivityLevel) ? value as SemanticSensitivityLevel : "INTERNAL";
}
