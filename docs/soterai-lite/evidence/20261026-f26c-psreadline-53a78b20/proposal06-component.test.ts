import "../../../../packages/vscode-extension/src/__tests__/phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import * as stub from "../../../../packages/vscode-extension/src/__tests__/phase2/vscode-stub";

const privateText = "# FAKE_ONLY_F26C_PRIVATE_UI_VALUE_c491\r\n";
const windowBefore = Object.getOwnPropertyDescriptors(stub.window), workspaceBefore = Object.getOwnPropertyDescriptors(stub.workspace), envBefore = Object.getOwnPropertyDescriptors(stub.env);
afterEach(() => {
    mock.restoreAll();
    for (const [target, before] of [[stub.window, windowBefore], [stub.workspace, workspaceBefore], [stub.env, envBefore]] as const) {
        for (const key of Reflect.ownKeys(target)) if (!Object.hasOwn(before, key)) Reflect.deleteProperty(target, key);
        Object.defineProperties(target, before);
    }
});
async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "soterai-f26c-ui-")), parent = join(root, "WindowsPowerShell"); await mkdir(parent);
    const target = join(parent, "Microsoft.PowerShell_profile.ps1"); await writeFile(target, privateText);
    const context = stub.makeExtensionContext(join(root, "synthetic-storage"));
    const nativeOS = require("node:os") as typeof import("node:os"); mock.method(nativeOS, "homedir", () => root);
    const state = { flag: true, trusted: true, pick: true, approve: true, diffs: [] as string[][], confirmations: 0, pickCalls: 0, onDiff: undefined as (() => Promise<void>) | undefined, onModal: undefined as (() => Promise<void>) | undefined };
    const providers = new Map<string, { provideTextDocumentContent(uri: stub.Uri): string }>();
    Object.defineProperties(stub.workspace, {
        isTrusted: { value: true, writable: true, enumerable: true, configurable: true },
        workspaceFolders: { value: [{ uri: stub.Uri.file(join(root, "workspace")) }], writable: true, enumerable: true, configurable: true },
    });
    Object.assign(stub.workspace, {
        getConfiguration: () => ({ inspect: () => ({ globalValue: state.flag, defaultValue: false, workspaceValue: true }) }),
        registerTextDocumentContentProvider: (scheme: string, provider: { provideTextDocumentContent(uri: stub.Uri): string }) => { providers.set(scheme, provider); return { dispose() { providers.delete(scheme); } }; },
    });
    Object.assign(stub.window, {
        showSaveDialog: async () => { state.pickCalls++; return state.pick ? stub.Uri.file(target) : undefined; },
        showWarningMessage: async (_message: string, _options: unknown, action: string) => { state.confirmations++; await state.onModal?.(); return state.approve ? action : undefined; },
    });
    mock.method(stub.commands, "executeCommand", async (id: string, ...args: unknown[]) => {
        assert.equal(id, "vscode.diff"); const texts = args.slice(0, 2).map(uri => { const u = uri as stub.Uri; assert.notEqual(u.scheme, "file"); return providers.get(u.scheme)!.provideTextDocumentContent(u); });
        state.diffs.push(texts); await state.onDiff?.(); return undefined;
    });
    const api = await import("../../../../packages/vscode-extension/src/history-hooks/PSReadLineHistoryController"), controller = new api.PSReadLineHistoryController(context as never);
    return { root, parent, target, context, state, controller };
}

test("F26c idle controller/status never selects a profile or creates a backup key", async () => {
    const f = await fixture(), status = f.controller.status(); assert.equal(status.badge, "Uncovered"); assert.equal(f.state.pickCalls, 0); assert.equal(f.context._inspect.secretStore.size, 0); assert.equal((await readFile(f.target)).toString(), privateText); f.controller.dispose();
});

test("F26c canceled profile selection leaves source, key and journal untouched", async () => {
    const f = await fixture(); f.state.pick = false; assert.equal((await f.controller.install()).status, "CANCELLED"); assert.equal(f.context._inspect.secretStore.size, 0); assert.equal(f.context._inspect.globalStore.size, 0); assert.equal((await readFile(f.target)).toString(), privateText); f.controller.dispose();
});

test("F26c declined modal leaves source and key untouched after metadata-only diff", async () => {
    const f = await fixture(); f.state.approve = false; assert.equal((await f.controller.install()).status, "CANCELLED"); assert.equal(f.state.diffs.length, 1);
    const previews = f.state.diffs.flat().join("\n"); assert(!previews.includes(privateText.trim())); assert(!previews.includes(f.target)); assert.equal(f.context._inspect.secretStore.size, 0); assert.equal((await readFile(f.target)).toString(), privateText); f.controller.dispose();
});

test("F26c confirmed native review installs synthetic profile with encrypted backup and honest badge", async () => {
    const f = await fixture(); assert.equal((await f.controller.install()).status, "APPLIED"); assert.equal(f.state.confirmations, 1); assert.equal(f.context._inspect.secretStore.size, 1);
    const after = await readFile(f.target); assert(after.toString().includes("SoterAI Lite PSReadLine history v1")); assert.equal(f.controller.status().badge, "Uncovered");
    assert(!JSON.stringify(f.controller.status()).includes(privateText.trim())); f.controller.dispose();
});

test("F26c explicit owner restore works after install flag disabled and returns exact original bytes", async () => {
    const f = await fixture(); assert.equal((await f.controller.install()).status, "APPLIED"); f.state.flag = false;
    assert.equal((await f.controller.restore()).status, "RESTORED"); assert.equal((await readFile(f.target)).toString(), privateText); assert.equal(f.controller.status().badge, "Uncovered"); f.controller.dispose();
});

test("F26c disabled install refuses before profile selection or key access", async () => {
    const f = await fixture(); f.state.flag = false; assert.equal((await f.controller.install()).status, "UNAVAILABLE"); assert.equal(f.state.pickCalls, 0); assert.equal(f.context._inspect.secretStore.size, 0); f.controller.dispose();
});

test("F26c file drift during native modal preserves independent profile edit", async () => {
    const f = await fixture(); f.state.onModal = () => writeFile(f.target, "# independently edited\n"); assert.notEqual((await f.controller.install()).status, "APPLIED"); assert.equal((await readFile(f.target)).toString(), "# independently edited\n"); assert.equal(f.context._inspect.secretStore.size, 0); f.controller.dispose();
});

test("F26c flag withdrawal during diff stops before modal and backup", async () => {
    const f = await fixture(); f.state.onDiff = async () => { f.state.flag = false; }; assert.equal((await f.controller.install()).status, "UNAVAILABLE"); assert.equal(f.state.confirmations, 0); assert.equal(f.context._inspect.secretStore.size, 0); f.controller.dispose();
});

test("F26c workspace drift during modal invalidates approval", async () => {
    const f = await fixture(); f.state.onModal = async () => { Object.defineProperty(stub.workspace, "workspaceFolders", { configurable: true, value: [{ uri: stub.Uri.file(join(f.root, "other-workspace")) }] }); };
    assert.notEqual((await f.controller.install()).status, "APPLIED"); assert.equal(f.context._inspect.secretStore.size, 0); f.controller.dispose();
});

test("F26c untrusted window refuses before profile selection", async () => {
    const f = await fixture(); Object.defineProperty(stub.workspace, "isTrusted", { configurable: true, value: false }); assert.equal((await f.controller.install()).status, "UNAVAILABLE"); assert.equal(f.state.pickCalls, 0); f.controller.dispose();
});

test("F26c executable profile is withheld before native diff or backup access", async () => {
    const f = await fixture(); await writeFile(f.target, "Write-Output public\n"); assert.notEqual((await f.controller.install()).status, "APPLIED"); assert.equal(f.state.diffs.length, 0); assert.equal(f.context._inspect.secretStore.size, 0); f.controller.dispose();
});

test("F26c dispose during review invalidates approval and preserves original file", async () => {
    const f = await fixture(); f.state.onModal = async () => { f.controller.dispose(); }; assert.equal((await f.controller.install()).status, "UNAVAILABLE"); assert.equal((await readFile(f.target)).toString(), privateText); assert.deepEqual(await readdir(f.parent), ["Microsoft.PowerShell_profile.ps1"]);
});

test("F26c strict history flag ignores repository overrides and malformed global values", async () => {
    const api = await import("../../../../packages/vscode-extension/src/history-hooks/PSReadLineHistoryFlags"); let globalValue: unknown, defaultValue: unknown = false;
    Object.assign(stub.workspace, { getConfiguration: () => ({ inspect: () => ({ globalValue, defaultValue, workspaceValue: true, workspaceFolderValue: true }) }) });
    assert.equal(api.psReadLineHistoryEnabled(), false); globalValue = true; assert.equal(api.psReadLineHistoryEnabled(), true);
    for (const value of [false, "true", 1, {}, null]) { globalValue = value; assert.equal(api.psReadLineHistoryEnabled(), false); }
    globalValue = undefined; defaultValue = true; assert.equal(api.psReadLineHistoryEnabled(), true);
});

test("F26c remote extension host refuses before owner-profile selection", async () => {
    const f = await fixture(); Object.defineProperty(stub.env, "remoteName", { configurable: true, value: "ssh-remote" });
    assert.equal((await f.controller.install()).status, "UNAVAILABLE"); assert.equal(f.state.pickCalls, 0); f.controller.dispose();
});

test("F26c drift after the final review-read closes cannot replace approval with new source bytes", async () => {
    const f = await fixture(), native = require("node:fs/promises") as typeof import("node:fs/promises"), originalOpen = native.open;
    let afterModal = false, injected = false; f.state.onModal = async () => { afterModal = true; };
    mock.method(native, "open", async (...args: Parameters<typeof native.open>) => {
        const handle = await originalOpen(...args);
        if (afterModal && !injected && args[0] === f.target && args[1] === "r") {
            injected = true; const close = handle.close.bind(handle);
            mock.method(handle, "close", async () => { await close(); await writeFile(f.target, "# changed after reviewed read\n"); });
        }
        return handle;
    });
    const result = await f.controller.install(); assert(injected); assert.notEqual(result.status, "APPLIED");
    assert.equal((await readFile(f.target)).toString(), "# changed after reviewed read\n"); assert.equal(f.context._inspect.secretStore.size, 0); f.controller.dispose();
});

test("F26c late native Memento echo cannot regress an applied journal or block exact restore", async () => {
    const f = await fixture(); assert.equal((await f.controller.install()).status, "APPLIED");
    const installed = await readFile(f.target), generation = /history v1 ([a-f0-9-]{36})/.exec(installed.toString())![1];
    const { CheckedHistoryProfileFile } = await import("../../../../packages/vscode-extension/src/history-hooks/CheckedHistoryProfileFile");
    const identity = (await new CheckedHistoryProfileFile(f.root, f.target, () => true).snapshot()).identity;
    const backups = await readdir(join(f.context.globalStorageUri.fsPath, "config-backups")); assert.equal(backups.length, 1);
    const digest = (raw: Buffer) => createHash("sha256").update(raw).digest("hex");
    const stale = { schemaVersion: 1, generation, identity, phase: "PREPARED", existed: true,
        beforeDigest: digest(Buffer.from(privateText)), afterDigest: digest(installed), backupHandle: backups[0].replace(/\.enc$/, "") };
    // Faithful state transition from the pinned native storage listener: a late
    // prior snapshot replaces the cache after the applied update acknowledged.
    await f.context.globalState.update("soterai.lite.psReadLineHistory.receipt.v1", stale);
    assert.equal(f.controller.status().status, "INSTALLED_CONSOLE_LOAD_UNVERIFIED");
    assert.equal((await f.controller.restore()).status, "RESTORED"); assert.equal((await readFile(f.target)).toString(), privateText); f.controller.dispose();
});


test("F26c proposal06 positive flows precede key outage and a fresh owner instance restores exact bytes", async () => {
    const f = await fixture(); assert.equal((await f.controller.install()).status, "APPLIED");
    assert.equal((await f.controller.restore()).status, "RESTORED"); assert.equal((await f.controller.install()).status, "APPLIED");
    assert.equal((await f.controller.restore()).status, "RESTORED"); assert.equal((await f.controller.install()).status, "APPLIED");
    const saved = await f.context.secrets.get("soterai.configBackupKey"); assert(saved); const installed = await readFile(f.target);
    await f.context.secrets.delete("soterai.configBackupKey"); assert.equal((await f.controller.restore()).status, "INCOMPLETE");
    assert((await readFile(f.target)).equals(installed)); assert.equal(await f.context.secrets.get("soterai.configBackupKey"), undefined);
    await f.context.secrets.store("soterai.configBackupKey", saved); assert.equal(await f.context.secrets.get("soterai.configBackupKey"), saved);
    f.controller.dispose(); const api = await import("../../../../packages/vscode-extension/src/history-hooks/PSReadLineHistoryController"); const recovered = new api.PSReadLineHistoryController(f.context as never);
    assert.equal(recovered.status().status, "INSTALLED_CONSOLE_LOAD_UNVERIFIED"); assert.equal((await recovered.restore()).status, "RESTORED"); assert.equal((await readFile(f.target)).toString(), privateText); recovered.dispose();
    assert.equal(f.context._inspect.secretStore.size, 1); f.controller.dispose();
});
