import type { GuardAction } from "./types";
import { hashContent } from "./HashCache";

/**
 * Local approval workflow for the AI Context Firewall and Local AI Broker.
 *
 * An approval grant is bound to `sessionId + contentHash + decision`. It is:
 *   - short-lived (TTL by scope),
 *   - NOT reusable for different content (contentHash must match),
 *   - single-use for the "once" scope,
 *   - stored locally only (never contains raw content).
 *
 * This lets a `approval_required` decision be unblocked deliberately by the user
 * without ever weakening protection for other/changed content.
 */

export type ApprovalScope = "once" | "session" | "workspace";
export type ApprovalOutcome = "approve" | "deny" | "redact_and_allow";

export interface ApprovalGrant {
    id: string;
    /** Opaque token safe to store/show — derived, carries no raw content. */
    token: string;
    sessionId: string;
    contentHash: string;
    decision: GuardAction;
    outcome: ApprovalOutcome;
    scope: ApprovalScope;
    createdAt: number;
    expiresAt: number;
    consumed: boolean;
}

/** Persist/display-safe view of a grant (no functional difference — already safe). */
export interface ApprovalGrantView {
    id: string;
    sessionId: string;
    contentHash: string;
    decision: GuardAction;
    outcome: ApprovalOutcome;
    scope: ApprovalScope;
    createdAt: number;
    expiresAt: number;
    consumed: boolean;
    expired: boolean;
}

const SCOPE_TTL_MS: Record<ApprovalScope, number> = {
    once: 5 * 60_000, // 5 min
    session: 30 * 60_000, // 30 min
    workspace: 8 * 60 * 60_000, // 8 h
};

export interface CreateApprovalInput {
    sessionId: string;
    contentHash: string;
    decision: GuardAction;
    outcome?: ApprovalOutcome;
    scope: ApprovalScope;
    ttlMs?: number;
    now?: number;
}

export async function createApprovalGrant(input: CreateApprovalInput): Promise<ApprovalGrant> {
    const now = input.now ?? Date.now();
    const ttl = input.ttlMs ?? SCOPE_TTL_MS[input.scope];
    const outcome = input.outcome ?? "approve";
    // Token binds the identity fields plus a nonce so it cannot be guessed from
    // the (hashed) content alone.
    const nonce = randomHex(12);
    const token = await hashContent(
        `${input.sessionId}|${input.contentHash}|${input.decision}|${outcome}|${now}|${nonce}`,
    );
    return {
        id: `apr_${token.slice(0, 12)}`,
        token,
        sessionId: input.sessionId,
        contentHash: input.contentHash,
        decision: input.decision,
        outcome,
        scope: input.scope,
        createdAt: now,
        expiresAt: now + ttl,
        consumed: false,
    };
}

export interface VerifyApprovalInput {
    sessionId: string;
    contentHash: string;
    now?: number;
}

/**
 * Is this grant currently valid for the given session + content? Enforces the
 * binding, the TTL, and single-use for the "once" scope. Never mutates the grant
 * (consumption is done by {@link ApprovalStore.consume}).
 */
export function isApprovalValid(grant: ApprovalGrant, input: VerifyApprovalInput): boolean {
    const now = input.now ?? Date.now();
    if (grant.outcome === "deny") return false;
    if (grant.consumed) return false;
    if (now > grant.expiresAt) return false;
    if (grant.sessionId !== input.sessionId) return false;
    // Hard binding: an approval for one payload must never unlock a different one.
    if (grant.contentHash !== input.contentHash) return false;
    return true;
}

function toView(g: ApprovalGrant, now: number): ApprovalGrantView {
    return {
        id: g.id,
        sessionId: g.sessionId,
        contentHash: g.contentHash,
        decision: g.decision,
        outcome: g.outcome,
        scope: g.scope,
        createdAt: g.createdAt,
        expiresAt: g.expiresAt,
        consumed: g.consumed,
        expired: now > g.expiresAt,
    };
}

/**
 * In-memory store of approval grants. The extension/broker own persistence; the
 * store guarantees only that no raw content is ever held — grants carry hashes.
 */
export class ApprovalStore {
    private grants = new Map<string, ApprovalGrant>();

    add(grant: ApprovalGrant): void {
        this.grants.set(grant.id, grant);
    }

    /** True if any live grant authorizes this session+content. */
    isApproved(sessionId: string, contentHash: string, now = Date.now()): boolean {
        for (const g of this.grants.values()) {
            if (isApprovalValid(g, { sessionId, contentHash, now })) return true;
        }
        return false;
    }

    /**
     * Consume an approval for this session+content. For "once" grants this marks
     * the grant used (so it cannot be replayed). Returns true if consumed.
     */
    consume(sessionId: string, contentHash: string, now = Date.now()): boolean {
        for (const g of this.grants.values()) {
            if (isApprovalValid(g, { sessionId, contentHash, now })) {
                if (g.scope === "once") g.consumed = true;
                return true;
            }
        }
        return false;
    }

    /** Remove expired/consumed grants; returns the number pruned. */
    prune(now = Date.now()): number {
        let n = 0;
        for (const [id, g] of this.grants) {
            if (now > g.expiresAt || (g.scope === "once" && g.consumed)) {
                this.grants.delete(id);
                n++;
            }
        }
        return n;
    }

    list(now = Date.now()): ApprovalGrantView[] {
        return [...this.grants.values()].map((g) => toView(g, now));
    }

    clear(): void {
        this.grants.clear();
    }

    get size(): number {
        return this.grants.size;
    }
}

function randomHex(bytes: number): string {
    const arr = new Uint8Array(bytes);
    const g = (globalThis as any).crypto;
    if (g?.getRandomValues) g.getRandomValues(arr);
    else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
