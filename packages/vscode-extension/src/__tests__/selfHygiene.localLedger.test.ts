// Evidence-only component boundary. All filesystem methods below are in-memory;
// this does not establish actual VS Code-host or durable disk behavior.
import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { LedgerStore } from "../firewall/LedgerStore";
import { buildLedgerEntry, chainLedgerEntry, verifyLedgerChain } from "../../../guard-core/src/Ledger";
import { resetState, state, workspace, Uri, makeExtensionContext, EventEmitter } from "./phase2/vscode-stub";

const PRIVATE = "F27_SYNTHETIC_LEGACY_PRIVATE_8c16e402";
const input = () => ({ eventId: PRIVATE, workspacePseudoId: PRIVATE, eventType: "context_built" as const,
    action: "block" as const, decision: "block" as const, severity: "high" as const, riskScore: 80,
    categories: [PRIVATE], filePaths: [PRIVATE], contentHashes: [PRIVATE], redactedEvidencePreview: PRIVATE,
    policyVersion: PRIVATE, detectorVersions: { [PRIVATE]: PRIVATE }, approvalSessionId: PRIVATE,
    sessionId: PRIVATE, model: PRIVATE, provider: PRIVATE });

async function fixture(enabled: boolean, initial: string | undefined, run: (memory: {
    text: () => string | undefined; writes: () => number;
}) => Promise<void>) {
    resetState();
    state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: enabled });
    state.folders = [{ uri: Uri.parse("file:///synthetic-f27-memory-only"), name: "synthetic", index: 0 }];
    const context = makeExtensionContext("synthetic-memory-only");
    LedgerStore.initialize(context as never);
    const api = workspace.fs as any;
    const original = { createDirectory: api.createDirectory, readFile: api.readFile, writeFile: api.writeFile, delete: api.delete };
    let text = initial, writes = 0;
    api.createDirectory = async () => {};
    api.readFile = async () => { if (text === undefined) throw Object.assign(new Error("synthetic missing file"), { code: "ENOENT" }); return new TextEncoder().encode(text); };
    api.writeFile = async (_uri: unknown, bytes: Uint8Array) => { writes++; text = new TextDecoder().decode(bytes); };
    api.delete = async () => { text = undefined; };
    try { await run({ text: () => text, writes: () => writes }); }
    finally { for (const disposable of context.subscriptions) disposable.dispose(); Object.assign(api, original); }
}

test("F27 local ledger owner-off withholds persistence", async () => {
    await fixture(false, undefined, async memory => {
        try { await LedgerStore.append(input()); } catch { /* withholding may reject */ }
        assert.equal(memory.writes(), 0, "Disabled owned ledger wrote a record");
        assert.equal(memory.text(), undefined);
    });
});

test("F27 local ledger owner-on retains public decisions but no arbitrary caller text", async () => {
    await fixture(true, undefined, async memory => {
        await LedgerStore.append(input());
        assert.equal(memory.writes(), 1, "Positive enabled write must be observed");
        const saved = JSON.parse(memory.text()!.trim());
        assert.equal(saved.decision, "block");
        assert.equal(saved.riskScore, 80);
        assert.equal(memory.text()!.includes(PRIVATE), false, "Caller value reached owned ledger storage");
        assert.equal((await LedgerStore.readAll()).length, 1);
        assert.equal((await LedgerStore.verifyChain()).valid, true);
        await LedgerStore.append(input());
        assert.equal(memory.writes(), 2, "A second metadata-only append must remain available");
        assert.equal((await LedgerStore.verifyChain()).valid, true);
    });
});

test("F27 local ledger legacy export and views withhold private fields without rewriting old chain", async () => {
    const legacy = await chainLedgerEntry(buildLedgerEntry(input()), undefined);
    const bytes = JSON.stringify(legacy) + "\n";
    assert.equal((await verifyLedgerChain([legacy])).valid, true, "Fixture must start with a valid original chain");
    await fixture(true, bytes, async memory => {
        const exported = await LedgerStore.exportSafe();
        assert.equal(exported.includes(PRIVATE), false, "Export reflected an arbitrary legacy value");
        assert.equal(JSON.stringify(await LedgerStore.readAll()).includes(PRIVATE), false, "UI-facing records reflected legacy text");
        assert.equal(memory.text(), bytes, "Projection must preserve original signed/hash-chained history bytes");
        assert.equal(memory.writes(), 0);
        assert.deepEqual(await LedgerStore.verifyChain(), await verifyLedgerChain([legacy]), "Verification must still examine original records");
    });
});

test("F27 local ledger verification preserves original tamper failure independently of projections", async () => {
    const original = await chainLedgerEntry(buildLedgerEntry(input()), undefined);
    const tampered = { ...original, riskScore: 79 };
    const bytes = JSON.stringify(tampered) + "\n";
    await fixture(true, bytes, async memory => {
        assert.deepEqual(await LedgerStore.verifyChain(), await verifyLedgerChain([tampered]));
        assert.equal((await LedgerStore.verifyChain()).valid, false);
        assert.equal(memory.text(), bytes);
        assert.equal(memory.writes(), 0);
    });
});

test("F27 legacy ledger refuses new append without rewriting private original records", async () => {
    const bytes = JSON.stringify(await chainLedgerEntry(buildLedgerEntry(input()), undefined)) + "\n";
    await fixture(true, bytes, async memory => {
        await assert.rejects(LedgerStore.append(input()), { message: "Owned ledger update unavailable." });
        assert.equal(memory.text(), bytes); assert.equal(memory.writes(), 0);
        assert.equal(await LedgerStore.containsCanary([PRIVATE]), true, "Canary inspection must examine original storage rather than minimized export");
    });
});

test("F27 withheld or unreadable original ledger canary scan is unverified", async () => {
    await fixture(false, undefined, async () => { assert.equal(await LedgerStore.containsCanary([PRIVATE]), undefined); });
    await fixture(true, undefined, async () => { assert.equal(await LedgerStore.containsCanary([PRIVATE]), undefined); });
});

test("F27 malformed original ledger is retained and never replaced by a fresh chain", async () => {
    await fixture(true, "synthetic malformed original", async memory => {
        await assert.rejects(LedgerStore.append(input()), { message: "Owned ledger update unavailable." });
        assert.equal(memory.text(), "synthetic malformed original"); assert.equal(memory.writes(), 0);
        await assert.rejects(LedgerStore.verifyChain(), { message: "Owned ledger storage unavailable." });
    });
});

test("F27 unreadable original storage cannot be reported as a valid empty chain", async () => {
    await fixture(true, undefined, async () => {
        await assert.rejects(LedgerStore.verifyChain(), { message: "Owned ledger storage unavailable." });
    });
});

test("F27 explicit clear invalidates a held append before deleting history", async () => {
    await fixture(true, undefined, async memory => {
        const original = workspace.fs.readFile;
        let release!: () => void;
        workspace.fs.readFile = (async () => { await new Promise<void>(resolve => { release = resolve; }); throw Object.assign(new Error("missing"), { code: "ENOENT" }); }) as never;
        try {
            const append = LedgerStore.append(input());
            await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(typeof release, "function");
            const clear = LedgerStore.clear(); release(); await append; await clear;
            assert.equal(memory.writes(), 0); assert.equal(memory.text(), undefined);
        } finally { workspace.fs.readFile = original; }
    });
});

test("F27 local ledger pending IO cannot revive on an off-on owner epoch", async () => {
    const changes = new EventEmitter<any>(), previous = workspace.onDidChangeConfiguration;
    workspace.onDidChangeConfiguration = changes.event;
    try { await fixture(true, undefined, async memory => {
        const original = workspace.fs.readFile;
        let release!: () => void, entered = false;
        workspace.fs.readFile = (async () => { entered = true; await new Promise<void>(resolve => { release = resolve; }); throw Object.assign(new Error("missing"), { code: "ENOENT" }); }) as never;
        try {
            const pending = LedgerStore.append(input());
            await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(entered, true);
            for (const enabled of [false, true]) {
                state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: enabled });
                changes.fire({ affectsConfiguration: () => true });
            }
            release(); await pending; assert.equal(memory.writes(), 0);
        } finally { workspace.fs.readFile = original; }
    }); } finally { workspace.onDidChangeConfiguration = previous; changes.dispose(); }
});
