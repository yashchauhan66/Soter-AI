import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, createHmac } from "node:crypto";
import * as os from "node:os";
import { makeExtensionContext } from "./phase2/vscode-stub";
import { AuditLedger, type AuditEntry } from "../advanced/auditLedger";

const STORE = "soterai.auditLedger";
const KEY = "soterai.auditLedger.signingKey";

function fixture() {
    const context = makeExtensionContext(os.tmpdir());
    // Keep the real storage semantics; avoid retaining thousands of test sink copies.
    context.globalState.update = async (key, value) => { context._inspect.globalStore.set(key, value); };
    return { context, ledger: AuditLedger.get(context as never) };
}

/** Signed legacy array, generated with the released v1 serialization. */
function legacyEntries(count: number, key: string): AuditEntry[] {
    const entries: AuditEntry[] = [];
    let prevHash = "GENESIS";
    for (let seq = 1; seq <= count; seq++) {
        const base = { seq, timestamp: "2026-01-01T00:00:00.000Z", eventType: "fixture", decision: "allow", redactedEvidence: "", prevHash };
        const hash = createHash("sha256").update(JSON.stringify([seq, base.timestamp, "fixture", "allow", null, "", prevHash])).digest("hex");
        entries.push({ ...base, hash, signature: createHmac("sha256", key).update(hash).digest("hex") });
        prevHash = hash;
    }
    return entries;
}

test("concurrent audit events retain distinct monotonic sequences", async () => {
    const { context, ledger } = fixture();
    const entries = await Promise.all(Array.from({ length: 40 }, (_, i) => ledger.append("event_" + i, "allow")));
    assert.deepEqual(entries.map(entry => entry.seq), Array.from({ length: 40 }, (_, i) => i + 1));
    assert.deepEqual(await ledger.verifyChain(), { ok: true, entries: 40 });
    const state = context._inspect.globalStore.get(STORE) as { entries: AuditEntry[] };
    assert.equal(new Set(state.entries.map(entry => entry.eventType)).size, 40);
});

test("legacy data migrates on append and retention checkpoints survive multiple evictions", async () => {
    const { context, ledger } = fixture();
    const key = "b".repeat(64);
    const legacy = legacyEntries(2000, key);
    context._inspect.secretStore.set(KEY, key);
    context._inspect.globalStore.set(STORE, legacy);
    assert.deepEqual(await ledger.verifyChain(), { ok: true, entries: 2000 });
    assert.equal(await ledger.append("after_retention", "block").then(entry => entry.seq), 2001);
    assert.equal(await ledger.append("after_retention_2", "block").then(entry => entry.seq), 2002);
    assert.deepEqual(await ledger.verifyChain(), { ok: true, entries: 2000 });
    const exported = JSON.parse(await ledger.exportRedacted());
    assert.equal(exported.chain[0].seq, 3);
    assert.equal(exported.checkpoint.seq, 2);
    assert.equal(exported.checkpoint.hash, legacy[1].hash);
    assert.equal(exported.head.seq, 2002);
});

test("modified entries, removed tail, and forged checkpoint fail verification", async () => {
    const { context, ledger } = fixture();
    await ledger.append("one", "allow");
    await ledger.append("two", "block");
    const original = structuredClone(context._inspect.globalStore.get(STORE)) as any;
    for (const tamper of [
        (state: any) => { state.entries[0].decision = "block"; },
        (state: any) => { state.entries.pop(); },
        (state: any) => { state.checkpoint.seq = 1; },
        (state: any) => { state.entries[1].signature = undefined; },
    ]) {
        const changed = structuredClone(original);
        tamper(changed);
        context._inspect.globalStore.set(STORE, changed);
        assert.equal((await ledger.verifyChain()).ok, false);
        await assert.rejects(ledger.append("must_not_accept_tampering", "allow"), /verification failed/);
        assert.deepEqual(context._inspect.globalStore.get(STORE), changed);
    }
    context._inspect.globalStore.set(STORE, original);
    assert.equal((await ledger.verifyChain()).ok, true);
});

test("already-truncated legacy data is preserved for inspection, not silently trusted", async () => {
    const { context, ledger } = fixture();
    const key = "c".repeat(64);
    const brokenLegacy = legacyEntries(3, key).slice(1);
    context._inspect.secretStore.set(KEY, key);
    context._inspect.globalStore.set(STORE, brokenLegacy);
    assert.equal((await ledger.verifyChain()).ok, false);
    await assert.rejects(ledger.append("new", "allow"), /verification failed/);
    const exported = JSON.parse(await ledger.exportRedacted());
    assert.equal(exported.verified, false);
    assert.deepEqual(exported.chain, brokenLegacy);
    await ledger.clear();
    assert.deepEqual(await ledger.verifyChain(), { ok: true, entries: 0 });
    assert.equal((await ledger.append("new_chain", "allow")).seq, 1);
});

test("missing signing key never regenerates trust for existing data", async () => {
    const { context, ledger } = fixture();
    await ledger.append("one", "allow");
    context._inspect.secretStore.delete(KEY);
    assert.equal((await ledger.verifyChain()).ok, false);
    await assert.rejects(ledger.append("two", "allow"), /signing key is unavailable/);
    assert.equal(context._inspect.secretStore.has(KEY), false);
    assert.equal(JSON.parse(await ledger.exportRedacted()).verified, false);
});
