import * as vscode from "vscode";
import * as path from "node:path";
import { homedir } from "node:os";
import { lstat, readFile, realpath, mkdir, open, rename, unlink, readdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { BrokerManager } from "../broker/BrokerManager";
import { EncryptedBackupSink } from "../broker/EncryptedBackupSink";
import type { ProjectReaderBridge } from "../project-privacy/commands";
import { safeReadMcpEnabled } from "../agent/mcpProvider";
import { verifyOutputPath } from "../security/FileSystemPathPolicy";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import { ClaudeHttpBridge } from "./ClaudeHttpBridge";
import { CLAUDE_PIN, verifyClaudeArtifact, createClaudePlan, claudeFilesCurrent, undoClaudeFiles,
    type ClaudeFileKey, type ClaudeReceipt, type ClaudeDependencies } from "./ClaudeAdapterPolicy";

const RECEIPT = "soterai.lite.claudeAdapter.receipt.v1";
interface SavedReceipt { version: 1; root: string; paths: Record<ClaudeFileKey, string>; receipt: ClaudeReceipt }
interface ArtifactStamp { file: string; dev: number; ino: number; size: number; mtimeMs: number }
export function claudeAdapterEnabled(): boolean {
    try { const config = vscode.workspace.getConfiguration("soterai"), entry = config.inspect<boolean>("lite.claudeAdapter");
        return (entry ? entry.globalValue ?? entry.defaultValue ?? true : config.get("lite.claudeAdapter", true)) === true; } catch { return false; }
}
const same = (left: string, right: string) => path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
const outside = (root: string, file: string) => { const relative = path.relative(root, file); return !!relative && (path.isAbsolute(relative) || relative === ".." || relative.startsWith(".." + path.sep)); };
/** Explicit owner setup only; activation never reads vendor configuration or launches Claude. */
export class ClaudeAdapter implements vscode.Disposable {
    #bridge: ClaudeHttpBridge | undefined;
    #lease: (() => boolean) | undefined;
    #abort: AbortController | undefined;
    #busy = false; #disposed = false;
    #receipt: ClaudeReceipt | undefined;
    #pin: ArtifactStamp[] | undefined;
    #poll: ReturnType<typeof setInterval>;
    constructor(private readonly context: vscode.ExtensionContext, private readonly manager: BrokerManager, private readonly reader: ProjectReaderBridge) {
        this.#poll = setInterval(() => { if (this.#lease && !this.#lease()) this.withdraw(); }, 250); this.#poll.unref?.();
    }
    private available(): boolean {
        try { return !this.#disposed && process.platform === "win32" && claudeAdapterEnabled() && safeReadMcpEnabled() && this.reader.isEnabled()
            && vscode.workspace.isTrusted && vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.scheme === "file"; } catch { return false; }
    }
    withdraw(): void { this.#abort?.abort(); this.#lease = undefined; this.#receipt = undefined; this.#bridge?.rotate(); }
    dispose(): void { this.#disposed = true; this.withdraw(); clearInterval(this.#poll); void this.#bridge?.dispose(); this.#bridge = undefined; }
    status(): object { return { status: this.#receipt && this.#lease?.() ? "CONFIGURED_RESTART_AND_ROUTE_VERIFICATION_REQUIRED" : "UNAVAILABLE",
        version: CLAUDE_PIN.version, badge: "Uncovered", routeVerification: "Current owner instance unverified; isolated scripted checks do not establish this instance's routing.",
        scope: "Pinned Windows manual-permission text route only. Native context may enter the vendor; independent traffic and unsupported routes remain unverified." }; }
    private async artifact(): Promise<void> {
        this.#pin = undefined;
        const extension = vscode.extensions.getExtension("Anthropic.claude-code");
        if (!extension || extension.packageJSON?.version !== CLAUDE_PIN.version) throw Error("Unavailable");
        const root = extension.extensionUri.fsPath;
        const files = [path.join(root, "package.json"), path.join(root, "extension.js"), path.join(root, "resources", "native-binary", "claude.exe")];
        const snapshots = await Promise.all(files.map(async file => ({ file, stat: await lstat(file) })));
        const manifest = await this.boundedBytes(path.join(root, "package.json"), 65536), runtime = await this.boundedBytes(path.join(root, "extension.js"), 8 * 1024 * 1024);
        const native = path.join(root, "resources", "native-binary", "claude.exe"), before = await lstat(native);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== 271840416 || !same(await realpath(native), native)) throw Error("Unavailable");
        const handle = await open(native, "r"), hash = createHash("sha256"); let size = 0;
        try {
            const opened = await handle.stat(); if (!opened.isFile() || opened.ino !== before.ino || opened.size !== before.size || opened.nlink !== 1) throw Error("Unavailable");
            const buffer = Buffer.alloc(65536);
            while (true) { const { bytesRead } = await handle.read(buffer, 0, buffer.length, null); if (!bytesRead) break; size += bytesRead;
                if (size > before.size) throw Error("Unavailable"); hash.update(buffer.subarray(0, bytesRead)); }
        } finally { await handle.close(); }
        const after = await lstat(native);
        if (size !== before.size || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs
            || after.nlink !== 1 || after.isSymbolicLink() || !same(await realpath(native), native)
            || !verifyClaudeArtifact(manifest, runtime, hash.digest("hex"))) throw Error("Unavailable");
        for (const snapshot of snapshots) {
            const current = await lstat(snapshot.file), original = snapshot.stat;
            if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || current.dev !== original.dev || current.ino !== original.ino
                || current.size !== original.size || current.mtimeMs !== original.mtimeMs || !same(await realpath(snapshot.file), snapshot.file)) throw Error("Unavailable");
        }
        this.#pin = snapshots.map(({ file, stat }) => ({ file, dev: stat.dev, ino: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs }));
    }
    /** Fresh file identities bind the verified bytes; hostile same-user
     * timestamp/inode manipulation is outside this cooperative boundary. */
    private async artifactCurrent(): Promise<boolean> {
        try {
            const extension = vscode.extensions.getExtension("Anthropic.claude-code"), snapshots = this.#pin;
            if (!extension || extension.packageJSON?.version !== CLAUDE_PIN.version || !snapshots || snapshots.length !== 3) return false;
            for (const before of snapshots) {
                if (outside(extension.extensionUri.fsPath, before.file)) return false;
                const current = await lstat(before.file);
                if (!current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || current.dev !== before.dev || current.ino !== before.ino
                    || current.size !== before.size || current.mtimeMs !== before.mtimeMs || !same(await realpath(before.file), before.file)) return false;
            }
            return true;
        } catch { return false; }
    }
    private paths(): Record<ClaudeFileKey, string> {
        const custom = process.env.CLAUDE_CONFIG_DIR;
        if (custom !== undefined && (!path.isAbsolute(custom) || custom.length > 2048 || /[\x00-\x1f\x7f"<>|?*]/.test(custom))) throw Error("Unavailable");
        const directory = custom ?? path.join(homedir(), ".claude");
        const files = { settings: path.join(directory, "settings.json"), state: custom ? path.join(directory, ".claude.json") : path.join(homedir(), ".claude.json") };
        const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
        if (Object.values(files).some(file => !outside(root, file))) throw Error("Unavailable");
        return files;
    }
    private async projectEligible(): Promise<boolean> {
        const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
        for (const item of [".claude/settings.json", ".claude/settings.local.json", ".mcp.json"]) {
            try { await lstat(path.join(root, item)); return false; } catch (error) { if ((error as { code?: string }).code !== "ENOENT") return false; }
        }
        return true;
    }
    private async boundedBytes(file: string, maximum: number): Promise<Buffer> {
        const before = await lstat(file);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maximum || !same(await realpath(file), file)) throw Error("Unavailable");
        const bytes = await readFile(file), after = await lstat(file);
        if (after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs
            || after.nlink !== 1 || bytes.length !== before.size || !same(await realpath(file), file)) throw Error("Unavailable");
        return bytes;
    }
    private async read(file: string): Promise<string | undefined> {
        try { return new TextDecoder("utf-8", { fatal: true }).decode(await this.boundedBytes(file, 262144)); }
        catch (error) { if ((error as { code?: string }).code === "ENOENT") return; throw Error("Unavailable"); }
    }
    private async write(file: string, text: string | undefined): Promise<void> {
        const parent = path.dirname(file), canonical = await verifyOutputPath(parent, file);
        if (!same(canonical, file)) throw Error("Unavailable");
        const current = await this.read(file);
        if (text === undefined) { if (current !== undefined) await unlink(file); return; }
        if (Buffer.byteLength(text) > 262144) throw Error("Unavailable");
        const temporary = path.join(parent, ".soterai-claude-" + randomUUID() + ".tmp"), handle = await open(temporary, "wx", 0o600);
        let owned: { dev: number; ino: number } | undefined, renamed = false;
        try {
            try {
                const opened = await handle.stat(), stat = await lstat(temporary);
                if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.ino !== opened.ino) throw Error("Unavailable");
                owned = { dev: stat.dev, ino: stat.ino }; await handle.writeFile(text, "utf8"); await handle.sync();
            } finally { await handle.close(); }
            if (await this.read(file) !== current || !same(await verifyOutputPath(parent, file), file)) throw Error("Unavailable");
            await rename(temporary, file); renamed = true;
        } finally {
            if (!renamed && owned) { try {
                const stat = await lstat(temporary);
                if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.dev === owned.dev && stat.ino === owned.ino && stat.size <= Buffer.byteLength(text)
                    && same(await verifyOutputPath(parent, temporary), temporary)) {
                    const partial = await readFile(temporary);
                    if (partial.length === stat.size && partial.equals(Buffer.from(text).subarray(0, partial.length))) await unlink(temporary);
                }
            } catch { /* Uncertain ownership retains the file for explicit recovery review. */ } }
        }
    }
    private async parent(directory: string): Promise<void> {
        try { const stat = await lstat(directory); if (!stat.isDirectory() || stat.isSymbolicLink() || !same(await realpath(directory), directory)) throw Error("Unavailable"); }
        catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw Error("Unavailable");
            const parent = path.dirname(directory); if (parent === directory) throw Error("Unavailable"); await this.parent(parent); await mkdir(directory);
            if (!same(await realpath(directory), directory)) throw Error("Unavailable"); }
    }
    private dependencies(paths: Record<ClaudeFileKey, string>, lease: () => boolean, owner: string): ClaudeDependencies {
        return { enabled: () => this.available() && lease(), fingerprint: () => owner,
            read: key => this.read(paths[key]), write: (key, value) => { if (!this.available() || !lease()) throw Error("Unavailable"); return this.write(paths[key], value); },
            backups: new EncryptedBackupSink(this.context), confirm: async preview => {
                const restoring = preview.operation === "restore", action = restoring ? "Restore reviewed Claude config" : "Apply reviewed Claude changes";
                const result = await vscode.window.showWarningMessage(restoring ? "Review pinned Claude Code restoration" : "Review pinned Claude Code setup",
                    { modal: true, detail: preview.treatment + "\n\n" + preview.diff.join("\n") + "\n\nStop active Claude sessions before applying. Restart Claude manually to load this configuration. Current routing remains unverified. Saved project restrictions remain." }, action);
                return result === action;
            } };
    }
    async configure(): Promise<object> {
        if (this.#busy || !this.available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        try {
            const previous = this.context.globalState.get<SavedReceipt>(RECEIPT);
            if (previous) return { status: "RESTORE_PREVIOUS_CLAUDE_CONFIG_FIRST" };
            await this.artifact(); if (!await this.projectEligible()) return { status: "PROJECT_CLAUDE_OVERRIDE_REQUIRES_REVIEW" };
            const paths = this.paths(), root = vscode.workspace.workspaceFolders![0].uri.toString();
            const directory = vscode.Uri.joinPath(this.context.globalStorageUri, "adapter-sessions");
            if (!outside(vscode.workspace.workspaceFolders![0].uri.fsPath, directory.fsPath)) return { status: "UNAVAILABLE" };
            await vscode.workspace.fs.createDirectory(directory);
            const status = await this.manager.start(), owner = this.manager.ownedSnapshot();
            if (!status.running || owner.state !== "healthy" || !owner.session) return { status: "UNAVAILABLE" };
            const lease = () => { const current = this.manager.ownedSnapshot(); return this.available() && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root
                && current.state === "healthy" && current.session === owner.session && current.port === owner.port; };
            this.withdraw(); this.#lease = lease; this.#abort = new AbortController();
            if (this.#bridge) await this.#bridge.dispose();
            const ready = async (signal: AbortSignal) => !signal.aborted && lease() && await this.artifactCurrent() && await this.projectEligible()
                && await claudeFilesCurrent(this.#receipt, { read: key => this.read(paths[key]) })
                && (await this.manager.status()).running === true && !signal.aborted && lease();
            this.#bridge = new ClaudeHttpBridge({ workspace: vscode.workspace.workspaceFolders![0].uri.fsPath, enabled: lease, ready,
                read: async (file, recipient, signal) => {
                    if (!await ready(signal)) return { status: "UNAVAILABLE" };
                    const result = await this.reader.readIntegration(vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, file), recipient, signal);
                    return await ready(signal) ? result : { status: "CHANGED" };
                }, classify: async (file, intent, signal) => {
                    if (!await ready(signal)) return "UNAVAILABLE";
                    const result = await this.reader.classifyIntegration(vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, file), intent, signal);
                    return await ready(signal) ? result : "UNAVAILABLE";
                } });
            const connection = await this.#bridge.start(), credential = await this.manager.getClientToken();
            const plan = createClaudePlan({ settings: await this.read(paths.settings), state: await this.read(paths.state) },
                { ...connection, url: status.url + "/v1/ai/anthropic-compatible", credential });
            const identity = createHash("sha256").update(root + "\0" + owner.session).digest("hex"), deps = this.dependencies(paths, lease, identity);
            const recovery = vscode.Uri.joinPath(directory, "claude-recovery-" + randomUUID() + ".json");
            deps.prepare = async receipt => {
                if (!lease()) throw Error("Unavailable");
                const saved: SavedReceipt = { version: 1, receipt, root, paths };
                await this.write(recovery.fsPath, JSON.stringify(saved));
                if (!lease()) throw Error("Unavailable");
            };
            const confirm = deps.confirm;
            deps.confirm = async preview => {
                if (!await confirm(preview) || !lease()) return false;
                await this.artifact(); if (!await this.projectEligible()) return false;
                for (const file of Object.values(paths)) await this.parent(path.dirname(file)); return lease();
            };
            const result = await plan.apply(deps, this.#abort.signal);
            if ((result.status === "APPLIED" || result.status === "INCOMPLETE") && result.receipt) {
                const saved: SavedReceipt = { version: 1, receipt: result.receipt, root, paths };
                // The pre-write value-free receipt already retains both backup
                // handles even if editor persistence fails. Originals stay encrypted.
                try { await this.context.globalState.update(RECEIPT, saved); }
                catch { await undoClaudeFiles(result.receipt, { ...deps, confirm: async () => true }); this.withdraw(); return { status: "INCOMPLETE" }; }
                if (result.status === "APPLIED") this.#receipt = result.receipt; else this.withdraw();
            } else this.withdraw();
            return { status: result.status, version: CLAUDE_PIN.version, badge: "Uncovered", routeVerification: "RESTART_AND_ACTUAL_ROUTE_CHECK_REQUIRED" };
        } catch { this.withdraw(); return { status: "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
    private async saved(paths: Record<ClaudeFileKey, string>, root: string): Promise<SavedReceipt | undefined> {
        const stored = this.context.globalState.get<SavedReceipt>(RECEIPT);
        if (stored) return stored;
        const directory = vscode.Uri.joinPath(this.context.globalStorageUri, "adapter-sessions").fsPath;
        let names: string[]; try { names = (await readdir(directory)).filter(name => /^claude-recovery-[a-f0-9-]{36}\.json$/.test(name)); } catch { return; }
        if (names.length > 32) return;
        const candidates: SavedReceipt[] = [];
        for (const name of names) {
            try {
                const text = await this.read(path.join(directory, name)); if (!text) continue;
                const parsed = decodeBoundedJson(Buffer.from(text), { maxBytes: 16384, maxDepth: 8, maxNodes: 256, maxStringBytes: 2048 }).body as unknown as SavedReceipt;
                if (parsed.version === 1 && parsed.root === root && JSON.stringify(parsed.paths) === JSON.stringify(paths)
                    && await claudeFilesCurrent(parsed.receipt, { read: key => this.read(paths[key]) })) candidates.push(parsed);
            } catch { /* A corrupt receipt cannot become authority. */ }
        }
        return candidates.length === 1 ? candidates[0] : undefined;
    }
    async undo(): Promise<object> {
        if (this.#busy || !this.available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        try {
            await this.artifact();
            const paths = this.paths(), root = vscode.workspace.workspaceFolders![0].uri.toString(), saved = await this.saved(paths, root);
            if (!saved || saved.root !== root || JSON.stringify(saved.paths) !== JSON.stringify(paths)) return { status: "UNAVAILABLE" };
            const deps = this.dependencies(paths, () => this.available() && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root, saved.receipt.owner);
            const result = await undoClaudeFiles(saved.receipt, deps);
            if (result.status === "RESTORED") { this.withdraw(); await this.context.globalState.update(RECEIPT, undefined); }
            return { status: result.status };
        } catch { return { status: "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
}
export function registerClaudeAdapter(context: vscode.ExtensionContext, manager: BrokerManager, reader: ProjectReaderBridge): void {
    const adapter = new ClaudeAdapter(context, manager, reader);
    context.subscriptions.push(adapter, vscode.commands.registerCommand("soterai.configurePinnedClaude", async () => {
        const result = await adapter.configure() as { status: string };
        if (result.status === "RESTORE_PREVIOUS_CLAUDE_CONFIG_FIRST") void vscode.window.showWarningMessage("Restore the previous reviewed Claude Code configuration in its owner project before setting up another session.");
        else if (result.status === "PROJECT_CLAUDE_OVERRIDE_REQUIRES_REVIEW") void vscode.window.showWarningMessage("This project has Claude configuration that can override user settings. Review those files before pinned setup. No project file was changed.");
        else if (!["APPLIED", "CANCELLED"].includes(result.status)) void vscode.window.showWarningMessage("Claude Code setup is incomplete and routing remains unverified. Review current settings and retained encrypted backups before retrying.");
        return result;
    }), vscode.commands.registerCommand("soterai.restorePinnedClaude", () => adapter.undo()), vscode.commands.registerCommand("soterai.claudeAdapterStatus", () => adapter.status()),
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) adapter.withdraw(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => adapter.withdraw()));
}
