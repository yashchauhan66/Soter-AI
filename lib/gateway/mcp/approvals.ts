/**
 * MCP approval store — enforcement, not advice.
 *
 * A REQUIRE_APPROVAL decision does NOT forward the tool call. Instead a
 * redacted approval request is created, cryptographically bound to the exact
 * (tenant, project, session, tool, argument fingerprint) tuple with an expiry.
 * The call is only forwarded after a matching grant is approved, and each
 * grant is single-use: reuse (replay) or any argument mutation is rejected.
 *
 * Storage is in-memory and process-local (the gateway is a single-session
 * proxy). No raw arguments are stored — only the fingerprint and a bounded,
 * already-redacted preview.
 */
import { createHash, randomBytes } from "crypto";

export type ApprovalState = "PENDING" | "APPROVED" | "DENIED" | "CONSUMED" | "EXPIRED" | "REVOKED";

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  projectId: string;
  sessionId: string;
  server: string;
  tool: string;
  argsFingerprint: string;
  /** Already-redacted, bounded preview shown to the approver. */
  redactedPreview: string;
  reason: string;
  state: ApprovalState;
  createdAt: number;
  expiresAt: number;
}

export interface ApprovalBinding {
  tenantId: string;
  projectId: string;
  sessionId: string;
  server: string;
  tool: string;
  argsFingerprint: string;
}

export interface CreateApprovalInput extends ApprovalBinding {
  redactedPreview: string;
  reason: string;
  ttlMs?: number;
}

export interface ConsumeResult {
  ok: boolean;
  reason?: "NOT_FOUND" | "NOT_APPROVED" | "EXPIRED" | "MUTATED" | "REVOKED" | "ALREADY_USED" | "LOCKDOWN";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function bindingKey(b: ApprovalBinding): string {
  return [b.tenantId, b.projectId, b.sessionId, b.server, b.tool, b.argsFingerprint].join("::");
}

export class ApprovalStore {
  private readonly byId = new Map<string, ApprovalRequest>();
  private readonly byBinding = new Map<string, string>();
  private readonly tokenHashById = new Map<string, string>();
  private lockdown = false;
  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Emergency lockdown: reject every pending and future approval consumption. */
  engageLockdown(): void {
    this.lockdown = true;
    for (const req of this.byId.values()) {
      if (req.state === "PENDING" || req.state === "APPROVED") req.state = "REVOKED";
    }
  }

  liftLockdown(): void {
    this.lockdown = false;
  }

  isLockedDown(): boolean {
    return this.lockdown;
  }

  private expireIfNeeded(req: ApprovalRequest): void {
    if ((req.state === "PENDING" || req.state === "APPROVED") && this.now() > req.expiresAt) {
      req.state = "EXPIRED";
    }
  }

  /** Find an existing live request for a binding, if any. */
  findPending(binding: ApprovalBinding): ApprovalRequest | undefined {
    const id = this.byBinding.get(bindingKey(binding));
    if (!id) return undefined;
    const req = this.byId.get(id);
    if (!req) return undefined;
    this.expireIfNeeded(req);
    if (req.state === "PENDING" || req.state === "APPROVED") return req;
    return undefined;
  }

  create(input: CreateApprovalInput): ApprovalRequest {
    const existing = this.findPending(input);
    if (existing) return existing;
    const id = `apr_${randomBytes(9).toString("hex")}`;
    const ttl = input.ttlMs ?? 15 * 60_000;
    const req: ApprovalRequest = {
      id,
      tenantId: input.tenantId,
      projectId: input.projectId,
      sessionId: input.sessionId,
      server: input.server,
      tool: input.tool,
      argsFingerprint: input.argsFingerprint,
      redactedPreview: input.redactedPreview,
      reason: input.reason,
      state: "PENDING",
      createdAt: this.now(),
      expiresAt: this.now() + ttl,
    };
    this.byId.set(id, req);
    this.byBinding.set(bindingKey(input), id);
    return req;
  }

  /** Approve a pending request. Returns a one-time token the client must present. */
  approve(id: string): { ok: boolean; token?: string; reason?: string } {
    const req = this.byId.get(id);
    if (!req) return { ok: false, reason: "NOT_FOUND" };
    if (this.lockdown) return { ok: false, reason: "LOCKDOWN" };
    this.expireIfNeeded(req);
    if (req.state !== "PENDING") return { ok: false, reason: `NOT_PENDING:${req.state}` };
    const token = randomBytes(24).toString("hex");
    this.tokenHashById.set(id, hashToken(token));
    req.state = "APPROVED";
    return { ok: true, token };
  }

  deny(id: string): boolean {
    const req = this.byId.get(id);
    if (!req) return false;
    req.state = "DENIED";
    return true;
  }

  revoke(id: string): boolean {
    const req = this.byId.get(id);
    if (!req) return false;
    req.state = "REVOKED";
    return true;
  }

  /**
   * Consume an approval for a specific binding. Enforces: approved state,
   * not expired/revoked/used, exact binding match (mutation → reject),
   * optional token match, and single-use semantics.
   */
  consume(binding: ApprovalBinding, token?: string): ConsumeResult {
    if (this.lockdown) return { ok: false, reason: "LOCKDOWN" };
    const id = this.byBinding.get(bindingKey(binding));
    if (!id) return { ok: false, reason: "NOT_FOUND" };
    const req = this.byId.get(id);
    if (!req) return { ok: false, reason: "NOT_FOUND" };
    this.expireIfNeeded(req);
    if (req.state === "CONSUMED") return { ok: false, reason: "ALREADY_USED" };
    if (req.state === "EXPIRED") return { ok: false, reason: "EXPIRED" };
    if (req.state === "REVOKED" || req.state === "DENIED") return { ok: false, reason: "REVOKED" };
    if (req.state !== "APPROVED") return { ok: false, reason: "NOT_APPROVED" };
    // Binding already matched via key, but re-verify fingerprint explicitly to
    // make argument mutation rejection unambiguous.
    if (req.argsFingerprint !== binding.argsFingerprint) return { ok: false, reason: "MUTATED" };
    // When called from the engine (token undefined), skip token check —
    // the engine instance already proves authorization. When called from an
    // external API (token provided), enforce the stored hash match.
    if (token !== undefined) {
      const expectedHash = this.tokenHashById.get(req.id);
      if (expectedHash && hashToken(token) !== expectedHash) {
        return { ok: false, reason: "NOT_APPROVED" };
      }
    }
    req.state = "CONSUMED";
    return { ok: true };
  }

  get(id: string): ApprovalRequest | undefined {
    const req = this.byId.get(id);
    if (req) this.expireIfNeeded(req);
    return req;
  }

  list(): ApprovalRequest[] {
    return [...this.byId.values()].map((r) => {
      this.expireIfNeeded(r);
      return r;
    });
  }
}
