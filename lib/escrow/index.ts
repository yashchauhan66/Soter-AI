import { createHash, randomBytes, randomUUID } from "crypto";
import { analyzeText } from "@/lib/guard/analyze";
import { sanitizeLogText, sanitizeMetadata } from "@/lib/guard/logSafety";

export const ESCROW_STATUSES = ["PENDING", "APPROVED", "DENIED", "EXPIRED", "EXECUTED", "CANCELLED"] as const;
export const ESCROW_ACTOR_TYPES = ["USER", "ADMIN", "SYSTEM"] as const;
export const ESCROW_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const ESCROW_DECISIONS = ["CREATE_ESCROW", "BLOCK", "ALLOW"] as const;

export type EscrowStatus = (typeof ESCROW_STATUSES)[number];
export type EscrowActorType = (typeof ESCROW_ACTOR_TYPES)[number];
export type EscrowRiskLevel = (typeof ESCROW_RISK_LEVELS)[number];
export type EscrowCreateDecision = (typeof ESCROW_DECISIONS)[number];

export interface EscrowCreateInput {
  transactionType: string;
  tool: string;
  action: string;
  target?: string;
  originalPayload?: string;
  safePayload?: string;
  riskLevel?: EscrowRiskLevel;
  policyAllowsCriticalReview?: boolean;
  metadata?: Record<string, unknown>;
}

export interface EscrowCreateEvaluation {
  decision: EscrowCreateDecision;
  riskLevel: EscrowRiskLevel;
  reason: string;
  originalPayloadRedacted: string | null;
  safePayload: string | null;
  findings: string[];
}

export interface EscrowSnapshot {
  status: EscrowStatus;
  expiresAt: Date;
  executedAt?: Date | null;
}

export function createEscrowTransactionId() {
  return `agent_escrow_${randomUUID()}`;
}

export function createEscrowAuditId() {
  return `agent_escrow_audit_${randomUUID()}`;
}

export function createEscrowApprovalToken() {
  const approvalToken = `esc_${randomBytes(24).toString("base64url")}`;
  return { approvalToken, approvalTokenHash: hashEscrowApprovalToken(approvalToken) };
}

export function hashEscrowApprovalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isEscrowApprovalTokenValid(rawToken: string, expectedHash: string) {
  return hashEscrowApprovalToken(rawToken) === expectedHash;
}

export function evaluateEscrowCreation(input: EscrowCreateInput): EscrowCreateEvaluation {
  const text = `${input.transactionType} ${input.tool} ${input.action} ${input.target ?? ""} ${input.originalPayload ?? ""}`;
  const guard = analyzeText(input.originalPayload ?? "", "INPUT");
  const highImpact = isHighImpactEscrowAction(text);
  const external = isExternalEscrowAction(text);
  const destructive = isDestructiveEscrowAction(text);
  const payment = isPaymentEscrowAction(text);
  const hasSecret = guard.riskTypes.includes("SECRET_DETECTED");
  const hasPii = guard.riskTypes.includes("PII_DETECTED") || guard.riskTypes.includes("INDIA_PII_DETECTED");
  const promptAttack = guard.riskTypes.includes("PROMPT_INJECTION") || guard.riskTypes.includes("JAILBREAK");
  const explicitRisk = input.riskLevel ?? riskFromSignals({ hasSecret, hasPii, promptAttack, highImpact, external, destructive, payment });
  const originalPayloadRedacted = input.originalPayload ? sanitizeLogText(input.originalPayload) : null;
  const safePayload = sanitizeLogText(input.safePayload ?? input.originalPayload ?? "");
  const findings = [
    hasSecret ? "SECRET_DETECTED" : null,
    hasPii ? "PII_DETECTED" : null,
    promptAttack ? "PROMPT_OR_POLICY_BYPASS" : null,
    external ? "EXTERNAL_DESTINATION" : null,
    destructive ? "DESTRUCTIVE_ACTION" : null,
    payment ? "PAYMENT_OR_PURCHASE" : null,
  ].filter((finding): finding is string => Boolean(finding));

  if (hasSecret && external && !input.policyAllowsCriticalReview) {
    return {
      decision: "BLOCK",
      riskLevel: "CRITICAL",
      reason: "Critical secret exfiltration risk must be blocked instead of escrowed.",
      originalPayloadRedacted,
      safePayload: safePayload || null,
      findings,
    };
  }

  if (promptAttack && highImpact) {
    return {
      decision: "BLOCK",
      riskLevel: "CRITICAL",
      reason: "Prompt injection or policy bypass content cannot create an executable escrow.",
      originalPayloadRedacted,
      safePayload: safePayload || null,
      findings,
    };
  }

  if (highImpact || external || destructive || payment || hasPii || explicitRisk === "HIGH" || explicitRisk === "CRITICAL") {
    return {
      decision: "CREATE_ESCROW",
      riskLevel: explicitRisk === "LOW" ? "MEDIUM" : explicitRisk,
      reason: "Risky or irreversible agent action requires escrow approval before execution.",
      originalPayloadRedacted,
      safePayload: safePayload || null,
      findings,
    };
  }

  return {
    decision: "ALLOW",
    riskLevel: explicitRisk,
    reason: "Action is low risk and does not require transaction escrow.",
    originalPayloadRedacted,
    safePayload: safePayload || null,
    findings,
  };
}

export function canApproveEscrow(snapshot: EscrowSnapshot, now = new Date()) {
  if (snapshot.status !== "PENDING") return { ok: false as const, status: snapshot.status, reason: `Escrow is already ${snapshot.status.toLowerCase()}.` };
  if (snapshot.expiresAt.getTime() < now.getTime()) return { ok: false as const, status: "EXPIRED" as const, reason: "Escrow approval expired." };
  return { ok: true as const };
}

export function canExecuteEscrow(snapshot: EscrowSnapshot, now = new Date()) {
  if (snapshot.status === "EXECUTED" || snapshot.executedAt) return { ok: false as const, status: "EXECUTED" as const, reason: "Escrow transaction has already executed." };
  if (snapshot.status !== "APPROVED") return { ok: false as const, status: snapshot.status, reason: "Escrow transaction must be approved before execution." };
  if (snapshot.expiresAt.getTime() < now.getTime()) return { ok: false as const, status: "EXPIRED" as const, reason: "Escrow transaction expired before execution." };
  return { ok: true as const };
}

export function rescanEditedEscrowPayload(input: EscrowCreateInput & { editedPayload: string }) {
  return evaluateEscrowCreation({
    ...input,
    originalPayload: input.editedPayload,
    safePayload: input.editedPayload,
  });
}

export function sanitizeEscrowText(value?: string | null) {
  return value ? sanitizeLogText(value) : null;
}

export function sanitizeEscrowMetadata(metadata?: Record<string, unknown>) {
  return sanitizeMetadata(metadata);
}

function isHighImpactEscrowAction(text: string) {
  return /\b(send|submit|payment|pay|purchase|book|delete|drop|update|write|publish|push|post|calendar|invite|account setting|external api)\b/i.test(text);
}

function isExternalEscrowAction(text: string) {
  return /https?:\/\/|@[a-z0-9.-]+\.[a-z]{2,}|\b(external|email|gmail|webhook|api post|external api|submit form)\b/i.test(text);
}

function isDestructiveEscrowAction(text: string) {
  return /\b(delete|drop|truncate|purge|rm -rf|destroy|overwrite|update database|write database)\b/i.test(text);
}

function isPaymentEscrowAction(text: string) {
  return /\b(pay|payment|purchase|buy|checkout|book ticket|book flight|book hotel|charge)\b/i.test(text);
}

function riskFromSignals(input: { hasSecret: boolean; hasPii: boolean; promptAttack: boolean; highImpact: boolean; external: boolean; destructive: boolean; payment: boolean }): EscrowRiskLevel {
  if (input.hasSecret || input.promptAttack || (input.destructive && input.external)) return "CRITICAL";
  if (input.payment || input.destructive || (input.hasPii && input.external) || (input.highImpact && input.external)) return "HIGH";
  if (input.highImpact || input.external || input.hasPii) return "MEDIUM";
  return "LOW";
}
