import { z } from "zod";
import { jsonResponse } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { db } from "@/lib/db";
import {
  INTENT_CATEGORIES,
  checkIntentAction,
  createAgentIntentActionCheckId,
  createAgentIntentRecordId,
  extractAgentIntent,
  safeIntentJson,
  sanitizeIntentText,
  type AgentIntentRecordSnapshot,
  type ExtractedIntent,
  type IntentCategory,
} from "@/lib/agent-intent";

const intentCategory = z.enum(INTENT_CATEGORIES);

export const intentExtractSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  userPrompt: z.string().min(1).max(20_000),
  allowedIntentCategories: z.array(intentCategory).max(30).optional(),
  forbiddenIntentCategories: z.array(intentCategory).max(30).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const intentActionCheckSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  intentRecordId: z.string().trim().min(1).max(200).optional(),
  tool: z.string().trim().min(1).max(160),
  action: z.string().trim().min(1).max(200),
  target: z.string().trim().max(2000).optional(),
  actionDescription: z.string().trim().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type IntentAuth = Extract<Awaited<ReturnType<typeof authenticateAdvancedSecurity>>, { ok: true }>["auth"];

type IntentRecordRow = {
  id: string;
  projectId: string;
  sessionId: string;
  userPromptHash: string;
  userPromptRedacted: string;
  extractedIntentJson: unknown;
  allowedIntentCategoriesJson: unknown;
  forbiddenIntentCategoriesJson: unknown;
  createdAt: Date;
};

type IntentActionCheckRow = {
  id: string;
  projectId: string;
  sessionId: string;
  intentRecordId: string;
  tool: string;
  action: string;
  target: string | null;
  actionDescription: string | null;
  intentMatchScore: number;
  decision: string;
  riskLevel: string;
  reason: string;
  createdAt: Date;
};

export async function extractAndPersistAgentIntent(auth: IntentAuth, input: z.infer<typeof intentExtractSchema>) {
  const extracted = extractAgentIntent({
    userPrompt: input.userPrompt,
    allowedIntentCategories: input.allowedIntentCategories,
    forbiddenIntentCategories: input.forbiddenIntentCategories,
  });
  const intentRecordId = createAgentIntentRecordId();
  const intentJson = safeIntentJson(extracted.extractedIntent);

  await db.$executeRaw`
    INSERT INTO "AgentIntentRecord" (
      "id", "projectId", "sessionId", "userPromptHash", "userPromptRedacted",
      "extractedIntentJson", "allowedIntentCategoriesJson", "forbiddenIntentCategoriesJson", "createdAt"
    )
    VALUES (
      ${intentRecordId},
      ${auth.project.id},
      ${input.sessionId},
      ${extracted.userPromptHash},
      ${extracted.userPromptRedacted},
      ${JSON.stringify(intentJson)}::jsonb,
      ${JSON.stringify(extracted.allowedIntentCategories)}::jsonb,
      ${JSON.stringify(extracted.forbiddenIntentCategories)}::jsonb,
      NOW()
    )
  `;

  return jsonResponse({
    intentRecordId,
    projectId: auth.project.id,
    sessionId: input.sessionId,
    userPromptHash: extracted.userPromptHash,
    userPromptRedacted: extracted.userPromptRedacted,
    extractedIntent: intentJson,
    allowedIntentCategories: extracted.allowedIntentCategories,
    forbiddenIntentCategories: extracted.forbiddenIntentCategories,
  }, { status: 201 });
}

export async function checkAndPersistIntentAction(auth: IntentAuth, input: z.infer<typeof intentActionCheckSchema>) {
  const record = await findIntentRecord(auth.project.id, input.sessionId, input.intentRecordId);
  if (!record) {
    return jsonResponse({
      error: true,
      decision: "REVIEW",
      riskLevel: "HIGH",
      reason: "No project-scoped intent record was found for this session. Extract intent before action execution.",
    }, { status: 404 });
  }

  const snapshot = snapshotIntentRecord(record);
  const result = checkIntentAction({
    intent: snapshot,
    tool: input.tool,
    action: input.action,
    target: input.target,
    actionDescription: input.actionDescription,
  });
  const checkId = createAgentIntentActionCheckId();

  await db.$executeRaw`
    INSERT INTO "AgentIntentActionCheck" (
      "id", "projectId", "sessionId", "intentRecordId", "tool", "action", "target",
      "actionDescription", "intentMatchScore", "decision", "riskLevel", "reason", "createdAt"
    )
    VALUES (
      ${checkId},
      ${auth.project.id},
      ${input.sessionId},
      ${record.id},
      ${input.tool},
      ${input.action},
      ${sanitizeIntentText(input.target)},
      ${sanitizeIntentText(input.actionDescription)},
      ${result.intentMatchScore},
      ${result.decision}::"AgentIntentDecision",
      ${result.riskLevel},
      ${result.reason},
      NOW()
    )
  `;

  return jsonResponse({
    actionCheckId: checkId,
    intentRecordId: record.id,
    sessionId: input.sessionId,
    ...result,
  });
}

export async function getIntentSession(auth: IntentAuth, sessionId: string) {
  const [records, checks] = await Promise.all([
    db.$queryRaw<IntentRecordRow[]>`
      SELECT "id", "projectId", "sessionId", "userPromptHash", "userPromptRedacted",
        "extractedIntentJson", "allowedIntentCategoriesJson", "forbiddenIntentCategoriesJson", "createdAt"
      FROM "AgentIntentRecord"
      WHERE "projectId" = ${auth.project.id} AND "sessionId" = ${sessionId}
      ORDER BY "createdAt" ASC
      LIMIT 100
    `,
    db.$queryRaw<IntentActionCheckRow[]>`
      SELECT "id", "projectId", "sessionId", "intentRecordId", "tool", "action", "target",
        "actionDescription", "intentMatchScore", "decision", "riskLevel", "reason", "createdAt"
      FROM "AgentIntentActionCheck"
      WHERE "projectId" = ${auth.project.id} AND "sessionId" = ${sessionId}
      ORDER BY "createdAt" ASC
      LIMIT 200
    `,
  ]);

  return jsonResponse({
    sessionId,
    records: records.map(publicIntentRecord),
    actionChecks: checks,
  });
}

export { routeError };

async function findIntentRecord(projectId: string, sessionId: string, intentRecordId?: string) {
  if (intentRecordId) {
    const rows = await db.$queryRaw<IntentRecordRow[]>`
      SELECT "id", "projectId", "sessionId", "userPromptHash", "userPromptRedacted",
        "extractedIntentJson", "allowedIntentCategoriesJson", "forbiddenIntentCategoriesJson", "createdAt"
      FROM "AgentIntentRecord"
      WHERE "projectId" = ${projectId} AND "sessionId" = ${sessionId} AND "id" = ${intentRecordId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  const rows = await db.$queryRaw<IntentRecordRow[]>`
    SELECT "id", "projectId", "sessionId", "userPromptHash", "userPromptRedacted",
      "extractedIntentJson", "allowedIntentCategoriesJson", "forbiddenIntentCategoriesJson", "createdAt"
    FROM "AgentIntentRecord"
    WHERE "projectId" = ${projectId} AND "sessionId" = ${sessionId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function publicIntentRecord(row: IntentRecordRow) {
  const snapshot = snapshotIntentRecord(row);
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    userPromptHash: row.userPromptHash,
    userPromptRedacted: row.userPromptRedacted,
    extractedIntent: snapshot.extractedIntent,
    allowedIntentCategories: snapshot.allowedIntentCategories,
    forbiddenIntentCategories: snapshot.forbiddenIntentCategories,
    createdAt: row.createdAt,
  };
}

function snapshotIntentRecord(row: IntentRecordRow): AgentIntentRecordSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    userPromptHash: row.userPromptHash,
    userPromptRedacted: row.userPromptRedacted,
    extractedIntent: extractedIntentFromJson(row.extractedIntentJson),
    allowedIntentCategories: categoriesFromJson(row.allowedIntentCategoriesJson),
    forbiddenIntentCategories: categoriesFromJson(row.forbiddenIntentCategoriesJson),
  };
}

function extractedIntentFromJson(value: unknown): ExtractedIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { primaryCategory: "UNKNOWN", categories: ["UNKNOWN"], confidence: 0.2, summary: "Intent unavailable.", signals: [], injectionDetected: false };
  }
  const record = value as Record<string, unknown>;
  const categories = categoriesFromJson(record.categories);
  const primary = INTENT_CATEGORIES.includes(record.primaryCategory as IntentCategory)
    ? record.primaryCategory as IntentCategory
    : categories[0] ?? "UNKNOWN";
  return {
    primaryCategory: primary,
    categories: categories.length > 0 ? categories : ["UNKNOWN"],
    confidence: typeof record.confidence === "number" ? record.confidence : 0.2,
    summary: typeof record.summary === "string" ? sanitizeIntentText(record.summary) ?? "Intent unavailable." : "Intent unavailable.",
    signals: Array.isArray(record.signals) ? record.signals.filter((signal): signal is string => typeof signal === "string") : [],
    injectionDetected: record.injectionDetected === true,
  };
}

function categoriesFromJson(value: unknown): IntentCategory[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is IntentCategory => INTENT_CATEGORIES.includes(item as IntentCategory));
}
