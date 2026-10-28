import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import * as os from "node:os";
import { createHash, createHmac } from "node:crypto";
import { makeExtensionContext, resetState, state, workspace, EventEmitter } from "./phase2/vscode-stub";
import { AuditLedger } from "../advanced/auditLedger";

const STORE = "soterai.auditLedger";
const KEY = "soterai.auditLedger.signingKey";
const CANARY = "F27_SYNTHETIC_PRIVATE_VALUE_8c16e402";

function fixture(enabled = true) {
    resetState();
    state.config.set("soterai.lite.selfHygiene", enabled);
    state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: enabled });
    const context = makeExtensionContext(os.tmpdir());
    context.globalState.update = async (key, value) => { context._inspect.globalStore.set(key, value); };
    return { context, ledger: AuditLedger.get(context as never) };
}

test("F27 audit preserves useful public sequence and verification metadata", async () => {
    const { ledger } = fixture();
    await ledger.append("scan", "allow", 10);
    assert.deepEqual(await ledger.verifyChain(), { ok: true, entries: 1 });
    const exported = JSON.parse(await ledger.exportRedacted());
    assert.equal(exported.verified, true);
    assert.equal(exported.entries, 1);
});

test("F27 audit sanitizes every caller text field before durable admission", async () => {
    const { context, ledger } = fixture();
    await ledger.append(CANARY, CANARY, 10, CANARY);
    assert.equal(JSON.stringify(context._inspect.globalStore.get(STORE)).includes(CANARY), false,
        "Audit storage retained a synthetic private value");
    assert.equal((await ledger.exportRedacted()).includes(CANARY), false,
        "Audit export retained a synthetic private value");
});

test("F27 restart export withholds unsafe legacy text without rewriting signed history", async () => {
    const { context, ledger } = fixture();
    await ledger.append("scan", "allow", 10);
    const data = structuredClone(context._inspect.globalStore.get(STORE)) as { entries: Array<{ redactedEvidence: string }> };
    data.entries[0].redactedEvidence = CANARY;
    context._inspect.globalStore.set(STORE, data);
    const restarted = makeExtensionContext(os.tmpdir());
    restarted._inspect.globalStore.set(STORE, structuredClone(data));
    restarted._inspect.secretStore.set(KEY, context._inspect.secretStore.get(KEY)!);
    const exported = JSON.parse(await AuditLedger.get(restarted as never).exportRedacted());
    assert.equal(exported.verified, false);
    assert.equal(JSON.stringify(exported).includes(CANARY), false,
        "Restart export reflected unsafe stored text");
    assert.deepEqual(context._inspect.globalStore.get(STORE), data);
    assert.deepEqual(restarted._inspect.globalStore.get(STORE), data);
});

test("F27 disabled owned audit sink withholds emission before storage or key creation", async () => {
    const { context, ledger } = fixture(false);
    await assert.rejects(ledger.append(CANARY, CANARY, 10, CANARY));
    assert.equal(context._inspect.globalStore.has(STORE), false);
    assert.equal(context._inspect.secretStore.has(KEY), false);
});

test("F27 restart audit anchors never reflect unsigned extra properties", async () => {
    const { context, ledger } = fixture(); await ledger.append("scan", "allow", 10);
    const data = structuredClone(context._inspect.globalStore.get(STORE)) as any;
    data.checkpoint.privateNote = CANARY; data.head.privateNote = CANARY;
    context._inspect.globalStore.set(STORE, data);
    const exported = JSON.parse(await ledger.exportRedacted());
    assert.equal(exported.verified, true);
    assert.equal(JSON.stringify(exported).includes(CANARY), false);
    assert.deepEqual(Object.keys(exported.head).sort(), ["hash", "seq", "signature"]);
});

test("F27 authenticated legacy private text exports no private-content-derived hashes or signatures", async () => {
    for (const field of ["redactedEvidence", "timestamp"] as const) {
    const { context, ledger } = fixture(); await ledger.append("scan", "allow", 10);
    const data = structuredClone(context._inspect.globalStore.get(STORE)) as any;
    const entry = data.entries[0], key = context._inspect.secretStore.get(KEY)!;
    entry[field] = CANARY;
    entry.hash = createHash("sha256").update(JSON.stringify([entry.seq, entry.timestamp, entry.eventType, entry.decision, entry.riskScore, entry.redactedEvidence, entry.prevHash])).digest("hex");
    entry.signature = createHmac("sha256", key).update(entry.hash).digest("hex");
    data.head.hash = entry.hash;
    data.head.signature = createHmac("sha256", key).update(JSON.stringify(["soterai-audit-v2", "head", data.head.seq, entry.hash])).digest("hex");
    context._inspect.globalStore.set(STORE, data);
    assert.equal((await ledger.verifyChain()).ok, true);
    const output = await ledger.exportRedacted(), exported = JSON.parse(output);
    assert.equal(exported.verified, true); assert.equal(output.includes(CANARY), false);
    assert.equal(output.includes(entry.hash), false); assert.equal(output.includes(entry.signature), false);
    assert.equal(exported.chain[0].hash, "WITHHELD"); assert.equal(exported.head, undefined);
    assert.deepEqual(context._inspect.globalStore.get(STORE), data);
    }
});

test("F27 audit pending key lookup cannot revive after owner flag off and on", async () => {
    const changes = new EventEmitter<any>(), previous = workspace.onDidChangeConfiguration;
    workspace.onDidChangeConfiguration = changes.event;
    const { context, ledger } = fixture();
    let release!: (value: string | undefined) => void, entered = false;
    const held = new Promise<string | undefined>(resolve => { release = resolve; });
    context.secrets.get = async () => { entered = true; return held; };
    try {
        const pending = ledger.append(CANARY, CANARY, 10, CANARY);
        await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(entered, true);
        state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: false });
        changes.fire({ affectsConfiguration: () => true });
        state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: true });
        changes.fire({ affectsConfiguration: () => true });
        release(undefined);
        await assert.rejects(pending);
        assert.equal(context._inspect.globalStore.has(STORE), false);
        assert.equal(context._inspect.secretStore.has(KEY), false);
    } finally {
        for (const disposable of context.subscriptions) disposable.dispose();
        workspace.onDidChangeConfiguration = previous; changes.dispose();
    }
});

test("F27 audit storage exceptions expose only a fixed value-free failure", async () => {
    const { context, ledger } = fixture();
    context.globalState.update = async () => { throw new Error(CANARY); };
    let message = "";
    try { await ledger.append("scan", "allow", 10); } catch (error) { message = (error as Error).message; }
    assert(message.length > 0); assert.equal(message.includes(CANARY), false, "Audit storage failure reflected private text");
});
