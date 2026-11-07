import type * as vscode from "vscode";
import { type SecretValueStore } from "./SecretReferenceManager";

/** Contains opaque IDs only, never values, hashes, filenames or workspaces. */
export interface SecretInventoryStorage {
    get<T>(key: string): T | undefined;
    update(key: string, value: unknown): PromiseLike<void>;
}

interface SecretInventory { version: 1; ids: string[] }

export const SECRET_INVENTORY_KEY = "soterai.secretBroker.inventory.v1";
const ID_PATTERN = /^[A-Za-z0-9_-]{24}$/;
const MAX_INVENTORY_ENTRIES = 10_000;

/**
 * Persist a recovery ID before a value. Operations are serialized to avoid
 * losing an inventory entry during concurrent creates/cleanup. This is
 * retention hygiene, not isolation from another same-user process.
 */
export class SecretStorageValueStore implements SecretValueStore {
    private tail: Promise<void> = Promise.resolve();
    private failure?: Error;

    constructor(
        private readonly secrets: Pick<vscode.SecretStorage, "get" | "store" | "delete">,
        private readonly inventory: SecretInventoryStorage,
        private readonly prefix = "soterai.secretBroker.",
    ) {}

    async get(id: string): Promise<string | undefined> {
        return this.serialize(async () => {
            this.validateId(id);
            if (!this.readInventory().ids.includes(id)) return undefined;
            return this.secrets.get(this.prefix + id);
        });
    }

    async set(id: string, value: string): Promise<void> {
        return this.serialize(async () => {
            this.validateId(id);
            const inventory = this.readInventory();
            if (!inventory.ids.includes(id)) {
                if (inventory.ids.length >= MAX_INVENTORY_ENTRIES) throw new Error("Secret inventory capacity exceeded.");
                inventory.ids.push(id);
                await this.inventory.update(SECRET_INVENTORY_KEY, inventory);
            }
            await this.secrets.store(this.prefix + id, value);
        });
    }

    async delete(id: string): Promise<void> {
        return this.serialize(async () => {
            this.validateId(id);
            const inventory = this.readInventory();
            if (!inventory.ids.includes(id)) return;
            await this.secrets.delete(this.prefix + id);
            await this.inventory.update(SECRET_INVENTORY_KEY, { version: 1, ids: inventory.ids.filter(entry => entry !== id) });
        });
    }

    /** Purge inventoried entries without retrieving any persistent value. */
    async clear(): Promise<void> {
        return this.serialize(async () => {
            const inventory = this.readInventory();
            // Keep the complete inventory if any deletion fails. Re-deleting
            // successfully removed IDs is safe on the next activation.
            for (const id of inventory.ids) await this.secrets.delete(this.prefix + id);
            await this.inventory.update(SECRET_INVENTORY_KEY, { version: 1, ids: [] });
        });
    }

    private readInventory(): SecretInventory {
        const raw = this.inventory.get<unknown>(SECRET_INVENTORY_KEY);
        if (raw === undefined) return { version: 1, ids: [] };
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Secret inventory is invalid; reference operations are unavailable.");
        const candidate = raw as Partial<SecretInventory>;
        if (candidate.version !== 1 || !Array.isArray(candidate.ids) || candidate.ids.length > MAX_INVENTORY_ENTRIES
            || candidate.ids.some(id => typeof id !== "string" || !ID_PATTERN.test(id))
            || new Set(candidate.ids).size !== candidate.ids.length) {
            throw new Error("Secret inventory is invalid; reference operations are unavailable.");
        }
        return { version: 1, ids: [...candidate.ids] };
    }

    private validateId(id: string): void {
        if (!ID_PATTERN.test(id)) throw new Error("Invalid secret inventory ID.");
    }

    private serialize<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.tail.then(() => {
            if (this.failure) throw this.failure;
            return operation();
        });
        this.tail = result.then(() => {}, () => {
            // Never expose storage errors that could contain provider values.
            this.failure = new Error("Secret inventory storage failed; reference operations are unavailable until recovery.");
        });
        return result.catch(() => {
            throw this.failure ?? new Error("Secret inventory storage failed; reference operations are unavailable until recovery.");
        });
    }
}
