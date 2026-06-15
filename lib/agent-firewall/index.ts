import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { sanitizeLogText, sanitizeMetadata } from "@/lib/guard/logSafety";
import { requireTenantProjectOwnership } from "@/lib/phase11/tenantIsolation";

export const AGENT_FIREWALL_PREVIEW_GAPS = [
  "Inspection and approval queue exist; runtime agent execution enforcement integration is not complete.",
  "Approver assignment, SLA, and notification routing are not wired to email/SIEM in this preview.",
  "Approval audit trail covers persistence only; reviewer attestation export is not complete.",
  "Provider-specific agent runtime hooks require authorized integration setup before production use.",
] as const;

export const TOOL_CATEGORIES = [
  "READ_ONLY",
  "WRITE",
  "EXTERNAL_API",
  "EMAIL",
  "PAYMENT",
  "DATABASE",
  "FILE_SYSTEM",
  "WEB_BROWSER",
  "CODE_EXECUTION",
  "ADMIN_ACTION",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolDecision = "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "BLOCK";

export interface ToolCallInspectionInput {
  tool?: { id?: string; name: string; category: ToolCategory; enabled?: boolean };
  permission?: { allow: boolean; requiresApproval?: boolean } | null;
  action: string;
  input?: Record<string, unknown>;
  highRiskPromptContext?: boolean;
}

const BASE_RISK: Record<ToolCategory, number> = {
  READ_ONLY: 15,
  WRITE: 55,
  EXTERNAL_API: 55,
  EMAIL: 75,
  PAYMENT: 85,
  DATABASE: 70,
  FILE_SYSTEM: 70,
  WEB_BROWSER: 45,
  CODE_EXECUTION: 100,
  ADMIN_ACTION: 95,
};

const APPROVAL_GATED_CATEGORIES = new Set<ToolCategory>([
  "WRITE",
  "EXTERNAL_API",
  "EMAIL",
  "PAYMENT",
  "DATABASE",
  "FILE_SYSTEM",
]);

export function inspectToolCall(input: ToolCallInspectionInput) {
  if (!input.tool) {
    return decision("DENY", 100, "Unknown tools are denied by default.", input);
  }
  if (!input.tool.enabled) {
    return decision("DENY", 80, "Tool is disabled or not registered as enabled.", input);
  }
  if (!input.permission?.allow) {
    return decision("DENY", 80, "Tool permission is not granted for this project or role.", input);
  }

  let riskScore = BASE_RISK[input.tool.category] ?? 80;
  const action = input.action.toLowerCase();
  if (/(delete|drop|purge|export|permission|role|refund|charge|send)/.test(action)) riskScore += 15;
  if (input.highRiskPromptContext) riskScore += 15;
  riskScore = Math.min(100, riskScore);

  if (input.tool.category === "CODE_EXECUTION") return decision("BLOCK", riskScore, "Code execution tools are blocked by the production firewall scaffold.", input);
  if (input.tool.category === "ADMIN_ACTION" || /(drop\s+database|truncate|purge\s+tenant|delete\s+organization|permission|role)/.test(action)) {
    return decision("BLOCK", riskScore, "Administrative or destructive tool action blocked.", input);
  }
  if (APPROVAL_GATED_CATEGORIES.has(input.tool.category) && riskScore >= 70) {
    return decision("APPROVAL_REQUIRED", riskScore, "Human approval required before execution.", input);
  }
  if (riskScore >= 90) return decision("BLOCK", riskScore, "Critical tool action blocked.", input);
  if (input.permission.requiresApproval || riskScore >= 70) return decision("APPROVAL_REQUIRED", riskScore, "Human approval required before execution.", input);
  return decision("ALLOW", riskScore, "Tool call allowed by policy.", input);
}

export function previewToolAction(input: ToolCallInspectionInput) {
  const inspected = inspectToolCall(input);
  return {
    simulateOnly: true,
    decision: inspected.decision,
    riskScore: inspected.riskScore,
    reason: inspected.reason,
    redactedInput: inspected.redactedInput,
  };
}

export async function persistToolCallInspection(input: ToolCallInspectionInput & { organizationId: string; projectId: string; actorUserId?: string | null }) {
  await requireTenantProjectOwnership({ organizationId: input.organizationId, projectId: input.projectId });
  const inspected = inspectToolCall(input);
  const logId = `tool_log_${randomUUID()}`;
  await db.$queryRaw`
    INSERT INTO "ToolCallLog" ("id", "organizationId", "projectId", "toolId", "toolName", "action", "category", "riskScore", "decision", "redactedInput", "reason", "actorUserId", "createdAt")
    VALUES (${logId}, ${input.organizationId}, ${input.projectId}, ${input.tool?.id ?? null}, ${input.tool?.name ?? "unknown"}, ${input.action}, ${input.tool?.category ?? "UNKNOWN"}, ${inspected.riskScore}, ${inspected.decision}, ${JSON.stringify(inspected.redactedInput)}::jsonb, ${inspected.reason}, ${input.actorUserId ?? null}, NOW())
  `;
  if (inspected.decision === "APPROVAL_REQUIRED") {
    await db.$queryRaw`
      INSERT INTO "ToolApprovalRequest" ("id", "organizationId", "projectId", "toolCallLogId", "status", "requestedById", "reason", "preview", "createdAt")
      VALUES (${`tool_approval_${randomUUID()}`}, ${input.organizationId}, ${input.projectId}, ${logId}, 'PENDING', ${input.actorUserId ?? null}, ${inspected.reason}, ${JSON.stringify(previewToolAction(input))}::jsonb, NOW())
    `;
  }
  return { logId, ...inspected };
}

function decision(decisionValue: ToolDecision, riskScore: number, reason: string, input: ToolCallInspectionInput) {
  return {
    decision: decisionValue,
    riskScore,
    reason,
    redactedInput: redactToolPayload(input.input ?? {}),
  };
}

export function redactToolPayload(payload: Record<string, unknown>) {
  const flattened: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/token|secret|password|authorization|api.?key/i.test(key)) continue;
    if (typeof value === "string") flattened[key] = sanitizeLogText(value);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) flattened[key] = value;
    else flattened[key] = sanitizeLogText(JSON.stringify(value).slice(0, 500));
  }
  return sanitizeMetadata(flattened);
}
