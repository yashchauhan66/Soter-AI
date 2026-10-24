import { createHash, randomBytes } from "crypto";
import { type BrokerOperation, type SecretFinding, type SecretRefMetadata, type SecretRefRecord } from "./types";

export interface SecretValueStore {
    get(id: string): Promise<string | undefined>;
    set(id: string, value: string): Promise<void>;
    delete(id: string): Promise<void>;
    clear?(): Promise<void>;
}

export class MemorySecretValueStore implements SecretValueStore {
    private readonly values = new Map<string, string>();

    async get(id: string): Promise<string | undefined> {
        return this.values.get(id);
    }

    async set(id: string, value: string): Promise<void> {
        this.values.set(id, value);
    }

    async delete(id: string): Promise<void> {
        this.values.delete(id);
    }

    async clear(): Promise<void> {
        this.values.clear();
    }
}

export interface CreateSecretRefInput {
    finding: SecretFinding;
    workspace: string;
    ttlMs: number;
    oneTime?: boolean;
    userApprovalState?: SecretRefMetadata["userApprovalState"];
}

export interface SecretReferenceOptions {
    /** Runtime withdrawal switch; tests may use the isolated memory default. */
    enabled?: () => boolean;
}

export const MAX_SECRET_REFERENCE_TTL_MS = 24 * 60 * 60 * 1000;

export class SecretReferenceManager {
    private readonly records = new Map<string, Omit<SecretRefRecord, "value">>();
    private readonly usedReferences = new WeakMap<SecretRefRecord, Omit<SecretRefRecord, "value">>();
    private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(
        private readonly store: SecretValueStore = new MemorySecretValueStore(),
        private readonly options: SecretReferenceOptions = {},
    ) {}

    async create(input: CreateSecretRefInput): Promise<SecretRefMetadata> {
        this.requireEnabled();
        if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0 || input.ttlMs > MAX_SECRET_REFERENCE_TTL_MS) {
            throw new Error("Secret reference lifetime must be positive, finite and no longer than 24 hours.");
        }
        const id = this.newId();
        const ref = `soterai://secret/${input.finding.type}/${id}`;
        const created = Date.now();
        const record: Omit<SecretRefRecord, "value"> = {
            id,
            ref,
            type: input.finding.type,
            source: input.finding.source ?? "unknown",
            hash: this.hash(input.finding.value),
            workspace: input.workspace,
            createdAt: new Date(created).toISOString(),
            expiresAt: new Date(created + input.ttlMs).toISOString(),
            ttlMs: input.ttlMs,
            allowedOperations: [...input.finding.allowedOperations],
            sensitivity: input.finding.sensitivity,
            userApprovalState: input.userApprovalState ?? "not_required",
            oneTime: input.oneTime ?? false,
            revoked: false,
            useCount: 0,
        };
        this.records.set(ref, record);
        try {
            await this.store.set(id, input.finding.value);
            this.requireEnabled();
            if (record.revoked || this.records.get(ref) !== record || Date.now() >= Date.parse(record.expiresAt)) {
                throw new Error("Secret reference was withdrawn before storage completed.");
            }
        } catch (error) {
            record.revoked = true;
            this.records.delete(ref);
            // A failed store may already have written its recovery inventory.
            // Preserve the original failure; the store retains that cleanup ID.
            await this.store.delete(id).catch(() => {});
            throw error;
        }
        const timer = setTimeout(() => {
            // Marking revoked is synchronous; a deletion failure keeps the ID
            // in the persistent inventory for a later recovery attempt.
            void this.revoke(ref).catch(() => {});
        }, Math.max(1, Date.parse(record.expiresAt) - Date.now()));
        timer.unref();
        this.expiryTimers.set(ref, timer);
        return { ...record, allowedOperations: [...record.allowedOperations] };
    }

    async lookup(ref: string, workspace: string, operation?: BrokerOperation): Promise<SecretRefRecord | undefined> {
        this.requireEnabled();
        const record = this.records.get(ref);
        if (!record || record.revoked || record.workspace !== workspace) return undefined;
        if (Date.now() >= Date.parse(record.expiresAt)) {
            await this.revoke(ref);
            return undefined;
        }
        if (operation && !record.allowedOperations.includes(operation)) return undefined;
        if (record.oneTime && record.useCount > 0) return undefined;
        // Claim the use BEFORE the async store read so two concurrent lookups
        // cannot both pass the one-time check (TOCTOU).
        record.useCount += 1;
        const value = await this.store.get(record.id);
        this.requireEnabled();
        if (Date.now() >= Date.parse(record.expiresAt) && !record.revoked) await this.revoke(ref);
        if (!value || record.revoked || this.records.get(ref) !== record) return undefined;
        const resolved = { ...record, allowedOperations: [...record.allowedOperations], value };
        this.usedReferences.set(resolved, record);
        return resolved;
    }

    /** Recheck an already claimed use without consuming another one-time use.
     * This local lease is not an independent process or user identity boundary. */
    async revalidateUsedReference(resolved: SecretRefRecord, workspace: string, operation?: BrokerOperation): Promise<boolean> {
        this.requireEnabled();
        const record = this.usedReferences.get(resolved);
        const current = () => !!record && !record.revoked && this.records.get(record.ref) === record
            && record.workspace === workspace && Date.now() < Date.parse(record.expiresAt)
            && (!operation || record.allowedOperations.includes(operation));
        if (!record || !current()) return false;
        const value = await this.store.get(record.id);
        this.requireEnabled();
        return current() && !!value && value === resolved.value && this.hash(value) === record.hash;
    }

    metadata(ref: string): SecretRefMetadata | undefined {
        const record = this.records.get(ref);
        return record ? { ...record, allowedOperations: [...record.allowedOperations] } : undefined;
    }

    list(workspace?: string): SecretRefMetadata[] {
        return [...this.records.values()]
            .filter((record) => !workspace || record.workspace === workspace)
            .map((record) => ({ ...record, allowedOperations: [...record.allowedOperations] }));
    }

    async revoke(ref: string): Promise<boolean> {
        const record = this.records.get(ref);
        if (!record) return false;
        record.revoked = true;
        this.clearExpiryTimer(ref);
        await this.store.delete(record.id);
        return true;
    }

    async clear(workspace?: string): Promise<void> {
        const targets = [...this.records].filter(([, record]) => !workspace || record.workspace === workspace);
        // Revoke all affected authority before any async storage deletion.
        for (const [ref, record] of targets) {
            record.revoked = true;
            this.clearExpiryTimer(ref);
            this.records.delete(ref);
        }
        for (const [, record] of targets) await this.store.delete(record.id);
        if (!workspace && this.store.clear) await this.store.clear();
    }

    serializeMetadata(): string {
        return JSON.stringify(this.list());
    }

    private requireEnabled(): void {
        if (this.options.enabled && !this.options.enabled()) {
            throw new Error("Secret reference operations are unavailable while inventory protection is disabled.");
        }
    }

    private clearExpiryTimer(ref: string): void {
        const timer = this.expiryTimers.get(ref);
        if (timer) clearTimeout(timer);
        this.expiryTimers.delete(ref);
    }

    private newId(): string {
        return randomBytes(18).toString("base64url");
    }

    private hash(value: string): string {
        return createHash("sha256").update(value).digest("hex");
    }
}
