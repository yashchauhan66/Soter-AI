// Evidence-only component boundary. All filesystem methods below are in-memory;
// this does not establish actual VS Code-host or durable disk behavior.
import "../../../../packages/vscode-extension/src/__tests__/phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { LedgerStore } from "../../../../packages/vscode-extension/src/firewall/LedgerStore";
import { buildLedgerEntry, chainLedgerEntry, verifyLedgerChain } from "../../../../packages/guard-core/src/Ledger";
import { resetState, state, workspace, Uri } from "../../../../packages/vscode-extension/src/__tests__/phase2/vscode-stub";

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
    const api = workspace.fs as any;
    const original = { createDirectory: api.createDirectory, readFile: api.readFile, writeFile: api.writeFile, delete: api.delete };
    let text = initial, writes = 0;
    api.createDirectory = async () => {};
    api.readFile = async () => { if (text === undefined) throw new Error("synthetic missing file"); return new TextEncoder().encode(text); };
    api.writeFile = async (_uri: unknown, bytes: Uint8Array) => { writes++; text = new TextDecoder().decode(bytes); };
    api.delete = async () => { text = undefined; };
    try { await run({ text: () => text, writes: () => writes }); }
    finally { Object.assign(api, original); }
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
