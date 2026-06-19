import { z } from "zod";
import { jsonResponse } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { db } from "@/lib/db";
import {
  TOOL_CHAIN_DATA_SENSITIVITIES,
  TOOL_CHAIN_DESTINATION_TYPES,
  TOOL_CHAIN_SOURCE_TYPES,
  createToolChainFindingId,
  createToolChainSessionId,
  createToolChainStepId,
  evaluateToolChainStep,
  safeToolChainSummary,
  sanitizeToolChainMetadata,
  type ToolChainDataSensitivity,
  type ToolChainDestinationType,
  type ToolChainFindingCandidate,
  type ToolChainSourceType,
  type ToolChainStepSnapshot,
} from "@/lib/tool-chain";

const sourceType = z.enum(TOOL_CHAIN_SOURCE_TYPES);
const destinationType = z.enum(TOOL_CHAIN_DESTINATION_TYPES);
const dataSensitivity = z.enum(TOOL_CHAIN_DATA_SENSITIVITIES);

export const toolChainSessionStartSchema = z.object({
  sessionId: z.string().trim().min(1).max(200).optional(),
  agentIdentityId: z.string().trim().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const toolChainStepCheckSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  tool: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(300),
  sourceType: sourceType.optional(),
  destinationType: destinationType.optional(),
  dataSensitivity: dataSensitivity.optional(),
  metadata: z.record(z.unknown()).optional(),
});

type ToolChainAuth = Extract<Awaited<ReturnType<typeof authenticateAdvancedSecurity>>, { ok: true }>["auth"];

type ToolChainSessionRow = {
  id: string;
  projectId: string;
  sessionId: string;
  agentIdentityId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type ToolChainStepRow = {
  id: string;
  projectId: string;
  toolChainSessionId: string;
  stepIndex: number;
  tool: string;
  action: string;
  sourceType: string;
  destinationType: string;
  dataSensitivity: string;
  decision: string;
  riskLevel: string;
  metadataJson: unknown;
  createdAt: Date;
};

type ToolChainFindingRow = {
  id: string;
  projectId: string;
  toolChainSessionId: string;
  findingType: string;
  riskLevel: string;
  summary: string;
  involvedStepsJson: unknown;
  recommendation: string;
  createdAt: Date;
};

export async function startToolChainSession(auth: ToolChainAuth, input: z.infer<typeof toolChainSessionStartSchema>) {
  const sessionId = input.sessionId ?? createToolChainSessionId();
  if (input.agentIdentityId) {
    const agent = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "AgentIdentity"
      WHERE "projectId" = ${auth.project.id} AND "id" = ${input.agentIdentityId}
      LIMIT 1
    `;
    if (!agent[0]) {
      return jsonResponse({ error: true, message: "Agent identity does not belong to this project." }, { status: 404 });
    }
  }

  const existing = await findToolChainSession(auth.project.id, sessionId);
  if (existing) {
    return jsonResponse({ session: publicSession(existing), reused: true });
  }

  const id = createToolChainSessionId();
  await db.$executeRaw`
    INSERT INTO "ToolChainSession" ("id", "projectId", "sessionId", "agentIdentityId", "status", "createdAt", "updatedAt")
    VALUES (${id}, ${auth.project.id}, ${sessionId}, ${input.agentIdentityId ?? null}, 'ACTIVE'::"ToolChainSessionStatus", NOW(), NOW())
  `;

  return jsonResponse({
    session: {
      id,
      projectId: auth.project.id,
      sessionId,
      agentIdentityId: input.agentIdentityId ?? null,
      status: "ACTIVE",
    },
  }, { status: 201 });
}

export async function checkAndPersistToolChainStep(auth: ToolChainAuth, input: z.infer<typeof toolChainStepCheckSchema>) {
  const session = await findToolChainSession(auth.project.id, input.sessionId);
  if (!session) {
    return jsonResponse({
      error: true,
      decision: "REVIEW",
      riskLevel: "HIGH",
      reason: "No project-scoped tool chain session was found. Start a tool chain session before executing tool steps.",
    }, { status: 404 });
  }

  const previousRows = await listStepsForSession(auth.project.id, session.id);
  const previousSteps = previousRows.map(snapshotStepRow);
  const result = evaluateToolChainStep(previousSteps, {
    stepIndex: previousSteps.length + 1,
    tool: input.tool,
    action: input.action,
    sourceType: input.sourceType,
    destinationType: input.destinationType,
    dataSensitivity: input.dataSensitivity,
    metadata: input.metadata,
  });
  const stepId = createToolChainStepId();

  await db.$executeRaw`
    INSERT INTO "ToolChainStep" (
      "id", "projectId", "toolChainSessionId", "stepIndex", "tool", "action",
      "sourceType", "destinationType", "dataSensitivity", "decision", "riskLevel", "metadataJson", "createdAt"
    )
    VALUES (
      ${stepId},
      ${auth.project.id},
      ${session.id},
      ${result.step.stepIndex},
      ${result.step.tool},
      ${result.step.action},
      ${result.step.sourceType},
      ${result.step.destinationType},
      ${result.step.dataSensitivity},
      ${result.decision}::"ToolChainDecision",
      ${result.riskLevel},
      ${JSON.stringify(sanitizeToolChainMetadata(input.metadata))}::jsonb,
      NOW()
    )
  `;

  await db.$executeRaw`
    UPDATE "ToolChainSession"
    SET "updatedAt" = NOW()
    WHERE "projectId" = ${auth.project.id} AND "id" = ${session.id}
  `;

  const findingIds = [];
  for (const finding of result.findings) {
    const findingId = await persistFinding(auth.project.id, session.id, finding);
    findingIds.push(findingId);
  }

  return jsonResponse({
    stepId,
    sessionId: input.sessionId,
    step: { ...result.step, id: stepId },
    decision: result.decision,
    riskLevel: result.riskLevel,
    reason: result.reason,
    findings: result.findings,
    findingIds,
  });
}

export async function getToolChainSession(auth: ToolChainAuth, sessionId: string) {
  const session = await findToolChainSession(auth.project.id, sessionId);
  if (!session) {
    return jsonResponse({ error: true, message: "Tool chain session not found." }, { status: 404 });
  }

  const [steps, findings] = await Promise.all([
    listStepsForSession(auth.project.id, session.id),
    listFindingsForSession(auth.project.id, session.id),
  ]);

  return jsonResponse({
    session: publicSession(session),
    steps: steps.map(publicStep),
    findings: findings.map(publicFinding),
  });
}

export async function listToolChainFindings(auth: ToolChainAuth, sessionId?: string) {
  if (sessionId) {
    const session = await findToolChainSession(auth.project.id, sessionId);
    if (!session) return jsonResponse({ findings: [] });
    const findings = await listFindingsForSession(auth.project.id, session.id);
    return jsonResponse({ findings: findings.map(publicFinding) });
  }

  const findings = await db.$queryRaw<ToolChainFindingRow[]>`
    SELECT "id", "projectId", "toolChainSessionId", "findingType", "riskLevel",
      "summary", "involvedStepsJson", "recommendation", "createdAt"
    FROM "ToolChainFinding"
    WHERE "projectId" = ${auth.project.id}
    ORDER BY "createdAt" DESC
    LIMIT 200
  `;
  return jsonResponse({ findings: findings.map(publicFinding) });
}

export { routeError };

async function persistFinding(projectId: string, toolChainSessionId: string, finding: ToolChainFindingCandidate) {
  const id = createToolChainFindingId();
  await db.$executeRaw`
    INSERT INTO "ToolChainFinding" (
      "id", "projectId", "toolChainSessionId", "findingType", "riskLevel",
      "summary", "involvedStepsJson", "recommendation", "createdAt"
    )
    VALUES (
      ${id},
      ${projectId},
      ${toolChainSessionId},
      ${finding.findingType}::"ToolChainFindingType",
      ${finding.riskLevel},
      ${safeToolChainSummary(finding.summary)},
      ${JSON.stringify(finding.involvedSteps)}::jsonb,
      ${safeToolChainSummary(finding.recommendation)},
      NOW()
    )
  `;
  return id;
}

async function findToolChainSession(projectId: string, sessionId: string) {
  const rows = await db.$queryRaw<ToolChainSessionRow[]>`
    SELECT "id", "projectId", "sessionId", "agentIdentityId", "status", "createdAt", "updatedAt"
    FROM "ToolChainSession"
    WHERE "projectId" = ${projectId} AND "sessionId" = ${sessionId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function listStepsForSession(projectId: string, toolChainSessionId: string) {
  return db.$queryRaw<ToolChainStepRow[]>`
    SELECT "id", "projectId", "toolChainSessionId", "stepIndex", "tool", "action",
      "sourceType", "destinationType", "dataSensitivity", "decision", "riskLevel", "metadataJson", "createdAt"
    FROM "ToolChainStep"
    WHERE "projectId" = ${projectId} AND "toolChainSessionId" = ${toolChainSessionId}
    ORDER BY "stepIndex" ASC
    LIMIT 200
  `;
}

async function listFindingsForSession(projectId: string, toolChainSessionId: string) {
  return db.$queryRaw<ToolChainFindingRow[]>`
    SELECT "id", "projectId", "toolChainSessionId", "findingType", "riskLevel",
      "summary", "involvedStepsJson", "recommendation", "createdAt"
    FROM "ToolChainFinding"
    WHERE "projectId" = ${projectId} AND "toolChainSessionId" = ${toolChainSessionId}
    ORDER BY "createdAt" DESC
    LIMIT 200
  `;
}

function snapshotStepRow(row: ToolChainStepRow): ToolChainStepSnapshot {
  return {
    id: row.id,
    stepIndex: row.stepIndex,
    tool: row.tool,
    action: row.action,
    sourceType: normalizeSourceType(row.sourceType),
    destinationType: normalizeDestinationType(row.destinationType),
    dataSensitivity: normalizeSensitivity(row.dataSensitivity),
    signals: inferSignalsFromStoredStep(row),
    decision: row.decision as ToolChainStepSnapshot["decision"],
    riskLevel: row.riskLevel as ToolChainStepSnapshot["riskLevel"],
  };
}

function inferSignalsFromStoredStep(row: ToolChainStepRow) {
  return evaluateToolChainStep([], {
    stepIndex: row.stepIndex,
    tool: row.tool,
    action: row.action,
    sourceType: normalizeSourceType(row.sourceType),
    destinationType: normalizeDestinationType(row.destinationType),
    dataSensitivity: normalizeSensitivity(row.dataSensitivity),
  }).step.signals;
}

function publicSession(row: ToolChainSessionRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    agentIdentityId: row.agentIdentityId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function publicStep(row: ToolChainStepRow) {
  return {
    id: row.id,
    sessionId: row.toolChainSessionId,
    stepIndex: row.stepIndex,
    tool: row.tool,
    action: row.action,
    sourceType: row.sourceType,
    destinationType: row.destinationType,
    dataSensitivity: row.dataSensitivity,
    decision: row.decision,
    riskLevel: row.riskLevel,
    metadata: row.metadataJson,
    createdAt: row.createdAt,
  };
}

function publicFinding(row: ToolChainFindingRow) {
  return {
    id: row.id,
    toolChainSessionId: row.toolChainSessionId,
    findingType: row.findingType,
    riskLevel: row.riskLevel,
    summary: row.summary,
    involvedSteps: Array.isArray(row.involvedStepsJson) ? row.involvedStepsJson : [],
    recommendation: row.recommendation,
    createdAt: row.createdAt,
  };
}

function normalizeSourceType(value: string): ToolChainSourceType {
  return TOOL_CHAIN_SOURCE_TYPES.includes(value as ToolChainSourceType) ? value as ToolChainSourceType : "UNKNOWN";
}

function normalizeDestinationType(value: string): ToolChainDestinationType {
  return TOOL_CHAIN_DESTINATION_TYPES.includes(value as ToolChainDestinationType) ? value as ToolChainDestinationType : "UNKNOWN";
}

function normalizeSensitivity(value: string): ToolChainDataSensitivity {
  return TOOL_CHAIN_DATA_SENSITIVITIES.includes(value as ToolChainDataSensitivity) ? value as ToolChainDataSensitivity : "UNKNOWN";
}
