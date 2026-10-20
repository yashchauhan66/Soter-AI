import * as vscode from "vscode";
import * as path from "node:path";
import { lstat, realpath, mkdir, open, readFile, readdir } from "node:fs/promises";
import { lstatSync, realpathSync, openSync, fstatSync, readSync, closeSync, unlinkSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { EncryptedBackupSink } from "../broker/EncryptedBackupSink";
import { verifyOutputPath } from "../security/FileSystemPathPolicy";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import type { ProjectReaderBridge } from "../project-privacy/commands";
import { safeReadMcpEnabled } from "../agent/mcpProvider";
import { CodexHttpBridge } from "./CodexHttpBridge";
import { CodexResponsesBridge } from "./CodexResponsesBridge";
import type { BrokerManager } from "../broker/BrokerManager";
import { CODEX_IDE_PIN, verifyCodexIdeArtifact, createCodexIdePlan, codexIdeDigest, codexIdeProfileCurrent, undoCodexIdeProfile,
    type CodexIdeDependencies, type CodexIdeReceipt } from "./CodexIdeAdapterPolicy";
const RECEIPT = "soterai.lite.codexIdeAdapter.receipt.v1";
interface Saved { version: 1; root: string; profileDirectory: string; receipt: CodexIdeReceipt }
interface Stamp { file: string; dev: number; ino: number; size: number; mtimeMs: number }
const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const outside = (root: string, file: string) => { const relative = path.relative(root, file); return !!relative && (path.isAbsolute(relative) || relative === ".." || relative.startsWith(".." + path.sep)); };
export function codexIdeAdapterEnabled(): boolean {
    try { const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.codexIdeAdapter");
        return (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.codexIdeAdapter", true)) === true; } catch { return false; }
}
/** Owner-only creation of a NEW dedicated home. The registered editor route
 * uses separate MCP/Responses roles and the current owned broker. It never
 * reads normal vendor profiles or launches native Codex. */
export class CodexIdeAdapter implements vscode.Disposable {
    #busy = false; #disposed = false; #bridge: CodexHttpBridge | undefined; #responses: CodexResponsesBridge | undefined;
    #lease: (() => boolean) | undefined; #abort: AbortController | undefined;
    #receipt: CodexIdeReceipt | undefined; #profile: string | undefined; #pin: Stamp[] | undefined;
    #poll: ReturnType<typeof setInterval>;
    constructor(private readonly context: vscode.ExtensionContext, private readonly reader: ProjectReaderBridge, private readonly manager: BrokerManager) {
        this.#poll = setInterval(() => { if (this.#lease && !this.#lease()) this.withdraw(); }, 250); this.#poll.unref?.();
    }
    private available(restoring = false): boolean {
        try { return !!this.manager && !this.#disposed && process.platform === "win32" && vscode.workspace.isTrusted === true
            && vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.scheme === "file"
            && (restoring || this.runtimePreferencesEligible() && codexIdeAdapterEnabled() && safeReadMcpEnabled() && this.reader.isEnabled()); } catch { return false; }
    }
    private runtimePreferencesEligible(): boolean {
        try { const config = vscode.workspace.getConfiguration("chatgpt");
            return !config.get<string | null>("cliExecutable", null)
                && config.get<boolean>("runCodexInWindowsSubsystemForLinux", false) === false
                && config.get<boolean>("useExperimentalLspMcpServer", false) === false;
        } catch { return false; }
    }
    withdraw(): void { this.#abort?.abort(); this.#lease = undefined; this.#receipt = undefined; this.#bridge?.rotate(); this.#responses?.rotate(); }
    dispose(): void { this.#disposed = true; this.withdraw(); clearInterval(this.#poll); void this.#bridge?.dispose(); void this.#responses?.dispose(); this.#bridge = undefined; this.#responses = undefined; }
    status(): object { return { status: this.#receipt && this.#lease?.() ? "CONFIGURED_RESTART_AND_ROUTE_VERIFICATION_REQUIRED" : "UNAVAILABLE",
        version: CODEX_IDE_PIN.version, badge: "Uncovered", profileDirectory: this.#profile,
        scope: this.manager ? "Dedicated text Responses and safe-read profile; output is buffered for complete inspection. Overrides, unsupported context/attachments and other profiles remain uncovered; current owner routing unverified."
            : "Dedicated vendor safe-read profile only. Provider traffic is unmediated. Native context/attachments, explicit overrides and other profiles remain uncovered; current owner routing unverified." }; }
    private async stamp(file: string): Promise<Stamp> {
        const s = await lstat(file);
        if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 || !same(await realpath(file), file)) throw Error("Unavailable");
        return { file, dev: s.dev, ino: s.ino, size: s.size, mtimeMs: s.mtimeMs };
    }
    private async bounded(file: string, maximum = 16384): Promise<Buffer> {
        const before = await this.stamp(file); if (before.size > maximum) throw Error("Unavailable");
        const bytes = await readFile(file), after = await this.stamp(file);
        if (JSON.stringify(before) !== JSON.stringify(after) || bytes.length !== before.size) throw Error("Unavailable");
        return bytes;
    }
    private async artifact():Promise<void> {
        this.#pin=undefined;
        const vendor=vscode.extensions.getExtension(CODEX_IDE_PIN.id),uri=vendor?.extensionUri,config=vscode.workspace.getConfiguration('chatgpt');
        if(!uri||uri.scheme!=='file'||uri.authority||uri.query||uri.fragment||!path.isAbsolute(uri.fsPath)
            ||config.get<string|null>('cliExecutable',null)||config.get<boolean>('runCodexInWindowsSubsystemForLinux',false)
            ||config.get<boolean>('useExperimentalLspMcpServer',false))throw Error('Unavailable');
        const files=['package.json','out/extension.js','bin/windows-x86_64/codex-package.json','bin/windows-x86_64/codex.exe'].map(relative=>path.join(uri.fsPath,relative));
        const stamps=await Promise.all(files.map(file=>this.stamp(file)));
        if(stamps[1].size!==CODEX_IDE_PIN.javascriptBytes||stamps[3].size!==CODEX_IDE_PIN.nativeBytes)throw Error('Unavailable');
        const hashFile=async(index:number):Promise<string>=>{
            const before=stamps[index],handle=await open(before.file,'r'),hash=createHash('sha256');let size=0;
            try {const opened=await handle.stat();if(!opened.isFile()||opened.ino!==before.ino||opened.nlink!==1||opened.size!==before.size)throw Error('Unavailable');
                const buffer=Buffer.alloc(65536);while(true){const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;size+=bytesRead;if(size>before.size)throw Error('Unavailable');hash.update(buffer.subarray(0,bytesRead));}
                const after=await handle.stat();if(size!==before.size||after.ino!==opened.ino||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||after.nlink!==1)throw Error('Unavailable');
            }finally{await handle.close();}return hash.digest('hex');
        };
        const [manifest,javascript,runtime,native]=await Promise.all([this.bounded(files[0],65536),hashFile(1),this.bounded(files[2],65536),hashFile(3)]);
        if(!verifyCodexIdeArtifact(manifest,javascript,runtime,native))throw Error('Unavailable');
        for(const before of stamps)if(JSON.stringify(before)!==JSON.stringify(await this.stamp(before.file)))throw Error('Unavailable');
        this.#pin=stamps;
    }
    private async artifactCurrent(): Promise<boolean> {
        try { if (!this.#pin || this.#pin.length !== 4) return false;
            const uri = vscode.extensions.getExtension(CODEX_IDE_PIN.id)?.extensionUri;
            if (!this.runtimePreferencesEligible() || !uri || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment
                || !same(path.join(uri.fsPath, "package.json"), this.#pin[0].file)) return false;
            for (const before of this.#pin) if (JSON.stringify(before) !== JSON.stringify(await this.stamp(before.file))) return false;
            return true;
        } catch { return false; }
    }
    private async projectEligible(): Promise<boolean> {
        const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
        for (const name of [".codex", ".agents"]) { try { await lstat(path.join(root, name)); return false; } catch (e) { if ((e as { code?: string }).code !== "ENOENT") return false; } }
        return true;
    }
    private directory(): string {
        const storage = this.context.globalStorageUri;
        // The actual local VS Code host supplies vscode-userdata here.
        // Admit only its authority-free local drive mapping, with no alternate
        // URI components; physical parent/file checks still precede IO.
        if (!["file", "vscode-userdata"].includes(storage.scheme) || storage.authority || storage.query || storage.fragment
            || !path.isAbsolute(storage.fsPath) || !/^[a-z]:[\\/]/i.test(storage.fsPath)
            || vscode.Uri.file(storage.fsPath).path.toLowerCase() !== storage.path.toLowerCase()
            || !outside(vscode.workspace.workspaceFolders![0].uri.fsPath, storage.fsPath)) throw Error("Unavailable");
        return path.join(storage.fsPath, "adapter-sessions");
    }
    private validProfile(directory: string): boolean {
        return path.isAbsolute(directory) && same(path.dirname(directory), this.directory()) && /^codex-ide-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(path.basename(directory));
    }
    private async parent(directory: string): Promise<void> {
        try { const s = await lstat(directory); if (!s.isDirectory() || s.isSymbolicLink() || !same(await realpath(directory), directory)) throw Error("Unavailable"); }
        catch (e) { if ((e as { code?: string }).code !== "ENOENT") throw Error("Unavailable");
            const parent = path.dirname(directory); if (same(parent, directory)) throw Error("Unavailable"); await this.parent(parent); await mkdir(directory);
            if (!same(await realpath(directory), directory)) throw Error("Unavailable"); }
    }
    private async read(file: string): Promise<string | undefined> {
        try { return new TextDecoder("utf-8", { fatal: true }).decode(await this.bounded(file)); }
        catch (e) { if ((e as { code?: string }).code === "ENOENT") return; throw Error("Unavailable"); }
    }
    /** Only exclusive creation or reviewed exact-file removal. No merge, folder
     * cleanup, recursive removal, normal-profile rewrite or subprocess launch. */
    private async write(file: string, text: string | undefined, expectedCurrentDigest?: string): Promise<void> {
        const directory = path.dirname(file);
        if (!this.validProfile(directory) || !["config.toml", "recovery.json"].includes(path.basename(file))
            || !same(await verifyOutputPath(directory, file), file)) throw Error("Unavailable");
        if (text === undefined) {
            this.removeOwned(file, expectedCurrentDigest); return;
        }
        if (Buffer.byteLength(text) > 16384) throw Error("Unavailable");
        const handle = await open(file, "wx", 0o600);
        try { const opened = await handle.stat(), current = await lstat(file);
            if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== current.ino || current.isSymbolicLink()
                || !same(await realpath(file), file)) throw Error("Unavailable");
            await handle.writeFile(text, "utf8"); await handle.sync();
        } finally { await handle.close(); }
    }
    /** Bound the final synchronous removal to the reviewed bytes, after all
     * asynchronous path checks. No await can admit a cooperative editor change
     * between this digest/identity check and unlink. This is not an OS lock or
     * protection against hostile same-user inode/timestamp manipulation. */
    private removeOwned(file: string, expected: string | undefined): void {
        if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected)) throw Error("Unavailable");
        const before = lstatSync(file);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > 16384
            || !same(realpathSync(file), file)) throw Error("Unavailable");
        const descriptor = openSync(file, "r"); let bytes: Buffer;
        try {
            const opened = fstatSync(descriptor);
            if (!opened.isFile() || opened.ino !== before.ino || opened.size !== before.size || opened.nlink !== 1) throw Error("Unavailable");
            const buffer = Buffer.alloc(16385); let size = 0;
            while (size < buffer.length) { const count = readSync(descriptor, buffer, size, buffer.length - size, null); if (!count) break; size += count; }
            const after = fstatSync(descriptor);
            if (size > 16384 || size !== before.size || after.ino !== opened.ino || after.size !== opened.size
                || after.mtimeMs !== opened.mtimeMs || after.nlink !== 1) throw Error("Unavailable");
            bytes = buffer.subarray(0, size);
        } finally { closeSync(descriptor); }
        if (codexIdeDigest(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) !== expected) throw Error("Unavailable");
        const current = lstatSync(file);
        if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || current.dev !== before.dev || current.ino !== before.ino
            || current.size !== before.size || current.mtimeMs !== before.mtimeMs
            || !same(realpathSync(path.dirname(file)), path.dirname(file)) || !same(realpathSync(file), file)) throw Error("Unavailable");
        unlinkSync(file);
    }
    private dependencies(directory: string, lease: () => boolean, owner: string): CodexIdeDependencies {
        return { enabled: lease, fingerprint: () => owner, read: () => this.read(path.join(directory, "config.toml")),
            write: (value, expected) => { if (value !== undefined && !lease()) throw Error("Unavailable"); return this.write(path.join(directory, "config.toml"), value, expected); },
            backups: new EncryptedBackupSink(this.context), prepare: async () => { throw Error("Unavailable"); },
            confirm: async preview => {
                const restoring = preview.operation === "restore", action = restoring ? "Remove reviewed Codex profile config" : "Create reviewed Codex safe-read profile";
                return await vscode.window.showWarningMessage(restoring ? "Review pinned Codex IDE profile restoration" : "Review pinned Codex IDE safe-read setup",
                    { modal: true, detail: preview.scope + "\n\n" + preview.diff.join("\n") + "\n\nDedicated CODEX_HOME: " + directory
                        + "\nStop active native sessions before changing configuration. Select this dedicated CODEX_HOME before starting a new editor/native session. The current editor may use another home. Native code-mode preferences do not establish command confinement. Restore leaves the profile unmanaged; routing remains Uncovered. No login or process launch is performed." }, action) === action;
            } };
    }
    private validateSaved(value: Saved, root: string): Saved {
        if (!value || Object.keys(value).sort().join(",") !== "profileDirectory,receipt,root,version" || value.version !== 1 || value.root !== root
            || typeof value.profileDirectory !== "string" || !this.validProfile(value.profileDirectory)) throw Error("Unavailable");
        return value;
    }
    private async saved(root: string): Promise<Saved | undefined> {
        const stored = this.context.globalState.get<Saved>(RECEIPT);
        if (stored) return this.validateSaved(stored, root);
        let names: string[]; try { names = await readdir(this.directory()); } catch (e) { if ((e as { code?: string }).code === "ENOENT") return; throw e; }
        names = names.filter(n => /^codex-ide-[a-f0-9-]{36}$/.test(n)); if (names.length > 32) throw Error("Unavailable");
        const candidates: Saved[] = [];
        for (const name of names) {
            const directory = path.join(this.directory(), name);
            // Retained recovery for an already removed config is evidence,
            // not a live profile or an owner lock for another project.
            if (await this.read(path.join(directory, "config.toml")) === undefined) continue;
            const text = await this.read(path.join(directory, "recovery.json")); if (!text) continue;
            const parsed = decodeBoundedJson(Buffer.from(text), { maxBytes: 16384, maxDepth: 8, maxNodes: 128, maxStringBytes: 2048 }).body as unknown as Saved;
            const candidate = this.validateSaved(parsed, root);
            if (!same(candidate.profileDirectory, directory)) throw Error("Unavailable");
            if (await this.read(path.join(directory, "config.toml")) !== undefined) candidates.push(candidate);
        }
        if (candidates.length > 1) throw Error("Unavailable"); return candidates[0];
    }
    async configure(): Promise<object> {
        if (this.#busy || !this.available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        try {
            const uri = vscode.workspace.workspaceFolders![0].uri, root = uri.toString();
            if (await this.saved(root)) return { status: "RESTORE_PREVIOUS_CODEX_PROFILE_FIRST" };
            await this.artifact(); if (!await this.projectEligible()) return { status: "PROJECT_CODEX_OVERRIDE_REQUIRES_REVIEW" };
            await this.parent(this.directory());
            const directory = path.join(this.directory(), "codex-ide-" + randomUUID()); await mkdir(directory); await this.parent(directory);
            this.withdraw(); if (this.#bridge) await this.#bridge.dispose(); if (this.#responses) await this.#responses.dispose(); this.#abort = new AbortController();
            const status = this.manager ? await this.manager.start() : undefined, broker = this.manager?.ownedSnapshot();
            if (this.manager && (!status?.running || broker?.state !== "healthy" || !broker.session)) return { status: "UNAVAILABLE" };
            if (this.manager) { const ack = await this.manager.request<{ version: number; enabled: boolean; ready: boolean; codexResponses: boolean }>("/v1/gateway/status");
                if (ack.version !== 1 || ack.enabled !== true || ack.ready !== true || ack.codexResponses !== true) return { status: "UNAVAILABLE" }; }
            const lease = () => { const current = this.manager?.ownedSnapshot(); return this.available() && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root
                && (!this.manager || current?.state === "healthy" && current.session === broker?.session && current.port === broker?.port); };
            const owner = createHash("sha256").update(root + "\0" + directory).digest("hex"), deps = this.dependencies(directory, lease, owner);
            this.#lease = lease; this.#profile = directory;
            const ready = async (signal: AbortSignal) => !signal.aborted && lease() && await this.artifactCurrent() && await this.projectEligible()
                && await codexIdeProfileCurrent(this.#receipt, deps) && (!this.manager || (await this.manager.status()).running) && !signal.aborted && lease();
            this.#bridge = new CodexHttpBridge({ enabled: lease, ready, read: async (file, recipient, signal) => {
                if (!await ready(signal)) return { status: "UNAVAILABLE" };
                const result = await this.reader.readIntegration(vscode.Uri.joinPath(uri, file), recipient, signal);
                return await ready(signal) ? result : { status: "CHANGED" };
            } });
            const connection = await this.#bridge.start();
            let gateway;
            if (this.manager && status && broker?.session) {
                this.#responses = new CodexResponsesBridge({ enabled: lease, ready, session: broker.session,
                    target: status.url + "/v1/ai/openai-responses/responses", credential: await this.manager.getClientToken() });
                gateway = await this.#responses.start();
            }
            const plan = createCodexIdePlan(await deps.read(), connection, gateway);
            deps.prepare = async receipt => {
                if (!lease()) throw Error("Unavailable");
                await this.write(path.join(directory, "recovery.json"), JSON.stringify({ version: 1, root, profileDirectory: directory, receipt }));
                if (!lease()) throw Error("Unavailable");
            };
            const confirm = deps.confirm; deps.confirm = async preview => {
                if (!await confirm(preview) || !lease()) return false; await this.artifact();
                return await this.projectEligible() && lease();
            };
            const result = await plan.apply(deps, this.#abort.signal);
            if ((result.status === "APPLIED" || result.status === "INCOMPLETE") && result.receipt) {
                try { await this.context.globalState.update(RECEIPT, { version: 1, root, profileDirectory: directory, receipt: result.receipt }); }
                catch { await undoCodexIdeProfile(result.receipt, { ...deps, confirm: async () => true }); this.withdraw(); return { status: "INCOMPLETE" }; }
                if (result.status === "APPLIED") this.#receipt = result.receipt; else this.withdraw();
            } else this.withdraw();
            return { status: result.status, version: CODEX_IDE_PIN.version, badge: "Uncovered", profileDirectory: directory, routeVerification: "RESTART_AND_ACTUAL_ROUTE_CHECK_REQUIRED" };
        } catch { this.withdraw(); return { status: "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
    async undo(): Promise<object> {
        if (this.#busy || !this.available(true)) return { status: "UNAVAILABLE" }; this.#busy = true; this.withdraw();
        try {
            const root = vscode.workspace.workspaceFolders![0].uri.toString(), saved = await this.saved(root);
            if (!saved) return { status: "UNAVAILABLE" };
            const lease = () => this.available(true) && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root;
            const result = await undoCodexIdeProfile(saved.receipt, this.dependencies(saved.profileDirectory, lease, saved.receipt.owner));
            if (result.status === "RESTORED") await this.context.globalState.update(RECEIPT, undefined);
            return { status: result.status, badge: "Uncovered" };
        } catch { return { status: "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
}
export function registerCodexIdeAdapter(context: vscode.ExtensionContext, reader: ProjectReaderBridge, manager: BrokerManager): void {
    const adapter = new CodexIdeAdapter(context, reader, manager);
    context.subscriptions.push(adapter,
        vscode.commands.registerCommand("soterai.configurePinnedCodexIde", async () => {
            const result = await adapter.configure() as { status: string };
            if (!["APPLIED", "CANCELLED"].includes(result.status)) void vscode.window.showWarningMessage("Codex IDE safe-read profile setup is incomplete. Review retained recovery metadata and any project overrides. Routing remains Uncovered.");
            return result;
        }), vscode.commands.registerCommand("soterai.restorePinnedCodexIde", () => adapter.undo()),
        vscode.commands.registerCommand("soterai.codexIdeAdapterStatus", () => adapter.status()),
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai") || event.affectsConfiguration("chatgpt")) adapter.withdraw(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => adapter.withdraw()));
}
