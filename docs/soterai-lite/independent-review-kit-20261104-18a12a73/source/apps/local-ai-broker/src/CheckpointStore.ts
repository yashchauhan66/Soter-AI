/**
 * FilesystemCheckpointStore — the REAL reversible resource adapter behind
 * checkpoint rollback.
 *
 * guard-core owns the pure half (record shape, canonical payload, HMAC
 * integrity, ownership/expiry/idempotency claim validation, restoration
 * classification, privacy-safe evidence). This file owns the half that touches
 * a real resource: it snapshots bytes from an isolated filesystem root, lets a
 * caller mutate that root for real, and then puts the exact original bytes back.
 *
 * Isolation guarantees:
 *   - every protected path must resolve INSIDE `root` (traversal and absolute
 *     escapes are rejected before any read),
 *   - snapshot bytes are written to `snapshotRoot`, which must NOT be inside
 *     `root` (otherwise a restore would clobber its own snapshot),
 *   - no protected content, and no protected path, ever reaches a log line or
 *     an evidence record — only truncated path digests.
 */

import { mkdir, readFile, rm, stat, writeFile, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import {
    buildRollbackEvidence,
    classifyRestoration,
    hashProtectedState,
    signCheckpoint,
    validateCheckpointClaim,
    type CheckpointOwner,
    type CheckpointRecord,
    type CheckpointSideEffect,
    type RollbackEvidence,
} from "@soterai/guard-core";

export const DEFAULT_CHECKPOINT_TTL_MS = 15 * 60 * 1000;

export interface FilesystemCheckpointStoreOptions {
    /** Isolation boundary. Every protected path must resolve inside this directory. */
    root: string;
    /** Where snapshot bytes live. Must be outside `root`. */
    snapshotRoot: string;
    /** HMAC secret for record integrity. Never leaves this process. */
    secret: string;
    ttlMs?: number;
    /** Injectable write, so a restore failure can be exercised without corrupting a real disk. */
    writeImpl?: (path: string, data: Buffer) => Promise<void>;
    logger?: (message: string, metadata?: Record<string, unknown>) => void;
}

export interface CreateCheckpointInput {
    owner: CheckpointOwner;
    /** Paths relative to `root` (or absolute paths inside it). */
    paths: string[];
    sideEffects?: CheckpointSideEffect[];
    id?: string;
    now?: Date;
    ttlMs?: number;
}

export interface RollbackResult {
    ok: boolean;
    evidence: RollbackEvidence;
}

interface Snapshot {
    /** Absolute path of the protected file. Kept in memory only. */
    absolutePath: string;
    /** Absolute path of the snapshot blob, or null when the file did not exist. */
    blobPath: string | null;
    existed: boolean;
}

export class CheckpointScopeError extends Error {
    readonly code = "CHECKPOINT_OUT_OF_SCOPE";
}

export class FilesystemCheckpointStore {
    private readonly root: string;
    private readonly snapshotRoot: string;
    private readonly ttlMs: number;
    private readonly records = new Map<string, CheckpointRecord>();
    private readonly snapshots = new Map<string, Snapshot[]>();
    /** Serializes rollback per checkpoint id so concurrent requests cannot both restore. */
    private readonly inFlight = new Map<string, Promise<RollbackResult>>();

    constructor(private readonly options: FilesystemCheckpointStoreOptions) {
        this.root = resolve(options.root);
        this.snapshotRoot = resolve(options.snapshotRoot);
        if (this.snapshotRoot === this.root || isInside(this.root, this.snapshotRoot)) {
            throw new CheckpointScopeError("snapshotRoot must be outside the protected root");
        }
        if (!options.secret || options.secret.length < 32) {
            throw new Error("A checkpoint integrity secret of at least 32 characters is required");
        }
        this.ttlMs = options.ttlMs ?? DEFAULT_CHECKPOINT_TTL_MS;
    }

    /** Resolve a caller-supplied path and refuse anything outside the isolation root. */
    resolveProtectedPath(candidate: string): string {
        const absolute = isAbsolute(candidate) ? resolve(candidate) : resolve(this.root, candidate);
        if (absolute !== this.root && !isInside(this.root, absolute)) {
            throw new CheckpointScopeError("Protected path resolves outside the checkpoint isolation root");
        }
        return absolute;
    }

    /**
     * Fingerprint the protected state and snapshot its exact bytes. Returns the
     * signed record; the caller may then mutate the root for real.
     */
    async createCheckpoint(input: CreateCheckpointInput): Promise<CheckpointRecord> {
        const id = input.id ?? `ckpt_${randomUUID()}`;
        if (this.records.has(id)) throw new Error("Checkpoint id already exists");
        const createdAt = input.now ?? new Date();
        const ttl = input.ttlMs ?? this.ttlMs;
        const blobDir = join(this.snapshotRoot, id);
        await mkdir(blobDir, { recursive: true });

        const snapshots: Snapshot[] = [];
        const files = [] as CheckpointRecord["files"];
        let index = 0;
        for (const candidate of input.paths) {
            const absolute = this.resolveProtectedPath(candidate);
            const existing = await readIfPresent(absolute);
            const relPath = toPosix(relative(this.root, absolute));
            if (existing === null) {
                snapshots.push({ absolutePath: absolute, blobPath: null, existed: false });
                files.push({ path: relPath, contentHash: "", size: 0, existed: false });
            } else {
                const blobPath = join(blobDir, `${index}.bin`);
                await writeFile(blobPath, existing);
                snapshots.push({ absolutePath: absolute, blobPath, existed: true });
                files.push({
                    path: relPath,
                    contentHash: await hashProtectedState(existing.toString("utf8")),
                    size: existing.byteLength,
                    existed: true,
                });
            }
            index += 1;
        }

        const unsigned = {
            id,
            owner: { tenantId: input.owner.tenantId, actorId: input.owner.actorId },
            scopeRoot: toPosix(this.root),
            createdAt: createdAt.toISOString(),
            expiresAt: new Date(createdAt.getTime() + ttl).toISOString(),
            files,
            sideEffects: input.sideEffects ?? [],
        };
        const record: CheckpointRecord = {
            ...unsigned,
            status: "OPEN",
            integrity: await signCheckpoint(unsigned, this.options.secret),
        };
        this.records.set(id, record);
        this.snapshots.set(id, snapshots);
        this.log("checkpoint_created", { checkpointId: id, fileCount: files.length });
        return record;
    }

    get(id: string): CheckpointRecord | undefined {
        return this.records.get(id);
    }

    /**
     * TEST/ADMIN SEAM: replace a stored record without re-signing it. Used to
     * prove the integrity check actually fires on a tampered record.
     */
    overwriteRecordUnsafe(record: CheckpointRecord): void {
        this.records.set(record.id, record);
    }

    /** Re-read the current on-disk state of a protected path (for change verification). */
    async readProtected(candidate: string): Promise<string | null> {
        const buffer = await readIfPresent(this.resolveProtectedPath(candidate));
        return buffer === null ? null : buffer.toString("utf8");
    }

    /**
     * Validate the claim, restore exact bytes, verify restoration, emit evidence.
     * Concurrent calls for the same checkpoint are serialized: exactly one
     * performs the restore, the other observes ALREADY_ROLLED_BACK.
     */
    async rollback(checkpointId: string, requester: CheckpointOwner, now: Date = new Date()): Promise<RollbackResult> {
        const pending = this.inFlight.get(checkpointId);
        if (pending) {
            await pending.catch(() => undefined);
        }
        const run = this.performRollback(checkpointId, requester, now);
        this.inFlight.set(checkpointId, run);
        try {
            return await run;
        } finally {
            if (this.inFlight.get(checkpointId) === run) this.inFlight.delete(checkpointId);
        }
    }

    private async performRollback(checkpointId: string, requester: CheckpointOwner, now: Date): Promise<RollbackResult> {
        const record = this.records.get(checkpointId);
        const claim = await validateCheckpointClaim(record, requester, this.options.secret, now);
        const classification = classifyRestoration(record ?? { files: [], sideEffects: [] });

        if (!claim.ok || !record) {
            const evidence = await buildRollbackEvidence({
                checkpointId,
                owner: requester,
                outcome: "REJECTED",
                code: claim.code,
                classification: classification.classification,
                paths: [],
                filesRestored: 0,
                filesDeleted: 0,
                stateVerified: false,
                compensatingActions: claim.code === "EXPIRED" ? ["manual_compensating_review"] : classification.compensatingActions,
                reason: claim.reason,
                now: now.toISOString(),
            });
            this.log("checkpoint_rollback_rejected", { checkpointId, code: claim.code });
            return { ok: false, evidence };
        }

        const snapshots = this.snapshots.get(checkpointId) ?? [];
        const write = this.options.writeImpl ?? ((path: string, data: Buffer) => writeFile(path, data));
        let restored = 0;
        let deleted = 0;
        try {
            for (const snapshot of snapshots) {
                if (snapshot.existed && snapshot.blobPath) {
                    await write(snapshot.absolutePath, await readFile(snapshot.blobPath));
                    restored += 1;
                } else {
                    await removeIfPresent(snapshot.absolutePath);
                    deleted += 1;
                }
            }
        } catch (error) {
            this.records.set(checkpointId, { ...record, status: "FAILED" });
            const evidence = await buildRollbackEvidence({
                checkpointId,
                owner: requester,
                outcome: "FAILED",
                code: "RESTORE_FAILED",
                classification: classification.classification,
                paths: record.files.map((file) => file.path),
                filesRestored: restored,
                filesDeleted: deleted,
                stateVerified: false,
                compensatingActions: [...classification.compensatingActions, "manual_compensating_review"],
                reason: `Restore failed after ${restored} restored and ${deleted} removed path(s): ${errorCode(error)}`,
                now: now.toISOString(),
            });
            this.log("checkpoint_rollback_failed", { checkpointId, restored, deleted });
            return { ok: false, evidence };
        }

        // Verify EXACT restoration by re-fingerprinting the live filesystem.
        let stateVerified = true;
        for (const file of record.files) {
            const absolute = resolve(this.root, file.path);
            const current = await readIfPresent(absolute);
            if (!file.existed) {
                if (current !== null) stateVerified = false;
                continue;
            }
            if (current === null || (await hashProtectedState(current.toString("utf8"))) !== file.contentHash || current.byteLength !== file.size) {
                stateVerified = false;
            }
        }

        this.records.set(checkpointId, { ...record, status: "ROLLED_BACK" });
        const evidence = await buildRollbackEvidence({
            checkpointId,
            owner: requester,
            outcome: stateVerified ? "RESTORED" : "FAILED",
            code: stateVerified ? "OK" : "RESTORE_FAILED",
            classification: classification.classification,
            paths: record.files.map((file) => file.path),
            filesRestored: restored,
            filesDeleted: deleted,
            stateVerified,
            compensatingActions: classification.compensatingActions,
            reason: stateVerified
                ? `Exact restoration verified for ${record.files.length} protected path(s).`
                : "Restore completed but re-fingerprinting did not match the checkpoint.",
            now: now.toISOString(),
        });
        this.log("checkpoint_rollback_completed", { checkpointId, restored, deleted, stateVerified });
        return { ok: stateVerified, evidence };
    }

    /** Delete every snapshot blob for a checkpoint. Records stay for audit/idempotency. */
    async discardSnapshots(checkpointId: string): Promise<void> {
        this.snapshots.delete(checkpointId);
        await rm(join(this.snapshotRoot, checkpointId), { recursive: true, force: true });
    }

    private log(message: string, metadata?: Record<string, unknown>): void {
        this.options.logger?.(message, metadata);
    }
}

function toPosix(value: string): string {
    return value.split(sep).join("/");
}

function isInside(parent: string, child: string): boolean {
    const rel = relative(parent, child);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

async function readIfPresent(path: string): Promise<Buffer | null> {
    try {
        const info = await stat(path);
        if (!info.isFile()) return null;
        return await readFile(path);
    } catch (error) {
        if (isMissing(error)) return null;
        throw error;
    }
}

async function removeIfPresent(path: string): Promise<void> {
    try {
        await unlink(path);
    } catch (error) {
        if (!isMissing(error)) throw error;
    }
}

function isMissing(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as { code?: string }).code === "ENOENT";
}

function errorCode(error: unknown): string {
    if (typeof error === "object" && error !== null) {
        const code = (error as { code?: string }).code;
        if (code) return String(code);
    }
    return "restore_error";
}
