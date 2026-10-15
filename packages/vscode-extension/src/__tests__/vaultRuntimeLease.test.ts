import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { VaultManager } from "../firewall/VaultManager";

// All source/vault values here are synthetic; retained fixture directories are
// evidence, not a normal VS Code profile or project owned by the user.
const FAKE = "postgresql://synthetic-f09:fake-password@f09.invalid/database";
const ENTRY = "exports.start = () => {};\n";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
type Selection = { name: string; placeholder: string };
type LeaseManager = VaultManager & {
    runtimeSelections(uri: vscode.Uri): Promise<readonly Selection[]>;
    withRuntimeValues<T>(descriptor: unknown, use: (values: Readonly<Record<string, string>>, guard: () => boolean) => T, enabled: () => boolean): Promise<T>;
};
let context: ReturnType<typeof stub.makeExtensionContext>, manager: LeaseManager, root: string, storage: string;
let approval = true, onReview: (() => Promise<void>) | undefined, sourceDocumentReads = 0;
const originals = Object.getOwnPropertyDescriptors(stub.window);
const workspaceOriginals = Object.getOwnPropertyDescriptors(stub.workspace);
const uri = () => stub.Uri.file(join(root, ".env")) as unknown as vscode.Uri;
function runtime(): LeaseManager {
    assert.equal(typeof manager.runtimeSelections, "function", "runtime selection metadata must be implemented");
    assert.equal(typeof manager.withRuntimeValues, "function", "private reviewed runtime lease must be implemented");
    return manager;
}
async function descriptor(): Promise<Record<string, unknown>> {
    const selections = await runtime().runtimeSelections(uri());
    return { schemaVersion: 1, id: "ec57b65d-8802-4cb4-837d-51cd174be009", root,
        source: uri().fsPath, program: join(root, "app.cjs"), cwd: root, programDigest: sha(ENTRY), args: [], selections };
}
async function unavailable(work: () => Promise<unknown>): Promise<void> {
    await assert.rejects(work, error => { assert.ok(!(error instanceof assert.AssertionError)); assert.ok(!String(error).includes(FAKE)); return true; });
}
beforeEach(async () => {
    const fixture = await mkdtemp(join(tmpdir(), "soterai-f09-lease-")); root = join(fixture, "project"); storage = join(fixture, "storage");
    await mkdir(root); await mkdir(storage); await writeFile(join(root, ".env"), `DATABASE_URL='${FAKE}'\nPORT=8080\n`); await writeFile(join(root, "app.cjs"), ENTRY);
    stub.resetState(root); context = stub.makeExtensionContext(root); context.globalStorageUri = stub.Uri.file(storage);
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load();
    approval = true; onReview = undefined; sourceDocumentReads = 0;
    Object.assign(stub.window, { showWarningMessage: async (_message: string, _options: unknown, ...actions: string[]) => {
        if (actions.includes("Run selected app")) { await onReview?.(); return approval ? "Run selected app" : undefined; }
        return actions.includes("Migrate securely") ? "Migrate securely" : undefined;
    } });
    Object.assign(stub.workspace, { openTextDocument: async () => { sourceDocumentReads++; throw new Error("no source TextDocument allowed"); } });
    manager = new VaultManager(context as never) as LeaseManager; await manager.migrate(uri()); stub.resetSinks();
});
afterEach(() => {
    context.subscriptions.forEach(d => d.dispose()); mock.restoreAll();
    for (const name of Object.keys(stub.window)) if (!(name in originals)) delete (stub.window as unknown as Record<string, unknown>)[name];
    for (const name of Object.keys(stub.workspace)) if (!(name in workspaceOriginals)) delete (stub.workspace as unknown as Record<string, unknown>)[name];
    Object.defineProperties(stub.window, originals); Object.defineProperties(stub.workspace, workspaceOriginals);
});

test("F09-L01 metadata exposes current names/placeholders and no raw values or value hashes", async () => {
    const selections = await runtime().runtimeSelections(uri()); assert.equal(selections.length, 1);
    assert.deepEqual(Object.keys(selections[0]).sort(), ["name", "placeholder"]); assert.equal(selections[0].name, "DATABASE_URL");
    assert.match(selections[0].placeholder, /^\[SOTERAI_PROTECTED_[A-F0-9]{32}_(?:0|[1-9]\d{0,2})\]$/);
    const text = JSON.stringify(selections); assert.ok(!text.includes(FAKE)); assert.ok(!text.includes(sha(FAKE))); assert.equal(sourceDocumentReads, 0);
});
test("F09-L02 approved private lease supplies logical unquoted value once, without changing source or parent environment", async () => {
    const d = await descriptor(), before = await readFile(uri().fsPath, "utf8"), parent = process.env.DATABASE_URL; let count = 0;
    const result = await runtime().withRuntimeValues(d, (values, guard) => {
        count++; assert.equal(values.DATABASE_URL, FAKE); assert.equal(Object.keys(values).length, 1); assert.ok(Object.isFrozen(values)); assert.equal(guard(), true); return "safe-result";
    }, () => true);
    assert.equal(result, "safe-result"); assert.equal(count, 1); assert.equal(process.env.DATABASE_URL, parent);
    assert.equal(await readFile(uri().fsPath, "utf8"), before); assert.equal(sourceDocumentReads, 0);
    for (const sink of stub.sinks) assert.ok(!sink.text.includes(FAKE));
});
test("F09-L03 cancelled native review invokes no trusted callback", async () => {
    const d = await descriptor(); approval = false; let count = 0;
    await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.equal(count, 0);
});
test("F09-L04 config withdrawal while review is held prevents release", async () => {
    const d = await descriptor(); onReview = async () => { stub.state.config.set("soterai.lite.vaultRuntime", false); };
    let count = 0; await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.equal(count, 0);
});
test("F09-L05 cancellation and untrusted workspace withhold before decryption callback", async () => {
    const d = await descriptor(); let count = 0;
    await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => false));
    stub.state.isTrusted = false; await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.equal(count, 0);
});
test("F09-L06 source drift during review cannot inject an old selection", async () => {
    const d = await descriptor(); onReview = async () => { await writeFile(uri().fsPath, "DATABASE_URL=owner-newer\n"); };
    let count = 0; await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.equal(count, 0);
});
test("F09-L07 app change during review withholds until a new allowlist review", async () => {
    const d = await descriptor(); onReview = async () => { await writeFile(join(root, "app.cjs"), ENTRY + "// changed\n"); };
    let count = 0; await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.equal(count, 0);
});
test("F09-L08 unavailable/replaced existing key never regenerates a key or releases a value", async () => {
    const d = await descriptor(); context._inspect.secretStore.delete("soterai.vaultKey"); let count = 0;
    await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.equal(count, 0); assert.equal(context._inspect.secretStore.size, 0);
});
test("F09-L09 source changed during held SecretStorage read cannot release stale values", async () => {
    const d = await descriptor(), original = context.secrets.get.bind(context.secrets); let changed = false;
    mock.method(context.secrets, "get", async (key: string) => { const value = await original(key); if (!changed) { changed = true; await writeFile(uri().fsPath, "DATABASE_URL=owner-changed-during-key\n"); } return value; });
    let count = 0; await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.ok(changed); assert.equal(count, 0);
});
test("F09-L10 unknown placeholder/name, duplicate or extra descriptor input rejects without callback", async () => {
    const d = await descriptor();
    for (const bad of [{ ...d, selections: [{ name: "OTHER_KEY", placeholder: (d.selections as Selection[])[0].placeholder }] },
        { ...d, selections: [...d.selections as Selection[], ...d.selections as Selection[]] }, { ...d, env: { DATABASE_URL: FAKE } }]) {
        let count = 0; await unavailable(() => runtime().withRuntimeValues(bad, () => { count++; }, () => true)); assert.equal(count, 0);
    }
});
test("F09-L11 pending migration blocks metadata and launch while ciphertext stays retained", async () => {
    const d = await descriptor(); await writeFile(join(storage, "vault-pending.json"), "{}"); let count = 0;
    await unavailable(() => runtime().runtimeSelections(uri())); await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.equal(count, 0);
});
test("F09-L12 retained guard observes selected source/app/config withdrawal after release", async () => {
    const d = await descriptor(); let guard!: () => boolean;
    await runtime().withRuntimeValues(d, (_values, check) => { guard = check; }, () => true); assert.equal(guard(), true);
    await writeFile(join(root, "app.cjs"), ENTRY + "// replacement\n"); assert.equal(guard(), false);
});
test("F09-L13 duplicate current environment names are withheld rather than selecting the first", async () => {
    runtime(); const text = await readFile(uri().fsPath, "utf8"); await writeFile(uri().fsPath, text + text);
    await unavailable(() => runtime().runtimeSelections(uri()));
});
test("F09-L14 normal app output files do not revoke stable directory ownership", async () => {
    const d = await descriptor(); let guard!: () => boolean;
    await runtime().withRuntimeValues(d, (_values, check) => { guard = check; }, () => true); assert.equal(guard(), true);
    await writeFile(join(root, "public-app-result.txt"), "ordinary public result\n"); assert.equal(guard(), true);
});
for (const change of ["pending", "ciphertext"] as const) {
    test(`F09-L15-${change} late storage drift during the last key read withholds release`, async () => {
        const d = await descriptor(), original = context.secrets.get.bind(context.secrets); let reads = 0, changed = false;
        mock.method(context.secrets, "get", async (key: string) => {
            const value = await original(key); reads++;
            if (reads === 4) {
                changed = true; await writeFile(join(storage, change === "pending" ? "vault-pending.json" : "soterai-vault.enc"), "synthetic-late-storage-change");
            }
            return value;
        });
        let count = 0; await unavailable(() => runtime().withRuntimeValues(d, () => { count++; }, () => true)); assert.ok(changed); assert.equal(count, 0);
    });
}
