import "../packages/vscode-extension/src/__tests__/phase2/register.mjs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { decryptVault } from "../packages/guard-core/src/index";
import * as stub from "../packages/vscode-extension/src/__tests__/phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState } from "../packages/vscode-extension/src/ai-boundary/BoundarySnapshot";
import { VaultManager } from "../packages/vscode-extension/src/firewall/VaultManager";
import { VaultStorage } from "../packages/vscode-extension/src/firewall/VaultStorage";

const original = 'DB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\n';
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function reply(value: unknown, code = 0): void {
    process.send?.(value, () => { process.disconnect(); process.exit(code); });
}
process.once("message", async (input: { mode: string; root: string; key: string }) => {
    try {
        const root = path.resolve(input.root), workspace = path.join(root, "workspace"), storage = path.join(root, "storage");
        if (!root.startsWith(path.resolve(__dirname, "../docs/soterai-lite/evidence/20261114-release-gates") + path.sep)
            || !/^[A-Za-z0-9+/]{43}=$/.test(input.key)) throw Error("DRILL_SCOPE");
        stub.resetState(workspace);
        const context = stub.makeExtensionContext(workspace);
        context.globalStorageUri = stub.Uri.file(storage);
        context.storageUri = stub.Uri.file(path.join(root, "workspace-state"));
        context._inspect.secretStore.set("soterai.vaultKey", input.key);
        initializeBoundaryState(context.workspaceState as never);
        await BoundarySnapshot.load();
        stub.window.showWarningMessage = (async (_message: string, ...args: unknown[]) =>
            args.find(value => ["Migrate securely", "Complete safe recovery", "Restore raw values"].includes(value as string))) as never;
        const manager = new VaultManager(context as never), uri = stub.Uri.file(path.join(workspace, ".env")) as never;
        let migrated: number | undefined, recovered: boolean | undefined, restored: number | undefined;
        if (input.mode === "hold-after-vault") {
            const write = VaultStorage.prototype.write;
            VaultStorage.prototype.write = async function (name, text, exclusive) {
                await write.call(this, name, text, exclusive);
                if (name === "soterai-vault.enc") {
                    process.send?.({ ok: true, phase: "VAULT_COMMITTED_BEFORE_SOURCE", sourceStillOriginal: (await fs.readFile(path.join(workspace, ".env"), "utf8")) === original });
                    await new Promise<void>(() => {});
                }
            };
        }
        if (["seed", "hold-after-vault"].includes(input.mode)) migrated = await manager.migrate(uri);
        else if (input.mode === "recover") recovered = await manager.recoverMigration(uri);
        else if (input.mode === "restore") restored = await manager.restore(uri);
        else if (!["inspect", "expect-corruption"].includes(input.mode)) throw Error("DRILL_MODE");
        if (input.mode === "expect-corruption") {
            let refused = false;
            try { await manager.status(); } catch { refused = true; }
            if (!refused) throw Error("CORRUPTION_ACCEPTED");
            reply({ ok: true, corruptCiphertextRefused: true }); return;
        }
        const status = await manager.status(), cipher = await fs.readFile(path.join(storage, "soterai-vault.enc"), "utf8");
        const vault = JSON.parse(await decryptVault(cipher, input.key));
        const source = await fs.readFile(path.join(workspace, ".env"), "utf8");
        const values = vault.entries.map((entry: { rawValue: string }) => entry.rawValue);
        const valuesMatched = values.includes("BlueMango7!") && values.includes("OrangeRiver9!");
        if (!valuesMatched || status.entryCount !== 2) throw Error("VALUES_OR_COUNT_CHANGED");
        for (const name of await fs.readdir(storage)) {
            const contents = await fs.readFile(path.join(storage, name), "utf8");
            if (["BlueMango7!", "OrangeRiver9!"].some(value => contents.includes(value))) throw Error("PLAINTEXT_PERSISTED");
        }
        for (const subscription of context.subscriptions) subscription.dispose();
        reply({ ok: true, mode: input.mode, migrated, recovered, restored, entryCount: status.entryCount,
            valuesMatched, entriesSha256: sha(JSON.stringify(vault.entries.map((entry: { id: string }) => entry.id))),
            cipherSha256: sha(cipher), sourceIsOriginal: source === original,
            sourceMasked: !source.includes("BlueMango7!") && !source.includes("OrangeRiver9!"),
            pendingRecordPresent: (await fs.readdir(storage)).includes("vault-pending.json"), ciphertextContainsPlaintext: false });
    } catch (error) {
        reply({ ok: false, code: "DRILL_FAILED", errorClass: error instanceof Error ? error.name : "UNKNOWN",
            sourceLine: String(error instanceof Error ? error.stack : "").match(/soterai-vault-process-drill.worker.ts:[0-9]+:[0-9]+/)?.[0] }, 2);
    }
});
