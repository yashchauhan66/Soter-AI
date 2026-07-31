/**
 * MCP Gateway — Session Manager
 *
 * Manages MCP sessions with tenant/project isolation, identity binding,
 * capability negotiation tracking, and session lifecycle.
 *
 * Key invariants:
 * - Every session is bound to exactly one tenant + project + client identity
 * - Cross-tenant access is rejected
 * - Expired or revoked identities are rejected
 * - Server identity changes are detected and rejected
 * - Negotiated capabilities are tracked and enforced
 */
import { randomUUID, createHash } from "crypto";
import type {
  MCPSession,
  MCPClientIdentity,
  MCPEndpoint,
  ServerCapabilities,
  ToolDefinition,
  MCPTransport,
} from "./MCPJsonRpcTypes";

export interface SessionManagerOptions {
  /** Default session TTL in milliseconds (default: 30 minutes). */
  sessionTtlMs?: number;
  /** Maximum concurrent sessions per tenant. */
  maxSessionsPerTenant?: number;
  /** Maximum concurrent sessions total. */
  maxSessionsTotal?: number;
  /** Cleanup interval in milliseconds (default: 60 seconds). */
  cleanupIntervalMs?: number;
}

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_SESSIONS_PER_TENANT = 100;
const DEFAULT_MAX_SESSIONS_TOTAL = 1000;
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

export class SessionManager {
  private sessions = new Map<string, MCPSession>();
  private readonly options: Required<SessionManagerOptions>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SessionManagerOptions = {}) {
    this.options = {
      sessionTtlMs: options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS,
      maxSessionsPerTenant: options.maxSessionsPerTenant ?? DEFAULT_MAX_SESSIONS_PER_TENANT,
      maxSessionsTotal: options.maxSessionsTotal ?? DEFAULT_MAX_SESSIONS_TOTAL,
      cleanupIntervalMs: options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS,
    };
  }

  /** Start the periodic cleanup timer. */
  start(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), this.options.cleanupIntervalMs);
    this.cleanupTimer.unref();
  }

  /** Stop the periodic cleanup timer. */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Create a new session bound to the given client identity and server endpoint.
   * Throws if tenant limits or total limits would be exceeded.
   */
  createSession(
    clientIdentity: MCPClientIdentity,
    serverEndpoint: MCPEndpoint,
  ): MCPSession {
    // Enforce total session limit
    if (this.sessions.size >= this.options.maxSessionsTotal) {
      throw new Error(`Maximum total sessions (${this.options.maxSessionsTotal}) reached`);
    }

    // Enforce per-tenant session limit
    const tenantSessions = this.getTenantSessions(clientIdentity.tenant);
    if (tenantSessions.length >= this.options.maxSessionsPerTenant) {
      throw new Error(
        `Maximum sessions for tenant "${clientIdentity.tenant}" (${this.options.maxSessionsPerTenant}) reached`,
      );
    }

    const now = Date.now();
    const session: MCPSession = {
      id: `mcp_sess_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      clientIdentity,
      serverEndpoint,
      state: "initializing",
      createdAt: now,
      expiresAt: now + this.options.sessionTtlMs,
      lastActivityAt: now,
      negotiatedCapabilities: new Set(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get a session by ID. Returns null if not found or expired.
   * Updates lastActivityAt on access.
   */
  getSession(sessionId: string): MCPSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check expiry
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update activity timestamp
    session.lastActivityAt = Date.now();
    return session;
  }

  /**
   * Update session state after successful initialization.
   * Records server capabilities and identity.
   */
  initializeSession(
    sessionId: string,
    serverCapabilities: ServerCapabilities,
    serverIdentity: string,
    protocolVersion: string,
  ): MCPSession | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.serverCapabilities = serverCapabilities;
    session.serverIdentity = serverIdentity;
    session.protocolVersion = protocolVersion;
    session.state = "active";

    // Track negotiated capabilities
    if (serverCapabilities.tools) session.negotiatedCapabilities.add("tools");
    if (serverCapabilities.resources) session.negotiatedCapabilities.add("resources");
    if (serverCapabilities.prompts) session.negotiatedCapabilities.add("prompts");
    if (serverCapabilities.logging) session.negotiatedCapabilities.add("logging");

    return session;
  }

  /**
   * Update the tool inventory for a session (from tools/list response).
   */
  setToolInventory(sessionId: string, tools: ToolDefinition[]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.toolInventory = tools;
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Get a tool definition from the session's inventory.
   */
  getToolDefinition(sessionId: string, toolName: string): ToolDefinition | undefined {
    const session = this.sessions.get(sessionId);
    return session?.toolInventory?.find((t) => t.name === toolName);
  }

  /**
   * Check if a tool is declared in the session's inventory.
   * Rejects undeclared tools.
   */
  isToolDeclared(sessionId: string, toolName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.toolInventory) return false;
    return session.toolInventory.some((t) => t.name === toolName);
  }

  /**
   * Verify that the server identity matches the one established during initialization.
   * Rejects server identity changes.
   */
  verifyServerIdentity(sessionId: string, serverIdentity: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.serverIdentity) return false;
    return session.serverIdentity === serverIdentity;
  }

  /**
   * Verify that the client identity matches the session binding.
   * Rejects cross-tenant access.
   */
  verifyClientIdentity(sessionId: string, clientIdentity: MCPClientIdentity): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Cross-tenant check
    if (session.clientIdentity.tenant !== clientIdentity.tenant) {
      return false;
    }

    // Project check
    if (session.clientIdentity.project !== clientIdentity.project) {
      return false;
    }

    // Client ID check
    if (session.clientIdentity.clientId !== clientIdentity.clientId) {
      return false;
    }

    return true;
  }

  /**
   * Check if a capability was negotiated during initialization.
   */
  hasCapability(sessionId: string, capability: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.negotiatedCapabilities.has(capability) ?? false;
  }

  /**
   * Close a session.
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.state = "closed";
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Extend session TTL.
   */
  extendSession(sessionId: string, ttlMs?: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.expiresAt = Date.now() + (ttlMs ?? this.options.sessionTtlMs);
    session.lastActivityAt = Date.now();
    return true;
  }

  /**
   * Get all sessions for a tenant.
   */
  getTenantSessions(tenant: string): MCPSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.clientIdentity.tenant === tenant,
    );
  }

  /**
   * Get all active sessions.
   */
  getActiveSessions(): MCPSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.state === "active");
  }

  /**
   * Get session count.
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * Remove expired sessions. Called periodically by the cleanup timer.
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Close all sessions (graceful shutdown).
   */
  closeAll(): number {
    const count = this.sessions.size;
    for (const session of this.sessions.values()) {
      session.state = "closed";
    }
    this.sessions.clear();
    return count;
  }

  /**
   * Compute a stable session fingerprint for evidence binding.
   */
  sessionFingerprint(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const canonical = JSON.stringify({
      id: session.id,
      tenant: session.clientIdentity.tenant,
      project: session.clientIdentity.project,
      clientId: session.clientIdentity.clientId,
      serverIdentity: session.serverIdentity,
      createdAt: session.createdAt,
    });
    return `sf_${createHash("sha256").update(canonical).digest("hex").slice(0, 12)}`;
  }
}
