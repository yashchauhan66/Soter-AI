/**
 * MCP Gateway — Approval Manager
 *
 * Manages approval lifecycle for REQURE_APPROVAL decisions on MCP tool calls.
 *
 * Key invariants:
 * - Approval is bound to exact session, tool, arguments fingerprint, tenant, and expiry
 * - Forward only after valid approval
 * - Reject reuse (single-use for "once" scope)
 * - Reject mutation (different args = different fingerprint = new approval needed)
 * - Support allow-once, deny, expiry, revocation, emergency lockdown
 * - Approval is enforcement, not advice returned to the caller
 */
import { randomUUID } from "crypto";
import type { ApprovalRequest } from "./MCPJsonRpcTypes";

export type ApprovalScope = "once" | "session" | "tenant";

export interface ApprovalManagerOptions {
  /** Default approval TTL in milliseconds (default: 5 minutes). */
  approvalTtlMs?: number;
  /** Maximum pending approvals per tenant. */
  maxPendingPerTenant?: number;
  /** Emergency lockdown mode — all approvals are rejected. */
  emergencyLockdown?: boolean;
}

const DEFAULT_APPROVAL_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_PENDING_PER_TENANT = 500;

export class ApprovalManager {
  private approvals = new Map<string, ApprovalRequest>();
  private readonly options: Required<ApprovalManagerOptions>;

  constructor(options: ApprovalManagerOptions = {}) {
    this.options = {
      approvalTtlMs: options.approvalTtlMs ?? DEFAULT_APPROVAL_TTL_MS,
      maxPendingPerTenant: options.maxPendingPerTenant ?? DEFAULT_MAX_PENDING_PER_TENANT,
      emergencyLockdown: options.emergencyLockdown ?? false,
    };
  }

  /**
   * Create a new approval request bound to the exact session, tool, args, and tenant.
   * Returns the approval request or throws if limits exceeded.
   */
  createApproval(params: {
    sessionId: string;
    toolName: string;
    args: Record<string, unknown>;
    argsFingerprint: string;
    displayArgs: Record<string, unknown>;
    tenant: string;
    project: string;
    clientId: string;
    userId?: string;
    traceId: string;
    riskScore: number;
    reason: string;
    scope?: ApprovalScope;
  }): ApprovalRequest {
    // Check emergency lockdown
    if (this.options.emergencyLockdown) {
      throw new Error("Emergency lockdown is active — all approvals are rejected");
    }

    // Enforce per-tenant pending limit
    const tenantPending = this.getPendingForTenant(params.tenant);
    if (tenantPending.length >= this.options.maxPendingPerTenant) {
      throw new Error(
        `Maximum pending approvals for tenant "${params.tenant}" (${this.options.maxPendingPerTenant}) reached`,
      );
    }

    const now = Date.now();
    const scope = params.scope ?? "once";
    const ttl = scope === "tenant" ? 24 * 60 * 60 * 1000 : this.options.approvalTtlMs;

    const approval: ApprovalRequest = {
      id: `apr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      sessionId: params.sessionId,
      toolName: params.toolName,
      argsFingerprint: params.argsFingerprint,
      displayArgs: this.sanitizeArgs(params.displayArgs),
      tenant: params.tenant,
      project: params.project,
      clientId: params.clientId,
      userId: params.userId,
      traceId: params.traceId,
      riskScore: params.riskScore,
      reason: params.reason,
      createdAt: now,
      expiresAt: now + ttl,
      status: "pending",
      scope,
      consumed: false,
    };

    this.approvals.set(approval.id, approval);
    return approval;
  }

  /**
   * Approve a pending approval request.
   * Returns true if approved, false if not found or not pending.
   */
  approve(approvalId: string, approvedBy: string): boolean {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== "pending") return false;

    // Check expiry
    if (Date.now() > approval.expiresAt) {
      approval.status = "expired";
      return false;
    }

    approval.status = "approved";
    approval.approvedBy = approvedBy;
    approval.approvedAt = Date.now();
    return true;
  }

  /**
   * Deny a pending approval request.
   */
  deny(approvalId: string): boolean {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== "pending") return false;
    approval.status = "denied";
    return true;
  }

  /**
   * Revoke an approved approval (e.g., for emergency lockdown).
   */
  revoke(approvalId: string): boolean {
    const approval = this.approvals.get(approvalId);
    if (!approval) return false;
    approval.status = "revoked";
    return true;
  }

  /**
   * Check if a tool call is approved.
   * Verifies:
   * - Approval exists and is in "approved" status
   * - Session ID matches
   * - Tool name matches
   * - Args fingerprint matches (prevents mutation)
   * - Tenant matches
   * - Not expired
   * - Not consumed (for "once" scope)
   *
   * Returns the approval if valid, null otherwise.
   */
  checkApproval(params: {
    sessionId: string;
    toolName: string;
    argsFingerprint: string;
    tenant: string;
  }): ApprovalRequest | null {
    // Find matching approval
    for (const approval of this.approvals.values()) {
      if (approval.status !== "approved") continue;
      if (approval.consumed && approval.scope === "once") continue;
      if (Date.now() > approval.expiresAt) {
        approval.status = "expired";
        continue;
      }
      if (approval.sessionId !== params.sessionId) continue;
      if (approval.toolName !== params.toolName) continue;
      if (approval.argsFingerprint !== params.argsFingerprint) continue;
      if (approval.tenant !== params.tenant) continue;

      return approval;
    }
    return null;
  }

  /**
   * Consume an approval (marks as consumed for "once" scope).
   * Returns true if consumed successfully.
   */
  consumeApproval(params: {
    sessionId: string;
    toolName: string;
    argsFingerprint: string;
    tenant: string;
  }): boolean {
    const approval = this.checkApproval(params);
    if (!approval) return false;

    if (approval.scope === "once") {
      approval.consumed = true;
    }
    return true;
  }

  /**
   * Get an approval by ID.
   */
  getApproval(approvalId: string): ApprovalRequest | undefined {
    return this.approvals.get(approvalId);
  }

  /**
   * Get all pending approvals for a tenant.
   */
  getPendingForTenant(tenant: string): ApprovalRequest[] {
    return Array.from(this.approvals.values()).filter(
      (a) => a.tenant === tenant && a.status === "pending",
    );
  }

  /**
   * Get all approvals for a session.
   */
  getSessionApprovals(sessionId: string): ApprovalRequest[] {
    return Array.from(this.approvals.values()).filter(
      (a) => a.sessionId === sessionId,
    );
  }

  /**
   * Revoke all approvals for a session (e.g., session close).
   */
  revokeSessionApprovals(sessionId: string): number {
    let count = 0;
    for (const approval of this.approvals.values()) {
      if (approval.sessionId === sessionId && approval.status !== "revoked") {
        approval.status = "revoked";
        count++;
      }
    }
    return count;
  }

  /**
   * Revoke all approvals for a tenant (e.g., tenant lockdown).
   */
  revokeTenantApprovals(tenant: string): number {
    let count = 0;
    for (const approval of this.approvals.values()) {
      if (approval.tenant === tenant && approval.status !== "revoked") {
        approval.status = "revoked";
        count++;
      }
    }
    return count;
  }

  /**
   * Set emergency lockdown mode.
   * When active, all new approval requests are rejected and existing approvals are revoked.
   */
  setEmergencyLockdown(active: boolean): void {
    this.options.emergencyLockdown = active;
    if (active) {
      // Revoke all pending and approved approvals
      for (const approval of this.approvals.values()) {
        if (approval.status === "pending" || approval.status === "approved") {
          approval.status = "revoked";
        }
      }
    }
  }

  /**
   * Clean up expired approvals.
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, approval] of this.approvals) {
      if (now > approval.expiresAt) {
        approval.status = "expired";
        this.approvals.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Get approval count.
   */
  get size(): number {
    return this.approvals.size;
  }

  /**
   * Clear all approvals.
   */
  clear(): void {
    this.approvals.clear();
  }

  /**
   * Sanitize display args — redact sensitive values for the approval UI.
   */
  private sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = /(password|secret|token|key|credential|auth|certificate|private)/i;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (sensitiveKeys.test(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "string" && value.length > 200) {
        sanitized[key] = value.slice(0, 200) + "... [truncated]";
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
