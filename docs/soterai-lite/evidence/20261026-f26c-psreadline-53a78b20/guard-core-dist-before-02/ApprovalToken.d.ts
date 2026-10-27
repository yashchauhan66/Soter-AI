import type { GuardAction } from "./types";
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
export interface CreateApprovalInput {
    sessionId: string;
    contentHash: string;
    decision: GuardAction;
    outcome?: ApprovalOutcome;
    scope: ApprovalScope;
    ttlMs?: number;
    now?: number;
    /** Disabling the repair withdraws issuance instead of accepting unchecked grants. */
    validityHardeningEnabled?: boolean;
}
export declare function createApprovalGrant(input: CreateApprovalInput): Promise<ApprovalGrant>;
export interface VerifyApprovalInput {
    sessionId: string;
    contentHash: string;
    now?: number;
    validityHardeningEnabled?: boolean;
}
/**
 * Is this grant currently valid for the given session + content? Enforces the
 * binding, the TTL, and single-use for the "once" scope. Never mutates the grant
 * (consumption is done by {@link ApprovalStore.consume}).
 */
export declare function isApprovalValid(grant: ApprovalGrant, input: VerifyApprovalInput): boolean;
/**
 * In-memory store of approval grants. The extension/broker own persistence; the
 * store guarantees only that no raw content is ever held — grants carry hashes.
 */
export declare class ApprovalStore {
    private grants;
    add(grant: ApprovalGrant): void;
    /** True if any live grant authorizes this session+content. */
    isApproved(sessionId: string, contentHash: string, now?: number): boolean;
    /**
     * Consume an approval for this session+content. For "once" grants this marks
     * the grant used (so it cannot be replayed). Returns true if consumed.
     */
    consume(sessionId: string, contentHash: string, now?: number): boolean;
    /** Remove expired/consumed grants; returns the number pruned. */
    prune(now?: number): number;
    list(now?: number): ApprovalGrantView[];
    clear(): void;
    get size(): number;
}
//# sourceMappingURL=ApprovalToken.d.ts.map