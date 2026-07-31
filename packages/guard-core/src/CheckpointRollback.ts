import { containsRawSecret, redactForSharing } from "./Redactor";

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
    files: Array<{ path: string; contentHash: string; redactedPreview: string }>;
    createdAt: string;
}

export function previewTransaction(changes: PlannedChange[]): TransactionPreview {
    const filesModified = changes.filter((change) => change.kind === "modify" || change.kind === "create" || change.kind === "rename").length;
    const filesDeleted = changes.filter((change) => change.kind === "delete").length;
    const dependenciesInstalled = changes.filter((change) => change.kind === "dependency_install").map((change) => change.dependencyName ?? change.path);
    const securitySensitiveChanges = changes.filter((change) => change.securitySensitive || isSecuritySensitivePath(change.path)).map((change) => change.path);
    const rollbackAvailable = changes.every((change) => change.reversible !== false && change.kind !== "dependency_install");
    const reasons: string[] = [];

    if (filesDeleted > 0) reasons.push("Deletes files");
    if (dependenciesInstalled.length) reasons.push("Installs dependencies");
    if (securitySensitiveChanges.length) reasons.push("Touches security-sensitive paths");
    if (!rollbackAvailable) reasons.push("Not fully reversible");

    const recommendedAction =
        filesDeleted >= 20 || (dependenciesInstalled.length && securitySensitiveChanges.length)
            ? "DENY"
            : reasons.length
              ? "ASK"
              : "ALLOW";

    const summary = [
        `${changes.length} planned change(s)`,
        `${filesModified} file create/modify/rename operation(s)`,
        `${filesDeleted} deletion(s)`,
        `${dependenciesInstalled.length} dependency install(s)`,
        `${securitySensitiveChanges.length} security-sensitive change(s)`,
    ].join("; ");

    return {
        changeCount: changes.length,
        filesModified,
        filesDeleted,
        dependenciesInstalled,
        securitySensitiveChanges,
        requiresCheckpoint: recommendedAction !== "ALLOW",
        recommendedAction,
        reasons,
        rollbackAvailable,
        redactedSummary: redactForSharing(summary),
    };
}

export async function createInMemoryCheckpoint(id: string, files: CheckpointFile[], now = new Date().toISOString()): Promise<InMemoryCheckpoint> {
    return {
        id,
        createdAt: now,
        files: await Promise.all(files.map(async (file) => ({
            path: containsRawSecret(file.path) ? "[REDACTED_PATH]" : file.path,
            contentHash: await simpleHash(file.content),
            redactedPreview: redactForSharing(file.content).slice(0, 160),
        }))),
    };
}

// ─── Ownership-bound, integrity-protected checkpoint claims ─────────────────
//
// guard-core is deliberately I/O-free, so the pieces below are the PURE half of
// real checkpoint rollback: the record shape, the canonical payload, the HMAC
// integrity envelope, the ownership/expiry/idempotency claim validator, the
// restoration classifier, and the privacy-safe evidence builder. The half that
// touches a real reversible resource (a filesystem snapshot store) lives in the
// broker package, which owns node:fs. Both halves are exercised together by the
// broker's runtime checkpoint tests.

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

export type CheckpointClaimCode =
    | "OK"
    | "NOT_FOUND"
    | "INTEGRITY_FAILED"
    | "TENANT_MISMATCH"
    | "ACTOR_MISMATCH"
    | "ALREADY_ROLLED_BACK"
    | "EXPIRED";

export interface CheckpointClaimResult {
    ok: boolean;
    code: CheckpointClaimCode;
    reason: string;
}

function isSecuritySensitivePath(pathValue: string): boolean {
    const p = pathValue.replace(/\\/g, "/").toLowerCase();
    return p.includes("/auth/") || p.includes("/security/") || p.includes(".github/workflows/") || p.includes(".soterai/") || p.endsWith("package.json") || p.endsWith("package-lock.json");
}

async function simpleHash(text: string): Promise<string> {
    if (typeof globalThis.crypto?.subtle?.digest === "function") {
        const bytes = new TextEncoder().encode(text);
        const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash).toString(16).padStart(8, "0");
}

/** Content hash used for state fingerprinting. Exact bytes — no normalization. */
export async function hashProtectedState(text: string): Promise<string> {
    return simpleHash(text);
}

/**
 * The exact bytes the integrity HMAC covers. Deterministic field order, so a
 * record that round-trips through JSON storage re-verifies byte-identically.
 * `status` is excluded: rollback legitimately mutates it, and ownership/scope/
 * state — the security-relevant parts — must stay frozen.
 */
export function canonicalCheckpointPayload(record: Omit<CheckpointRecord, "integrity" | "status">): string {
    // Explicit length-prefixed fields: bare concatenation would let two different
    // records canonicalize to the same string and therefore share one valid HMAC.
    const field = (value: string) => value.length + ":" + value;
    const files = [...record.files]
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((file) => [field(file.path), field(file.contentHash), field(String(file.size)), file.existed ? "1" : "0"].join("|"));
    const effects = [...record.sideEffects]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((effect) => [field(effect.id), field(effect.kind), effect.reversible ? "1" : "0", field(effect.compensatingAction ?? "")].join("|"));
    return [
        "checkpoint.v1",
        field(record.id),
        field(record.owner.tenantId),
        field(record.owner.actorId),
        field(record.scopeRoot),
        field(record.createdAt),
        field(record.expiresAt),
        field(files.join(";")),
        field(effects.join(";")),
    ].join("\n");
}

function getSubtle(): any {
    const subtle = (globalThis as any).crypto?.subtle;
    if (!subtle) throw new Error("Checkpoint integrity requires WebCrypto (globalThis.crypto.subtle), which is unavailable here.");
    return subtle;
}

async function hmac(payload: string, secret: string): Promise<string> {
    const key = await getSubtle().importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await getSubtle().sign("HMAC", key, new TextEncoder().encode(payload));
    return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sign a checkpoint's canonical payload. The secret never leaves the host process. */
export async function signCheckpoint(record: Omit<CheckpointRecord, "integrity" | "status">, secret: string): Promise<string> {
    return hmac(canonicalCheckpointPayload(record), secret);
}

/** Constant-time-ish comparison; guard-core cannot import node:crypto.timingSafeEqual. */
function equalHex(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/** Recompute the HMAC and compare. `false` means the stored record was altered. */
export async function verifyCheckpointIntegrity(record: CheckpointRecord, secret: string): Promise<boolean> {
    const expected = await signCheckpoint(record, secret);
    return equalHex(expected, record.integrity);
}

/**
 * Ownership + integrity + expiry + idempotency gate for a rollback request.
 * Order matters: integrity is checked BEFORE ownership so that a record whose
 * tenant/actor fields were rewritten fails as tampering rather than as a
 * mismatch, and an already-rolled-back checkpoint short-circuits so a repeated
 * request is idempotent instead of restoring twice.
 */
export async function validateCheckpointClaim(
    record: CheckpointRecord | undefined,
    requester: CheckpointOwner,
    secret: string,
    now: Date = new Date(),
): Promise<CheckpointClaimResult> {
    if (!record) return { ok: false, code: "NOT_FOUND", reason: "No checkpoint exists for that id." };
    if (!(await verifyCheckpointIntegrity(record, secret))) {
        return { ok: false, code: "INTEGRITY_FAILED", reason: "Checkpoint integrity check failed; the stored record was modified." };
    }
    if (record.owner.tenantId !== requester.tenantId) {
        return { ok: false, code: "TENANT_MISMATCH", reason: "Checkpoint belongs to a different tenant." };
    }
    if (record.owner.actorId !== requester.actorId) {
        return { ok: false, code: "ACTOR_MISMATCH", reason: "Checkpoint belongs to a different actor." };
    }
    if (record.status === "ROLLED_BACK") {
        return { ok: false, code: "ALREADY_ROLLED_BACK", reason: "Checkpoint was already rolled back; nothing further to restore." };
    }
    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
        return { ok: false, code: "EXPIRED", reason: "Checkpoint rollback window has expired; require manual compensating review." };
    }
    return { ok: true, code: "OK", reason: "Checkpoint claim is valid for rollback." };
}

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
export function classifyRestoration(record: Pick<CheckpointRecord, "files" | "sideEffects">): RestorationClassification {
    const irreversible = record.sideEffects.filter((effect) => !effect.reversible);
    const compensatingActions = irreversible.map((effect) => effect.compensatingAction ?? `manual_review:${effect.kind}`);
    if (irreversible.length === 0) {
        return {
            classification: "EXACT_RESTORE",
            exactlyRestorable: true,
            compensatingActions: [],
            reason: "All captured state is byte-restorable and no irreversible side effect was recorded.",
        };
    }
    if (record.files.length === 0) {
        return {
            classification: "COMPENSATING_ACTION_ONLY",
            exactlyRestorable: false,
            compensatingActions,
            reason: "No restorable state was captured; only compensating actions can address the recorded effects.",
        };
    }
    return {
        classification: "PARTIAL_RESTORE_WITH_COMPENSATION",
        exactlyRestorable: false,
        compensatingActions,
        reason: "Captured files are restorable, but recorded side effects require compensating actions.",
    };
}

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
export async function buildRollbackEvidence(input: {
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
}): Promise<RollbackEvidence> {
    const pathDigests = await Promise.all(input.paths.map(async (path) => (await simpleHash(path)).slice(0, 16)));
    return {
        checkpointId: input.checkpointId,
        tenantId: input.owner.tenantId,
        actorId: input.owner.actorId,
        outcome: input.outcome,
        code: input.code,
        classification: input.classification,
        filesRestored: input.filesRestored,
        filesDeleted: input.filesDeleted,
        pathDigests: pathDigests.sort(),
        stateVerified: input.stateVerified,
        compensatingActions: input.compensatingActions,
        completedAt: input.now ?? new Date().toISOString(),
        reason: redactForSharing(input.reason),
    };
}
