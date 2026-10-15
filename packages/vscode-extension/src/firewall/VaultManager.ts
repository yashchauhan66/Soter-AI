import * as vscode from "vscode";
import * as path from "node:path";
import { open } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { buildVaultMetadata, generateVaultKey, encryptVault, decryptVault, type VaultEntryMetadata } from "@soterai/guard-core";
import { assertWorkspaceFileUri, assertWorkspaceOutputUri } from "../security/WorkspacePathGuard";
import { BoundarySnapshot, updateRules } from "../ai-boundary/BoundarySnapshot";
import { withPendingRestriction, restrictionSaveEnabled } from "../ai-boundary/RestrictionOperation";
import { MASKED } from "../project-privacy/SafeFileView";
import { createVaultMigrationPlan } from "./VaultMigrationPlan";
import { VaultStorage, VAULT_LIMIT, readVaultFile, samePath, vaultJson, vaultObject, vaultUnavailable, missing } from "./VaultStorage";

const KEY_ID = "soterai.vaultKey", PENDING = "vault-pending.json", VAULT = "soterai-vault.enc";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
interface StoredEntry extends VaultEntryMetadata { rawValue: string; source?: string; root?: string; replacementText?: string }
interface VaultFile { version: 1 | 2; entries: StoredEntry[] }
interface Basis { source: string; root: string; text: string; identity: string; policy: string; epoch: number; ownerDamagedRecovery: boolean }
interface Issued { schemaVersion: 1; id: string; source: string; root: string; digest: string }
interface Checkpoint { schemaVersion: 1; id: string; source: string; root: string; original: string; masked: string; example: string;
    identity: string; vaultBefore: string | null; vaultAfter: string; count: number }
export interface VaultStatus { exists: boolean; location: string; entryCount: number; entries: Array<Omit<VaultEntryMetadata, "hash" | "id">> }
export interface MigrationPreview { file: string; candidates: Array<{ key: string; type: string; placeholder: string; redactedPreview: string }> }

export function vaultModeEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.vaultMode");
        return vscode.workspace.isTrusted && (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.vaultMode", true)) === true;
    } catch { return false; }
}
function keyValid(key: unknown): key is string {
    return typeof key === "string" && /^[A-Za-z0-9+/]{43}=$/.test(key) && Buffer.from(key, "base64").length === 32 && Buffer.from(key, "base64").toString("base64") === key;
}
function parseVault(text: string): VaultFile {
    const value = vaultObject(vaultJson(text), ["version", "entries"]);
    if (![1, 2].includes(value.version as number) || !Array.isArray(value.entries) || value.entries.length > 4096) return vaultUnavailable();
    const entries = value.entries.map(entry => {
        const data = vaultObject(entry, ["id", "key", "type", "originalFile", "placeholder", "createdAt", "hash", "rawValue", "source", "root", "replacementText"],
            ["id", "key", "type", "originalFile", "placeholder", "createdAt", "hash", "rawValue"]);
        for (const field of Object.keys(data)) if (typeof data[field] !== "string" || Buffer.byteLength(data[field] as string, "utf8") > 65536) return vaultUnavailable();
        if (!/^[a-f0-9]{64}$/i.test(data.hash as string) || !/^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/.test(data.placeholder as string)
            || !data.id || !data.key || !data.type || !data.originalFile || !Number.isFinite(Date.parse(data.createdAt as string))) return vaultUnavailable();
        if (data.source !== undefined && (typeof data.root !== "string" || typeof data.replacementText !== "string")) return vaultUnavailable();
        return data as unknown as StoredEntry;
    });
    return { version: value.version as 1 | 2, entries };
}

/** Optional owner-reviewed migration. SecretStorage API availability is not OS
 * custody certification or isolation from other same-user software. */
export class VaultManager {
    private static mutationQueue: Promise<void> = Promise.resolve();
    private readonly storage: VaultStorage;
    private epoch = 0;
    constructor(private readonly context: vscode.ExtensionContext) {
        // Desktop VS Code exposes profile global storage as vscode-userdata;
        // its native storage implementation maps that trusted URI to file.
        this.storage = new VaultStorage(context.globalStorageUri.with({ scheme: "file" }).fsPath);
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) this.epoch++; }));
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => { this.epoch++; }));
    }
    private alive(epoch?: number): void {
        const storage = this.context.globalStorageUri;
        if (!vaultModeEnabled() || !["file", "vscode-userdata"].includes(storage.scheme) || storage.scheme === "vscode-userdata" && !!vscode.env.remoteName || storage.authority
            || this.context.globalStorageUri.query || this.context.globalStorageUri.fragment || epoch !== undefined && epoch !== this.epoch) return vaultUnavailable();
    }
    private async capture(uri: vscode.Uri, ownerDamagedRecovery = false): Promise<Basis> {
        this.alive();
        if (!(uri instanceof vscode.Uri) || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment) return vaultUnavailable();
        const folder = vscode.workspace.getWorkspaceFolder(uri); if (!folder || folder.uri.scheme !== "file") return vaultUnavailable();
        const root = folder.uri.toString(), epoch = this.epoch;
        if (!samePath(await assertWorkspaceFileUri(uri), uri.fsPath)) return vaultUnavailable();
        const policy = (await BoundarySnapshot.load()).accessRevision(uri); if (!policy) return vaultUnavailable();
        const result = await readVaultFile(uri.fsPath, 65536, ownerDamagedRecovery);
        if (!samePath(await assertWorkspaceFileUri(uri), uri.fsPath) || (await BoundarySnapshot.load()).accessRevision(uri) !== policy
            || vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== root) return vaultUnavailable();
        this.alive(epoch);
        if (ownerDamagedRecovery) {
            // Refuse existing source editors during damaged-byte disclosure;
            // never introduce a raw TextDocument to recover an original.
            if (vscode.workspace.textDocuments.some(document => document.uri.toString() === uri.toString())) return vaultUnavailable();
        } else this.assertDocumentReady(uri, result.text);
        return { source: uri.toString(), root, ...result, policy, epoch, ownerDamagedRecovery };
    }
    private async fresh(uri: vscode.Uri, basis: Basis, expected = basis.text): Promise<Basis> {
        this.alive(basis.epoch); const current = await this.capture(uri, basis.ownerDamagedRecovery);
        if (current.source !== basis.source || current.root !== basis.root || current.policy !== basis.policy || current.text !== expected
            || expected === basis.text && current.identity !== basis.identity) return vaultUnavailable();
        return current;
    }
    private async key(create: boolean): Promise<string> {
        let key = await this.context.secrets.get(KEY_ID);
        if (!key && create) {
            if (await this.storage.read(VAULT) !== undefined || await this.storage.read(PENDING, 16384) !== undefined || await this.storage.hasGenerations()) return vaultUnavailable();
            key = generateVaultKey(); await this.context.secrets.store(KEY_ID, key);
        }
        if (!keyValid(key) || await this.context.secrets.get(KEY_ID) !== key) return vaultUnavailable();
        return key;
    }
    private async vault(key?: string): Promise<{ text: string | null; data: VaultFile }> {
        const text = await this.storage.read(VAULT); if (text === undefined) return { text: null, data: { version: 2, entries: [] } };
        return { text, data: parseVault(await decryptVault(text, key ?? await this.key(false))) };
    }
    private pointer(uri: vscode.Uri): string { return "vault-source-" + digest(uri.toString()).slice(0, 32) + ".json"; }
    private issued(text: string): Issued {
        const data = vaultObject(vaultJson(text), ["schemaVersion", "id", "source", "root", "digest"]);
        if (data.schemaVersion !== 1 || typeof data.id !== "string" || !UUID.test(data.id) || typeof data.source !== "string"
            || typeof data.root !== "string" || typeof data.digest !== "string" || !/^[a-f0-9]{64}$/.test(data.digest)) return vaultUnavailable();
        return data as unknown as Issued;
    }
    private async checkpoint(uri: vscode.Uri, root: string, pointer: string): Promise<Checkpoint> {
        const record = this.issued(pointer); if (record.source !== uri.toString() || record.root !== root) return vaultUnavailable();
        const cipher = await this.storage.read("vault-generation-" + record.id + ".enc");
        if (!cipher || digest(cipher) !== record.digest) return vaultUnavailable();
        const value = vaultObject(vaultJson(await decryptVault(cipher, await this.key(false))),
            ["schemaVersion", "id", "source", "root", "original", "masked", "example", "identity", "vaultBefore", "vaultAfter", "count"]);
        if (value.schemaVersion !== 1 || value.id !== record.id || value.source !== record.source || value.root !== record.root
            || !Number.isSafeInteger(value.count) || (value.count as number) < 1 || (value.count as number) > 256
            || value.vaultBefore !== null && typeof value.vaultBefore !== "string" || typeof value.vaultAfter !== "string") return vaultUnavailable();
        for (const field of ["original", "masked", "example", "identity"]) if (typeof value[field] !== "string" || Buffer.byteLength(value[field] as string, "utf8") > 65536) return vaultUnavailable();
        if ((value.example as string).split("\n").some(line => line && !/^[A-Za-z_][A-Za-z0-9_]{0,127}=$/.test(line))) return vaultUnavailable();
        parseVault(await decryptVault(value.vaultAfter as string, await this.key(false)));
        return value as unknown as Checkpoint;
    }
    private async noPending(): Promise<void> { if (await this.storage.read(PENDING, 16384) !== undefined) return vaultUnavailable(); }
    private async protect(uri: vscode.Uri, basis: Basis): Promise<Basis> {
        if (!restrictionSaveEnabled()) return vaultUnavailable();
        const folder = vscode.workspace.getWorkspaceFolder(uri); if (!folder || folder.uri.toString() !== basis.root) return vaultUnavailable();
        const pattern = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, "/").normalize("NFC");
        await updateRules(basis.root, rules => ({ ...rules, paths: [...rules.paths, { kind: "file", pattern, sensitive: true }] }));
        const current = await this.capture(uri); this.alive(basis.epoch);
        if (current.source !== basis.source || current.root !== basis.root || current.text !== basis.text || current.identity !== basis.identity) return vaultUnavailable();
        return current;
    }
    private exampleUri(uri: vscode.Uri): vscode.Uri { return vscode.Uri.joinPath(uri, "..", ".env.example"); }
    private async checkExample(uri: vscode.Uri, expected: string): Promise<void> {
        if (!expected) return;
        const example = this.exampleUri(uri); if (example.toString() === uri.toString()) return vaultUnavailable();
        await assertWorkspaceOutputUri(example);
        try { if ((await readVaultFile(example.fsPath)).text !== expected) return vaultUnavailable(); }
        catch (error) { if (!missing(error)) throw error; }
    }
    private async writeExample(uri: vscode.Uri, text: string, key: string): Promise<void> {
        if (!text) return; await this.checkExample(uri, text); const target = this.exampleUri(uri);
        try { const existing = await readVaultFile(target.fsPath); if (existing.text === text) return; return vaultUnavailable(); }
        catch (error) { if (!missing(error)) throw error; }
        await assertWorkspaceOutputUri(target); if (await this.key(false) !== key) return vaultUnavailable(); this.alive();
        const handle = await open(target.fsPath, "wx", 0o600);
        try { await handle.writeFile(text, "utf8"); await handle.sync(); } finally { await handle.close(); }
        if ((await readVaultFile(target.fsPath)).text !== text) return vaultUnavailable();
    }
    private async writeSource(uri: vscode.Uri, basis: Basis, next: string, key: string): Promise<void> {
        await this.fresh(uri, basis);
        if (await this.key(false) !== key) return vaultUnavailable(); this.alive(basis.epoch);
        // Never create an original TextDocument. Existing pristine buffers must
        // refresh from disk; dirty/stale buffers are withheld before every write.
        const document = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
        if (document) {
            const edit = new vscode.WorkspaceEdit(), version = document.version;
            edit.replace(uri, new vscode.Range(document.positionAt(0), document.positionAt(basis.text.length)), next);
            if (!await vscode.workspace.applyEdit(edit) || document.getText() !== next || document.version !== version + 1) return vaultUnavailable();
            this.alive(basis.epoch);
            const disk = await readVaultFile(uri.fsPath);
            if (disk.identity !== basis.identity || disk.text !== basis.text || vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== basis.root
                || (await BoundarySnapshot.load()).accessRevision(uri) !== basis.policy) return vaultUnavailable();
            if (await this.key(false) !== key) return vaultUnavailable();
            this.alive(basis.epoch); if (document.getText() !== next || !await document.save()) return vaultUnavailable();
        } else await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
        const handle = await open(uri.fsPath, "r+"); try { await handle.sync(); } finally { await handle.close(); }
        this.alive(basis.epoch);
        if (!samePath(await assertWorkspaceFileUri(uri), uri.fsPath) || (await readVaultFile(uri.fsPath)).text !== next
            || vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== basis.root || (await BoundarySnapshot.load()).accessRevision(uri) !== basis.policy) return vaultUnavailable();
    }
    async preview(uri: vscode.Uri): Promise<MigrationPreview> {
        const basis = await this.capture(uri), plan = createVaultMigrationPlan(basis.text, /^\.env(?:\..*)?$/i.test(path.basename(uri.fsPath)), randomUUID());
        return { file: vscode.workspace.asRelativePath(uri), candidates: plan.candidates.map(({ key, type, placeholder }) => ({ key, type, placeholder, redactedPreview: MASKED })) };
    }
    async status(): Promise<VaultStatus> {
        const vault = await this.vault(), roots = new Set((vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.toString()));
        const entries = vault.data.entries.filter(entry => !entry.root || roots.has(entry.root)).map(entry => ({ key: entry.key, type: entry.type,
            originalFile: entry.originalFile, placeholder: entry.placeholder, createdAt: entry.createdAt }));
        return { exists: vault.text !== null, location: path.join(this.storage.directory, VAULT), entryCount: entries.length, entries };
    }
    async knownPlaceholders(): Promise<string[]> { return [...new Set((await this.vault()).data.entries.map(entry => entry.placeholder))]; }
    async migrate(uri: vscode.Uri): Promise<number> {
        return this.mutation(async () => {
            let basis = await this.capture(uri); await this.noPending();
            const id = randomUUID(), plan = createVaultMigrationPlan(basis.text, /^\.env(?:\..*)?$/i.test(path.basename(uri.fsPath)), id);
            if (!plan.candidates.length) return 0; await this.checkExample(uri, plan.exampleText);
            const detail = JSON.stringify({ file: vscode.workspace.asRelativePath(uri), count: plan.candidates.length, values: MASKED,
                keys: plan.candidates.map(candidate => candidate.key), protection: "Add a permanent sensitive deny", example: "Unique names and empty values only",
                recovery: "Encrypted outside this project", appBehavior: "Applications reading this file receive placeholders; review application secret setup before migrating",
                limitations: "Other copies, history and same-user access remain outside migration" }, null, 2);
            if (await vscode.window.showWarningMessage("Move these values into the encrypted vault and replace them with placeholders?", { modal: true, detail }, "Migrate securely") !== "Migrate securely") return 0;
            await this.fresh(uri, basis); await this.checkExample(uri, plan.exampleText);
            return this.storage.lock(async () => {
                await this.noPending(); const key = await this.key(true); await this.fresh(uri, basis);
                const prior = await this.vault(key); await this.fresh(uri, basis);
                const entries = [...prior.data.entries];
                for (const candidate of plan.candidates) entries.push({ ...await buildVaultMetadata(candidate, vscode.workspace.asRelativePath(uri)),
                    rawValue: candidate.rawValue, replacementText: candidate.replacementText, source: basis.source, root: basis.root });
                if (entries.length > 4096) return vaultUnavailable();
                const vaultAfter = await encryptVault(JSON.stringify({ version: 2, entries }), key); if (Buffer.byteLength(vaultAfter) > VAULT_LIMIT / 2) return vaultUnavailable();
                await this.fresh(uri, basis); await this.checkExample(uri, plan.exampleText); basis = await this.protect(uri, basis);
                return withPendingRestriction(basis.root, async () => {
                    const checkpoint: Checkpoint = { schemaVersion: 1, id, source: basis.source, root: basis.root, original: basis.text, masked: plan.maskedText,
                        example: plan.exampleText, identity: basis.identity, vaultBefore: prior.text, vaultAfter, count: plan.candidates.length };
                    const encrypted = await encryptVault(JSON.stringify(checkpoint), key);
                    await this.fresh(uri, basis); if (await this.context.secrets.get(KEY_ID) !== key) return vaultUnavailable();
                    await this.storage.write("vault-generation-" + id + ".enc", encrypted, true);
                    const record: Issued = { schemaVersion: 1, id, source: basis.source, root: basis.root, digest: digest(encrypted) }, pointer = JSON.stringify(record);
                    await this.fresh(uri, basis); await this.storage.write(PENDING, pointer, true);
                    await this.complete(uri, basis, checkpoint, pointer, key); return plan.candidates.length;
                });
            });
        });
    }
    private async complete(uri: vscode.Uri, basis: Basis, checkpoint: Checkpoint, pointer: string, key: string): Promise<void> {
        await this.checkExample(uri, checkpoint.example); const current = await this.capture(uri); this.alive(basis.epoch);
        if (current.source !== checkpoint.source || current.root !== checkpoint.root || current.policy !== basis.policy
            || ![checkpoint.original, checkpoint.masked].includes(current.text)
            || current.text === checkpoint.original && current.identity !== checkpoint.identity) return vaultUnavailable();
        const vault = await this.storage.read(VAULT) ?? null;
        if (vault !== checkpoint.vaultBefore && vault !== checkpoint.vaultAfter || await this.context.secrets.get(KEY_ID) !== key) return vaultUnavailable();
        await this.fresh(uri, current);
        if (vault !== checkpoint.vaultAfter) { await this.storage.write(VAULT, checkpoint.vaultAfter); await this.fresh(uri, current); }
        if (current.text !== checkpoint.masked) await this.writeSource(uri, current, checkpoint.masked, key);
        this.alive(basis.epoch);
        const masked = await this.capture(uri); if (masked.text !== checkpoint.masked || masked.root !== basis.root || masked.policy !== basis.policy) return vaultUnavailable();
        await this.writeExample(uri, checkpoint.example, key); await this.fresh(uri, masked);
        if (await this.storage.read(VAULT) !== checkpoint.vaultAfter || await this.context.secrets.get(KEY_ID) !== key) return vaultUnavailable();
        await this.storage.write(this.pointer(uri), pointer); await this.fresh(uri, masked); await this.storage.remove(PENDING, pointer);
    }
    async recoverMigration(uri: vscode.Uri): Promise<boolean> {
        return this.mutation(async () => {
            let basis = await this.capture(uri); const pointer = await this.storage.read(PENDING, 16384); if (!pointer) return false;
            const checkpoint = await this.checkpoint(uri, basis.root, pointer);
            if (![checkpoint.original, checkpoint.masked].includes(basis.text)) return vaultUnavailable();
            if (await vscode.window.showWarningMessage("Complete this interrupted migration with masked placeholders and a safe example? Original values stay encrypted.",
                { modal: true, detail: JSON.stringify({ file: vscode.workspace.asRelativePath(uri), count: checkpoint.count, values: MASKED }) }, "Complete safe recovery") !== "Complete safe recovery") return false;
            await this.fresh(uri, basis);
            return this.storage.lock(async () => {
                if (await this.storage.read(PENDING, 16384) !== pointer) return vaultUnavailable();
                const key = await this.key(false); await this.fresh(uri, basis); basis = await this.protect(uri, basis);
                await withPendingRestriction(basis.root, () => this.complete(uri, basis, checkpoint, pointer, key)); return true;
            });
        });
    }
    async restore(uri: vscode.Uri): Promise<number> {
        return this.mutation(async () => {
            const basis = await this.capture(uri); await this.noPending(); const vault = await this.vault();
            const entries = vault.data.entries.filter(entry => entry.source === basis.source && entry.root === basis.root && basis.text.includes(entry.placeholder));
            if (!entries.length) return 0; if (!await this.disclosure(uri)) return 0; await this.fresh(uri, basis);
            return this.storage.lock(async () => {
                await this.noPending(); await this.fresh(uri, basis); const key = await this.key(false);
                if ((await this.vault(key)).text !== vault.text) return vaultUnavailable();
                let next = basis.text; for (const entry of entries) next = next.split(entry.placeholder).join(entry.replacementText!);
                if (Buffer.byteLength(next, "utf8") > 65536) return vaultUnavailable();
                await withPendingRestriction(basis.root, () => this.writeSource(uri, basis, next, key)); return entries.length;
            });
        });
    }
    async restoreFromBackup(uri: vscode.Uri): Promise<boolean> {
        try {
            return await this.mutation(async () => {
                const basis = await this.capture(uri, true), pending = await this.storage.read(PENDING, 16384);
                const pointer = pending ?? await this.storage.read(this.pointer(uri), 16384); if (!pointer) return false;
                const checkpoint = await this.checkpoint(uri, basis.root, pointer);
                if (!await this.disclosure(uri)) return false; await this.fresh(uri, basis);
                return this.storage.lock(async () => {
                    const key = await this.key(false); await this.checkpoint(uri, basis.root, pointer);
                    if (pending) {
                        if (await this.storage.read(PENDING, 16384) !== pointer) return vaultUnavailable();
                        const vault = await this.storage.read(VAULT) ?? null;
                        if (vault !== checkpoint.vaultBefore && vault !== checkpoint.vaultAfter) return vaultUnavailable();
                    } else { await this.noPending(); if (await this.storage.read(this.pointer(uri), 16384) !== pointer) return vaultUnavailable(); }
                    await withPendingRestriction(basis.root, () => this.writeSource(uri, basis, checkpoint.original, key));
                    if (pending) {
                        const vault = await this.storage.read(VAULT) ?? null;
                        if (vault !== checkpoint.vaultBefore && vault !== checkpoint.vaultAfter) return vaultUnavailable();
                        await this.key(false); await this.storage.write(this.pointer(uri), pointer); await this.storage.remove(PENDING, pointer);
                    }
                    return true;
                });
            });
        } catch { return false; }
    }
    private async disclosure(uri: vscode.Uri): Promise<boolean> {
        return await vscode.window.showWarningMessage("Restore raw values into this project file? AI tools and other same-user software may read them. Saved restrictions remain; this disclosure cannot recall other copies.",
            { modal: true, detail: JSON.stringify({ file: vscode.workspace.asRelativePath(uri), values: MASKED }) }, "Restore raw values") === "Restore raw values";
    }
    async writeEnvExample(uri: vscode.Uri): Promise<vscode.Uri> {
        return this.mutation(async () => {
            const basis = await this.capture(uri); await this.noPending(); const plan = createVaultMigrationPlan(basis.text, true, randomUUID());
            await this.checkExample(uri, plan.exampleText); await this.fresh(uri, basis);
            return this.storage.lock(async () => {
                await this.noPending(); const key = await this.key(true); await this.fresh(uri, basis);
                await this.writeExample(uri, plan.exampleText, key); await this.fresh(uri, basis); return this.exampleUri(uri);
            });
        });
    }
    private async mutation<T>(operation: () => Promise<T>): Promise<T> {
        const result = VaultManager.mutationQueue.then(async () => { this.alive(); return operation(); });
        VaultManager.mutationQueue = result.then(() => undefined, () => undefined);
        try { return await result; } catch { return vaultUnavailable(); }
    }
    private assertDocumentReady(uri: vscode.Uri, text: string): void {
        const document = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
        if (document && (document.isDirty || document.getText() !== text)) return vaultUnavailable();
    }
}
