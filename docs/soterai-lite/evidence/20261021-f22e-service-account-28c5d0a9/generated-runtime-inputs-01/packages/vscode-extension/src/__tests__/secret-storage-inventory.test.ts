import assert from "node:assert/strict";
import test from "node:test";
import { MemorySecretValueStore, SecretReferenceManager, MAX_SECRET_REFERENCE_TTL_MS } from "../secret-broker/SecretReferenceManager";
import { SECRET_INVENTORY_KEY, SecretStorageValueStore, type SecretInventoryStorage } from "../secret-broker/SecretStorageValueStore";
import { secretBrokerRuntime, setSecretValueStore } from "../secret-broker/runtime";
import type { SecretFinding } from "../secret-broker/types";

const firstId = "A".repeat(24);
const secondId = "B".repeat(24);
const prefix = "soterai.secretBroker.";

class Inventory implements SecretInventoryStorage {
    private readonly entries = new Map<string, unknown>();
    get<T>(key: string): T | undefined { return this.entries.get(key) as T | undefined; }
    async update(key: string, value: unknown): Promise<void> {
        await new Promise<void>(resolve => setImmediate(resolve));
        this.entries.set(key, structuredClone(value));
    }
}

function fixture() {
    const inventory = new Inventory();
    const values = new Map<string, string>();
    const calls: string[] = [];
    const secrets = {
        get: async (key: string) => { calls.push(`get:${key}`); return values.get(key); },
        store: async (key: string, value: string) => {
            calls.push(`store:${key}`);
            const ids = inventory.get<{ ids: string[] }>(SECRET_INVENTORY_KEY)?.ids;
            assert.ok(ids?.includes(key.slice(prefix.length)), "inventory must persist before value");
            values.set(key, value);
        },
        delete: async (key: string) => { calls.push(`delete:${key}`); values.delete(key); },
    };
    return { inventory, values, calls, secrets, store: new SecretStorageValueStore(secrets, inventory) };
}

const finding: SecretFinding = { type: "password", value: "synthetic-retention-value", start: 0, end: 25,
    label: "Synthetic retention fixture", sensitivity: "critical", allowedOperations: ["inspect_secret_metadata"] };

test("concurrent persistent writes keep an ID-only inventory before both values", async () => {
    const f = fixture();
    await Promise.all([f.store.set(firstId, "synthetic-first-value"), f.store.set(secondId, "synthetic-second-value")]);
    assert.deepEqual(f.inventory.get(SECRET_INVENTORY_KEY), { version: 1, ids: [firstId, secondId] });
    assert.doesNotMatch(JSON.stringify(f.inventory.get(SECRET_INVENTORY_KEY)), /synthetic|value|password/);
    assert.equal(f.values.size, 2);
});

test("activation recovery purges known entries without retrieving values", async () => {
    const f = fixture();
    await f.store.set(firstId, "synthetic-prior-session-value");
    f.calls.length = 0;
    const nextSession = new SecretStorageValueStore(f.secrets, f.inventory);
    await nextSession.clear();
    assert.deepEqual(f.calls, [`delete:${prefix}${firstId}`]);
    assert.equal(f.values.size, 0);
    assert.deepEqual(f.inventory.get(SECRET_INVENTORY_KEY), { version: 1, ids: [] });
});

test("failed value writes retain recovery IDs and sanitize storage errors", async () => {
    const f = fixture();
    const failing = new SecretStorageValueStore({ ...f.secrets,
        store: async () => { throw new Error("synthetic-secret-in-provider-error"); },
    }, f.inventory);
    await assert.rejects(failing.set(firstId, "synthetic-value"), error => {
        assert.doesNotMatch(String(error), /synthetic-secret/);
        assert.match(String(error), /inventory storage failed/i);
        return true;
    });
    assert.deepEqual(f.inventory.get(SECRET_INVENTORY_KEY), { version: 1, ids: [firstId] });
    await new SecretStorageValueStore(f.secrets, f.inventory).clear();
    assert.ok(f.calls.includes(`delete:${prefix}${firstId}`));
});

test("malformed inventory closes all operations before SecretStorage access", async () => {
    const f = fixture();
    await f.inventory.update(SECRET_INVENTORY_KEY, { version: 1, ids: ["../foreign-entry"] });
    for (const operation of [() => f.store.clear(), () => f.store.get(firstId),
        () => f.store.set(firstId, "synthetic-value"), () => f.store.delete(firstId)]) {
        await assert.rejects(operation(), /inventory storage failed/i);
    }
    assert.deepEqual(f.calls, []);
    await f.inventory.update(SECRET_INVENTORY_KEY, { version: 1, ids: [] });
    await assert.rejects(f.store.set(firstId, "synthetic-value"), /until recovery/);
    assert.deepEqual(f.calls, [], "failure must latch until a fresh recovery adapter is used");
});

test("failed purge preserves inventory for a fresh-session retry", async () => {
    const f = fixture();
    await f.store.set(firstId, "synthetic-first-value");
    await f.store.set(secondId, "synthetic-second-value");
    const failing = new SecretStorageValueStore({ ...f.secrets,
        delete: async (key: string) => {
            if (key.endsWith(secondId)) throw new Error("synthetic-delete-failure");
            await f.secrets.delete(key);
        },
    }, f.inventory);
    await assert.rejects(failing.clear(), /inventory storage failed/i);
    assert.deepEqual(f.inventory.get(SECRET_INVENTORY_KEY), { version: 1, ids: [firstId, secondId] });
    await new SecretStorageValueStore(f.secrets, f.inventory).clear();
    assert.equal(f.values.size, 0);
    assert.deepEqual(f.inventory.get(SECRET_INVENTORY_KEY), { version: 1, ids: [] });
});

test("invalid reference lifetimes are rejected before storing any value", async () => {
    const memory = new MemorySecretValueStore();
    let writes = 0;
    const refs = new SecretReferenceManager({ get: id => memory.get(id), delete: id => memory.delete(id),
        set: async (id, value) => { writes++; await memory.set(id, value); } });
    for (const ttlMs of [NaN, Infinity, -1, 0, MAX_SECRET_REFERENCE_TTL_MS + 1]) {
        await assert.rejects(refs.create({ finding, workspace: "synthetic-workspace", ttlMs }), /positive, finite/);
    }
    assert.equal(writes, 0);
    assert.equal(refs.list().length, 0);
});

test("expired references delete backing values even without a subsequent lookup", async () => {
    const memory = new MemorySecretValueStore();
    let deleted!: () => void;
    const deletion = new Promise<void>(resolve => { deleted = resolve; });
    const refs = new SecretReferenceManager({ get: id => memory.get(id), set: (id, value) => memory.set(id, value),
        delete: async id => { await memory.delete(id); deleted(); } });
    const metadata = await refs.create({ finding, workspace: "synthetic-workspace", ttlMs: 50 });
    let timeout!: ReturnType<typeof setTimeout>;
    try {
        await Promise.race([deletion, new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Synthetic expiry deletion did not finish")), 2000);
        })]);
        assert.equal(await memory.get(metadata.id), undefined);
        assert.equal(refs.metadata(metadata.ref)?.revoked, true);
        assert.equal(await refs.lookup(metadata.ref, "synthetic-workspace"), undefined);
    } finally { clearTimeout(timeout); await refs.clear(); }
});

test("inventory flag withdrawal denies runtime creation and reads while cleanup remains available", async () => {
    const memory = new MemorySecretValueStore();
    let enabled = true;
    await setSecretValueStore(memory, () => enabled);
    const metadata = await secretBrokerRuntime.refs.create({ finding, workspace: "synthetic-workspace", ttlMs: 60_000 });
    enabled = false;
    await assert.rejects(secretBrokerRuntime.refs.create({ finding, workspace: "synthetic-workspace", ttlMs: 60_000 }), /disabled/);
    await assert.rejects(secretBrokerRuntime.refs.lookup(metadata.ref, "synthetic-workspace"), /disabled/);
    await secretBrokerRuntime.refs.clear();
    assert.equal(await memory.get(metadata.id), undefined);
});

test("clearing while persistence is pending prevents a usable reference", async () => {
    const memory = new MemorySecretValueStore();
    let entered!: () => void;
    let release!: () => void;
    const writing = new Promise<void>(resolve => { entered = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    const refs = new SecretReferenceManager({ get: id => memory.get(id), delete: id => memory.delete(id),
        set: async (id, value) => { entered(); await pending; await memory.set(id, value); } });
    const creating = refs.create({ finding, workspace: "synthetic-workspace", ttlMs: 60_000 });
    await writing;
    const id = refs.list()[0].id;
    await refs.clear("synthetic-workspace");
    release();
    await assert.rejects(creating, /withdrawn/);
    assert.equal(await memory.get(id), undefined);
    assert.equal(refs.list().length, 0);
});
