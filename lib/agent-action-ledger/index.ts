import { createHash, randomUUID } from "crypto";

export type AgentActionReversalStatus = "REVERSIBLE" | "COMPENSATING_ACTION" | "IRREVERSIBLE" | "UNKNOWN";
export type AgentActionLedgerDecision = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";
export type AgentActionLedgerRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AgentActionLedgerInput {
  projectId?: string;
  sessionId?: string;
  agentIdentityId?: string;
  passportId?: string;
  tool: string;
  action: string;
  target?: string;
  request?: unknown;
  result?: unknown;
  forwardAction?: unknown;
  rollbackAction?: unknown;
  idempotencyKey?: string;
  executedAt?: Date | string;
}

export interface AgentActionLedgerEntry {
  id: string;
  actionHash: string;
  idempotencyKey: string;
  tool: string;
  action: string;
  target: string | null;
  reversalStatus: AgentActionReversalStatus;
  decision: AgentActionLedgerDecision;
  riskLevel: AgentActionLedgerRiskLevel;
  rollbackDeadline: string | null;
  rollbackAction: unknown;
  irreversibleReason: string | null;
  summary: string;
  evidence: {
    requestHash: string;
    resultHash: string;
    forwardActionHash: string;
    rollbackActionHash: string | null;
  };
}

const IRREVERSIBLE_PATTERN = /(payment\.charge|charge|wire|bank|upi|delete|drop|truncate|purge|send_sms|otp|legal\.accept|terms\.accept|publish|deploy|domain\.transfer)/i;
const COMPENSATING_PATTERN = /(gmail\.send|email\.send|slack\.post|ticket\.close|refund|invoice|crm\.update|calendar\.create|webhook\.post)/i;
const REVERSIBLE_PATTERN = /(draft|filesystem\.write|memory\.write|database\.update|ticket\.update|calendar\.update|label|tag|note|comment)/i;

export function createActionLedgerEntry(input: AgentActionLedgerInput): AgentActionLedgerEntry {
  const tool = normalize(input.tool);
  const action = normalize(input.action);
  const combined = `${tool} ${action}`;
  const rollbackAction = input.rollbackAction ?? inferRollbackAction(tool, action, input.target);
  const reversalStatus = classifyReversal(combined, rollbackAction);
  const riskLevel = riskForAction(combined, reversalStatus);
  const decision = decisionFor(reversalStatus, riskLevel);
  const executedAt = input.executedAt ? new Date(input.executedAt) : new Date();
  const rollbackDeadline = reversalStatus === "IRREVERSIBLE" ? null : new Date(executedAt.getTime() + rollbackWindowMs(reversalStatus, riskLevel)).toISOString();
  const actionHash = stableHash({
    sessionId: input.sessionId,
    agentIdentityId: input.agentIdentityId,
    passportId: input.passportId,
    tool,
    action,
    target: input.target ?? null,
    request: input.request ?? null,
    forwardAction: input.forwardAction ?? null,
  });
  const idempotencyKey = input.idempotencyKey?.trim() || `ledger_${actionHash.slice(0, 24)}`;

  return {
    id: `agent_action_ledger_${randomUUID()}`,
    actionHash,
    idempotencyKey,
    tool,
    action,
    target: input.target ?? null,
    reversalStatus,
    decision,
    riskLevel,
    rollbackDeadline,
    rollbackAction,
    irreversibleReason: reversalStatus === "IRREVERSIBLE" ? irreversibleReason(combined) : null,
    summary: summarize(tool, action, reversalStatus, decision),
    evidence: {
      requestHash: stableHash(input.request ?? null),
      resultHash: stableHash(input.result ?? null),
      forwardActionHash: stableHash(input.forwardAction ?? { tool, action, target: input.target ?? null }),
      rollbackActionHash: rollbackAction ? stableHash(rollbackAction) : null,
    },
  };
}

export function validateRollbackAttempt(entry: Pick<AgentActionLedgerEntry, "reversalStatus" | "rollbackDeadline" | "rollbackAction">, now = new Date()) {
  if (entry.reversalStatus === "IRREVERSIBLE") {
    return { allowed: false, reason: "Action is marked irreversible. Use incident response or manual remediation." };
  }
  if (!entry.rollbackAction) {
    return { allowed: false, reason: "No rollback action is available for this ledger entry." };
  }
  if (entry.rollbackDeadline && new Date(entry.rollbackDeadline).getTime() < now.getTime()) {
    return { allowed: false, reason: "Rollback deadline has passed; require manual compensating review." };
  }
  return { allowed: true, reason: "Rollback can be attempted using the stored rollback action." };
}

function classifyReversal(combined: string, rollbackAction: unknown): AgentActionReversalStatus {
  if (IRREVERSIBLE_PATTERN.test(combined)) return "IRREVERSIBLE";
  if (rollbackAction) return "REVERSIBLE";
  if (COMPENSATING_PATTERN.test(combined)) return "COMPENSATING_ACTION";
  if (REVERSIBLE_PATTERN.test(combined)) return "REVERSIBLE";
  return "UNKNOWN";
}

function riskForAction(combined: string, reversalStatus: AgentActionReversalStatus): AgentActionLedgerRiskLevel {
  if (reversalStatus === "IRREVERSIBLE") return "CRITICAL";
  if (/send|post|submit|write|update|refund|external|webhook|browser/.test(combined)) return reversalStatus === "UNKNOWN" ? "HIGH" : "MEDIUM";
  if (/read|search|list|get/.test(combined)) return "LOW";
  return reversalStatus === "UNKNOWN" ? "MEDIUM" : "LOW";
}

function decisionFor(reversalStatus: AgentActionReversalStatus, riskLevel: AgentActionLedgerRiskLevel): AgentActionLedgerDecision {
  if (reversalStatus === "IRREVERSIBLE") return "BLOCK";
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL" || reversalStatus === "UNKNOWN") return "REQUIRE_APPROVAL";
  return "ALLOW";
}

function inferRollbackAction(tool: string, action: string, target: string | undefined) {
  const combined = `${tool} ${action}`;
  if (/draft/.test(combined)) return { tool, action: "delete_draft", target };
  if (/calendar\.create|create_event/.test(combined)) return { tool: "calendar.delete", action: "delete_event", target };
  if (/ticket\.close/.test(combined)) return { tool: "ticket.reopen", action: "reopen_ticket", target };
  if (/label|tag/.test(combined)) return { tool, action: "remove_label", target };
  if (/filesystem\.write|memory\.write|database\.update/.test(combined)) return { tool, action: "restore_previous_value", target };
  return null;
}

function rollbackWindowMs(reversalStatus: AgentActionReversalStatus, riskLevel: AgentActionLedgerRiskLevel) {
  if (reversalStatus === "COMPENSATING_ACTION" || riskLevel === "HIGH") return 15 * 60 * 1000;
  return 60 * 60 * 1000;
}

function irreversibleReason(combined: string) {
  if (/payment|charge|wire|bank|upi/.test(combined)) return "Money movement is irreversible without an external refund or bank workflow.";
  if (/delete|drop|truncate|purge/.test(combined)) return "Destructive deletion may permanently remove data.";
  if (/legal\.accept|terms\.accept/.test(combined)) return "Legal acceptance binds the account and must be approved before execution.";
  return "This action has no reliable automated rollback.";
}

function summarize(tool: string, action: string, reversalStatus: AgentActionReversalStatus, decision: AgentActionLedgerDecision) {
  return `${decision}: ${tool}.${action} is ${reversalStatus.toLowerCase().replace(/_/g, " ")}.`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function stableHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}
