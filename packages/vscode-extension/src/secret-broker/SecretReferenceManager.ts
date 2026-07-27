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

export class SecretReferenceManager {
    private readonly records = new Map<string, Omit<SecretRefRecord, "value">>();

    constructor(private readonly store: SecretValueStore = new MemorySecretValueStore()) {}

    async create(input: CreateSecretRefInput): Promise<SecretRefMetadata> {
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
        await this.store.set(id, input.finding.value);
        return { ...record, allowedOperations: [...record.allowedOperations] };
    }

    async lookup(ref: string, workspace: string, operation?: BrokerOperation): Promise<SecretRefRecord | undefined> {
        const record = this.records.get(ref);
        if (!record || record.revoked || record.workspace !== workspace) return undefined;
        if (Date.now() > Date.parse(record.expiresAt)) return undefined;
        if (operation && !record.allowedOperations.includes(operation)) return undefined;
        if (record.oneTime && record.useCount > 0) return undefined;
        // Claim the use BEFORE the async store read so two concurrent lookups
        // cannot both pass the one-time check (TOCTOU).
        record.useCount += 1;
        const value = await this.store.get(record.id);
        if (!value) return undefined;
        return { ...record, allowedOperations: [...record.allowedOperations], value };
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
        await this.store.delete(record.id);
        return true;
    }

    async clear(workspace?: string): Promise<void> {
        for (const [ref, record] of this.records) {
            if (!workspace || record.workspace === workspace) {
                await this.store.delete(record.id);
                this.records.delete(ref);
            }
        }
        if (!workspace && this.store.clear) await this.store.clear();
    }

    serializeMetadata(): string {
        return JSON.stringify(this.list());
    }

    private newId(): string {
        return randomBytes(18).toString("base64url");
    }

    private hash(value: string): string {
        return createHash("sha256").update(value).digest("hex");
    }
}
