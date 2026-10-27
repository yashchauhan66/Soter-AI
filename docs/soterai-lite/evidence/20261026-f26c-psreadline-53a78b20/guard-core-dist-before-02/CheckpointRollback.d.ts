export type ChangeKind = "create" | "modify" | "delete" | "rename" | "dependency_install" | "policy_change";
export interface PlannedChange {
    path: string;
    kind: ChangeKind;
    beforeHash?: string;
    afterHash?: string;
    reversible?: boolean;
    securitySensitive?: boolean;
    dependencyName?: string;
}
export interface TransactionPreview {
    changeCount: number;
    filesModified: number;
    filesDeleted: number;
    dependenciesInstalled: string[];
    securitySensitiveChanges: string[];
    requiresCheckpoint: boolean;
    recommendedAction: "ALLOW" | "ASK" | "DENY";
    reasons: string[];
    rollbackAvailable: boolean;
    redactedSummary: string;
}
export interface CheckpointFile {
    path: string;
    content: string;
}
export interface InMemoryCheckpoint {
    id: string;
    files: Array<{
        path: string;
        contentHash: string;
        redactedPreview: string;
    }>;
    createdAt: string;
}
export declare function previewTransaction(changes: PlannedChange[]): TransactionPreview;
export declare function createInMemoryCheckpoint(id: string, files: CheckpointFile[], now?: string): Promise<InMemoryCheckpoint>;
/** The tenant + actor tuple a checkpoint is bound to at creation. */
export interface CheckpointOwner {
    tenantId: string;
    actorId: string;
}
/** Fingerprint of one protected path at checkpoint time. `existed: false` records an absent path. */
export interface CheckpointFileState {
    path: string;
    contentHash: string;
    size: number;
    existed: boolean;
}
/** A declared effect that a filesystem restore cannot undo (e.g. an email already sent). */
export interface CheckpointSideEffect {
    id: string;
    kind: string;
    reversible: boolean;
    compensatingAction?: string;
}
export type CheckpointStatus = "OPEN" | "ROLLED_BACK" | "FAILED";
export interface CheckpointRecord {
    id: string;
    owner: CheckpointOwner;
    /** Isolation boundary: every protected path must resolve inside this root. */
    scopeRoot: string;
    createdAt: string;
    expiresAt: string;
    files: CheckpointFileState[];
    sideEffects: CheckpointSideEffect[];
    status: CheckpointStatus;
    /** HMAC-SHA256 over {@link canonicalCheckpointPayload}. Detects tampering. */
    integrity: string;
}
export type CheckpointClaimCode = "OK" | "NOT_FOUND" | "INTEGRITY_FAILED" | "TENANT_MISMATCH" | "ACTOR_MISMATCH" | "ALREADY_ROLLED_BACK" | "EXPIRED";
export interface CheckpointClaimResult {
    ok: boolean;
    code: CheckpointClaimCode;
    reason: string;
}
/** Content hash used for state fingerprinting. Exact bytes — no normalization. */
export declare function hashProtectedState(text: string): Promise<string>;
/**
 * The exact bytes the integrity HMAC covers. Deterministic field order, so a
 * record that round-trips through JSON storage re-verifies byte-identically.
 * `status` is excluded: rollback legitimately mutates it, and ownership/scope/
 * state — the security-relevant parts — must stay frozen.
 */
export declare function canonicalCheckpointPayload(record: Omit<CheckpointRecord, "integrity" | "status">): string;
/** Sign a checkpoint's canonical payload. The secret never leaves the host process. */
export declare function signCheckpoint(record: Omit<CheckpointRecord, "integrity" | "status">, secret: string): Promise<string>;
/** Recompute the HMAC and compare. `false` means the stored record was altered. */
export declare function verifyCheckpointIntegrity(record: CheckpointRecord, secret: string): Promise<boolean>;
/**
 * Ownership + integrity + expiry + idempotency gate for a rollback request.
 * Order matters: integrity is checked BEFORE ownership so that a record whose
 * tenant/actor fields were rewritten fails as tampering rather than as a
 * mismatch, and an already-rolled-back checkpoint short-circuits so a repeated
 * request is idempotent instead of restoring twice.
 */
export declare function validateCheckpointClaim(record: CheckpointRecord | undefined, requester: CheckpointOwner, secret: string, now?: Date): Promise<CheckpointClaimResult>;
export type RestorationClass = "EXACT_RESTORE" | "COMPENSATING_ACTION_ONLY" | "PARTIAL_RESTORE_WITH_COMPENSATION";
export interface RestorationClassification {
    classification: RestorationClass;
    exactlyRestorable: boolean;
    compensatingActions: string[];
    reason: string;
}
/**
 * Whether the captured state can be put back byte-for-byte, or whether some
 * effect can only be compensated for. A checkpoint with no reversible file
 * state and at least one irreversible side effect is COMPENSATING_ACTION_ONLY.
 */
export declare function classifyRestoration(record: Pick<CheckpointRecord, "files" | "sideEffects">): RestorationClassification;
export interface RollbackEvidence {
    checkpointId: string;
    tenantId: string;
    actorId: string;
    outcome: "RESTORED" | "REJECTED" | "FAILED";
    code: CheckpointClaimCode | "RESTORE_FAILED";
    classification: RestorationClass;
    filesRestored: number;
    filesDeleted: number;
    /** Path-shaped digests only. Never a path, never a byte of protected content. */
    pathDigests: string[];
    stateVerified: boolean;
    compensatingActions: string[];
    completedAt: string;
    reason: string;
}
/**
 * Build the emitted evidence. Paths are replaced with truncated digests and no
 * file content or preview is included, so the audit record cannot leak protected
 * state even when the protected state was itself a secret.
 */
export declare function buildRollbackEvidence(input: {
    checkpointId: string;
    owner: CheckpointOwner;
    outcome: RollbackEvidence["outcome"];
    code: RollbackEvidence["code"];
    classification: RestorationClass;
    paths: string[];
    filesRestored: number;
    filesDeleted: number;
    stateVerified: boolean;
    compensatingActions: string[];
    reason: string;
    now?: string;
}): Promise<RollbackEvidence>;
//# sourceMappingURL=CheckpointRollback.d.ts.map