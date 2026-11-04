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
import { GeminiHttpBridge } from "./GeminiHttpBridge";
import { GeminiGenerateContentBridge } from "./GeminiGenerateContentBridge";
import type { BrokerManager } from "../broker/BrokerManager";
import { createGeminiCliPlan, geminiCliDigest, geminiCliProfileCurrent, undoGeminiCliProfile,
    type GeminiCliDependencies, type GeminiCliReceipt, type GeminiCliProfile } from "./GeminiCliAdapterPolicy";
import { GEMINI_CLI_PIN, verifyInstalledGeminiCli, geminiStampsCurrent, type GeminiStamp } from "./GeminiCliRuntimePin";
const RECEIPT = "soterai.lite.geminiCliAdapter.receipt.v1";
interface Saved { version: 1; root: string; profileDirectory: string; receipt: GeminiCliReceipt }
interface Stamp { file: string; dev: number; ino: number; size: number; mtimeMs: number }
const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const outside = (root: string, file: string) => { const relative = path.relative(root, file); return !!relative && (path.isAbsolute(relative) || relative === ".." || relative.startsWith(".." + path.sep)); };
export function geminiCliAdapterEnabled(): boolean {
    try { const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.geminiCliAdapter");
        return (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.geminiCliAdapter", true)) === true; } catch { return false; }
}
/** Owner-only creation of a NEW dedicated home. The registered editor route
 * uses separate MCP/GenerateContent roles and the current owned broker. It never
 * reads normal vendor profiles or launches native Gemini. */
export class GeminiCliAdapter implements vscode.Disposable {
    #busy = false; #disposed = false; #bridge: GeminiHttpBridge | undefined; #responses: GeminiGenerateContentBridge | undefined;
    #lease: (() => boolean) | undefined; #abort: AbortController | undefined;
    #receipt: GeminiCliReceipt | undefined; #profile: string | undefined; #pin: GeminiStamp[] | undefined;
    #poll: ReturnType<typeof setInterval>;
    constructor(private readonly context: vscode.ExtensionContext, private readonly reader: ProjectReaderBridge, private readonly manager?: BrokerManager) {
        this.#poll = setInterval(() => { if (this.#lease && !this.#lease()) this.withdraw(); }, 250); this.#poll.unref?.();
    }
    private available(restoring = false): boolean {
        try { return !this.#disposed && process.platform === "win32" && vscode.workspace.isTrusted === true
            && vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.scheme === "file"
            && (restoring || !!this.manager && geminiCliAdapterEnabled() && safeReadMcpEnabled() && this.reader.isEnabled()); } catch { return false; }
    }
    withdraw(): void { this.#abort?.abort(); this.#lease = undefined; this.#receipt = undefined; this.#bridge?.rotate(); this.#responses?.rotate(); }
    dispose(): void { this.#disposed = true; this.withdraw(); clearInterval(this.#poll); void this.#bridge?.dispose(); void this.#responses?.dispose(); this.#bridge = undefined; this.#responses = undefined; }
    status(): object { return { status: this.#receipt && this.#lease?.() ? "CONFIGURED_RESTART_AND_ROUTE_VERIFICATION_REQUIRED" : "UNAVAILABLE",
        version: GEMINI_CLI_PIN.version, badge: "Uncovered", profileDirectory: this.#profile,
        scope: this.manager ? "Dedicated stateless text GenerateContent and safe-read profile; output is buffered for complete inspection. Explicit launch home/system-settings/env selection required; inherited/project/argv overrides, native reads, opaque signatures/media/state and other profiles remain uncovered; current owner routing unverified."
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
    private async artifact(): Promise<void> { this.#pin = undefined; this.#pin = await verifyInstalledGeminiCli(); }
    private async artifactCurrent(): Promise<boolean> { return !!this.#pin && await geminiStampsCurrent(this.#pin); }
    private async projectEligible(): Promise<boolean> {
        const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
        for (const name of [".gemini"]) { try { await lstat(path.join(root, name)); return false; } catch (e) { if ((e as { code?: string }).code !== "ENOENT") return false; } }
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
        return path.isAbsolute(directory) && same(path.dirname(directory), this.directory()) && /^gemini-cli-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(path.basename(directory));
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
        const parent = path.dirname(file), directory = path.basename(file) === "recovery.json" ? parent : path.dirname(parent);
        if (!this.validProfile(directory) || ![path.join(directory, "recovery.json"), path.join(directory, ".gemini", "settings.json"), path.join(directory, ".gemini", ".env")].some(p => same(p, file))
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
        if (createHash("sha256").update(bytes).digest("hex") !== expected) throw Error("Unavailable");
        const current = lstatSync(file);
        if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || current.dev !== before.dev || current.ino !== before.ino
            || current.size !== before.size || current.mtimeMs !== before.mtimeMs
            || !same(realpathSync(path.dirname(file)), path.dirname(file)) || !same(realpathSync(file), file)) throw Error("Unavailable");
        unlinkSync(file);
    }
    private async readProfile(directory: string): Promise<GeminiCliProfile | undefined> {
        const settings = await this.read(path.join(directory, ".gemini", "settings.json")), environment = await this.read(path.join(directory, ".gemini", ".env"));
        return settings === undefined && environment === undefined ? undefined : { settings, environment };
    }
    private async writeProfile(directory: string, value: GeminiCliProfile | undefined, expected?: string): Promise<void> {
        const settings = path.join(directory, ".gemini", "settings.json"), environment = path.join(directory, ".gemini", ".env");
        if (value !== undefined) {
            if (typeof value.settings !== "string" || typeof value.environment !== "string") throw Error("Unavailable");
            await this.write(settings, value.settings);
            try { await this.write(environment, value.environment); }
            catch (e) { try { await this.write(settings, undefined, createHash("sha256").update(value.settings).digest("hex")); } catch { /* Preserve uncertainty. */ } throw e; }
            return;
        }
        const current = await this.readProfile(directory);
        if (!current || geminiCliDigest(current) !== expected) throw Error("Unavailable");
        // Validate both members before removing either; each final removal also
        // binds bytes and identity synchronously. Partial failures retain receipt.
        for (const [file, content] of [[settings, current.settings], [environment, current.environment]] as const)
            if (content !== undefined && !same(await verifyOutputPath(directory, file), file)) throw Error("Unavailable");
        if (geminiCliDigest(await this.readProfile(directory)) !== expected) throw Error("Unavailable");
        for (const [file, content] of [[settings, current.settings], [environment, current.environment]] as const)
            if (content !== undefined) this.removeOwned(file, createHash("sha256").update(content).digest("hex"));
    }
    private dependencies(directory: string, lease: () => boolean, owner: string): GeminiCliDependencies {
        return { enabled: lease, fingerprint: () => owner, read: () => this.readProfile(directory),
            write: (value, expected) => { if (value !== undefined && !lease()) throw Error("Unavailable"); return this.writeProfile(directory, value, expected); },
            backups: new EncryptedBackupSink(this.context), prepare: async () => { throw Error("Unavailable"); },
            confirm: async preview => {
                const restoring = preview.operation === "restore", action = restoring ? "Remove reviewed Gemini profile config" : "Create reviewed Gemini safe-read profile";
                return await vscode.window.showWarningMessage(restoring ? "Review pinned Gemini CLI profile restoration" : "Review pinned Gemini CLI safe-read setup",
                    { modal: true, detail: preview.scope + "\n\n" + preview.diff.join("\n") + "\n\nDedicated GEMINI_CLI_HOME: " + directory
                        + "\nStop active native sessions before changing configuration. Select this dedicated home and curated HOME/system-settings/env variables before startup; home dotenv loads late and inherited variables win. Restore leaves the profile unmanaged; routing remains Uncovered. No login or process launch is performed." }, action) === action;
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
        names = names.filter(n => /^gemini-cli-[a-f0-9-]{36}$/.test(n)); if (names.length > 32) throw Error("Unavailable");
        const candidates: Saved[] = [];
        for (const name of names) {
            const directory = path.join(this.directory(), name);
            // Retained recovery for an already removed config is evidence,
            // not a live profile or an owner lock for another project.
            if (await this.readProfile(directory) === undefined) continue;
            const text = await this.read(path.join(directory, "recovery.json")); if (!text) continue;
            const parsed = decodeBoundedJson(Buffer.from(text), { maxBytes: 16384, maxDepth: 8, maxNodes: 128, maxStringBytes: 2048 }).body as unknown as Saved;
            const candidate = this.validateSaved(parsed, root);
            if (!same(candidate.profileDirectory, directory)) throw Error("Unavailable");
            if (await this.readProfile(directory) !== undefined) candidates.push(candidate);
        }
        if (candidates.length > 1) throw Error("Unavailable"); return candidates[0];
    }
    async configure(): Promise<object> {
        if (this.#busy || !this.available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        try {
            const uri = vscode.workspace.workspaceFolders![0].uri, root = uri.toString();
            if (await this.saved(root)) return { status: "RESTORE_PREVIOUS_GEMINI_PROFILE_FIRST" };
            await this.artifact(); if (!await this.projectEligible()) return { status: "PROJECT_GEMINI_OVERRIDE_REQUIRES_REVIEW" };
            await this.parent(this.directory());
            const directory = path.join(this.directory(), "gemini-cli-" + randomUUID()); await mkdir(directory); await this.parent(directory); await this.parent(path.join(directory, ".gemini"));
            this.withdraw(); if (this.#bridge) await this.#bridge.dispose(); if (this.#responses) await this.#responses.dispose(); this.#abort = new AbortController();
            const status = this.manager ? await this.manager.start() : undefined, broker = this.manager?.ownedSnapshot();
            if (this.manager && (!status?.running || broker?.state !== "healthy" || !broker.session)) return { status: "UNAVAILABLE" };
            if (this.manager) { const ack = await this.manager.request<{ version: number; enabled: boolean; ready: boolean; geminiGenerateContent: boolean }>("/v1/gateway/status");
                if (ack.version !== 1 || ack.enabled !== true || ack.ready !== true || ack.geminiGenerateContent !== true) return { status: "UNAVAILABLE" }; }
            const lease = () => { const current = this.manager?.ownedSnapshot(); return this.available() && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root
                && (!this.manager || current?.state === "healthy" && current.session === broker?.session && current.port === broker?.port); };
            const owner = createHash("sha256").update(root + "\0" + directory).digest("hex"), deps = this.dependencies(directory, lease, owner);
            this.#lease = lease; this.#profile = directory;
            const ready = async (signal: AbortSignal) => !signal.aborted && lease() && await this.artifactCurrent() && await this.projectEligible()
                && await geminiCliProfileCurrent(this.#receipt, deps) && (!this.manager || (await this.manager.status()).running) && !signal.aborted && lease();
            this.#bridge = new GeminiHttpBridge({ enabled: lease, ready, read: async (file, recipient, signal) => {
                if (!await ready(signal)) return { status: "UNAVAILABLE" };
                const result = await this.reader.readIntegration(vscode.Uri.joinPath(uri, file), recipient, signal);
                return await ready(signal) ? result : { status: "CHANGED" };
            } });
            const connection = await this.#bridge.start();
            let gateway;
            if (this.manager && status && broker?.session) {
                this.#responses = new GeminiGenerateContentBridge({ enabled: lease, ready, session: broker.session,
                    target: status.url + "/v1/ai/gemini/generate-content", credential: await this.manager.getClientToken() });
                gateway = await this.#responses.start();
            }
            if (!gateway) throw Error("Unavailable");
            const plan = createGeminiCliPlan(await deps.read(), connection, gateway);
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
                catch { await undoGeminiCliProfile(result.receipt, { ...deps, confirm: async () => true }); this.withdraw(); return { status: "INCOMPLETE" }; }
                if (result.status === "APPLIED") this.#receipt = result.receipt; else this.withdraw();
            } else this.withdraw();
            return { status: result.status, version: GEMINI_CLI_PIN.version, badge: "Uncovered", profileDirectory: directory, routeVerification: "RESTART_AND_ACTUAL_ROUTE_CHECK_REQUIRED" };
        } catch { this.withdraw(); return { status: "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
    async undo(): Promise<object> {
        if (this.#busy || !this.available(true)) return { status: "UNAVAILABLE" }; this.#busy = true; this.withdraw();
        try {
            const root = vscode.workspace.workspaceFolders![0].uri.toString(), saved = await this.saved(root);
            if (!saved) return { status: "UNAVAILABLE" };
            const lease = () => this.available(true) && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root;
            const result = await undoGeminiCliProfile(saved.receipt, this.dependencies(saved.profileDirectory, lease, saved.receipt.owner));
            if (result.status === "RESTORED") await this.context.globalState.update(RECEIPT, undefined);
            return { status: result.status, badge: "Uncovered" };
        } catch { return { status: "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
}
export function registerGeminiCliAdapter(context: vscode.ExtensionContext, reader: ProjectReaderBridge, manager?: BrokerManager): void {
    const adapter = new GeminiCliAdapter(context, reader, manager);
    context.subscriptions.push(adapter,
        vscode.commands.registerCommand("soterai.configurePinnedGeminiCli", async () => {
            const result = await adapter.configure() as { status: string };
            if (!["APPLIED", "CANCELLED"].includes(result.status)) void vscode.window.showWarningMessage("Gemini CLI safe-read profile setup is incomplete. Review retained recovery metadata and any project overrides. Routing remains Uncovered.");
            return result;
        }), vscode.commands.registerCommand("soterai.restorePinnedGeminiCli", () => adapter.undo()),
        vscode.commands.registerCommand("soterai.geminiCliAdapterStatus", () => adapter.status()),
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) adapter.withdraw(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => adapter.withdraw()));
}
