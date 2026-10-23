import * as vscode from "vscode";
import * as path from "node:path";
import { homedir } from "node:os";
import { lstat, readFile, realpath, mkdir, open, rename, unlink } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { BrokerManager } from "../broker/BrokerManager";
import { EncryptedBackupSink } from "../broker/EncryptedBackupSink";
import type { ProjectReaderBridge } from "../project-privacy/commands";
import { SafeReadBridge } from "../agent/SafeReadBridge";
import { safeReadMcpEnabled } from "../agent/mcpProvider";
import { sealBridgeConnection } from "../agent/SealedBridgeTicket";
import { verifyOutputPath } from "../security/FileSystemPathPolicy";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import { CLINE_PIN, clineFileDigest, createClinePlan, undoClineFiles, verifyClineArtifact, type ClineFileKey, type ClineFiles, type ClineReceipt, type ClineDependencies } from "./ClineAdapterPolicy";

const RECEIPT = "soterai.lite.clineAdapter.receipt.v1";
export function clineAdapterEnabled(): boolean {
    try { const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.clineAdapter");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.clineAdapter", true)) === true; } catch { return false; }
}
/** Owner-invoked current-version setup. No config discovery/read during activation. */
export class ClineAdapter implements vscode.Disposable {
    #bridge: SafeReadBridge | undefined;
    #lease: (() => boolean) | undefined;
    #abort: AbortController | undefined;
    #busy = false;
    #disposed = false;
    #configured = false;
    #activeReceipt: ClineReceipt | undefined;
    #authorization: string | undefined;
    #poll: ReturnType<typeof setInterval>;
    constructor(private readonly context: vscode.ExtensionContext, private readonly manager: BrokerManager, private readonly reader: ProjectReaderBridge) {
        this.#poll = setInterval(() => { if (this.#lease && !this.#lease()) this.withdraw(); }, 250); this.#poll.unref?.();
    }
    private available(): boolean {
        try { return !this.#disposed && process.platform === "win32" && clineAdapterEnabled() && safeReadMcpEnabled() && this.reader.isEnabled()
            && vscode.workspace.isTrusted && vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.scheme === "file"; } catch { return false; }
    }
    withdraw(): void { this.#abort?.abort(); this.#lease = undefined; this.#configured = false; this.#activeReceipt = undefined; this.#authorization = undefined; this.#bridge?.rotate(); }
    dispose(): void { this.#disposed = true; this.withdraw(); clearInterval(this.#poll); void this.#bridge?.dispose(); this.#bridge = undefined; }
    status(): object { return { status: this.#configured && this.#lease?.() ? "CONFIGURED_RELOAD_AND_ROUTE_VERIFICATION_REQUIRED" : "UNAVAILABLE", version: CLINE_PIN.version,
        badge: "Uncovered", routeVerification: "Current owner instance unverified; isolated scripted checks do not establish this instance's routing.", scope: "Pinned Windows OpenAI-compatible configuration only; native hook launch/error/context/attachment paths need their declared vendor checks." }; }
    private async artifact(): Promise<void> {
        const extension = vscode.extensions.getExtension("saoudrizwan.claude-dev");
        if (!extension || extension.packageJSON?.version !== CLINE_PIN.version) throw Error("Unavailable");
        const root = extension.extensionUri.fsPath, manifestPath = path.join(root, "package.json"), runtimePath = path.join(root, "dist/extension.js");
        for (const file of [manifestPath, runtimePath]) { const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32 * 1024 * 1024) throw Error("Unavailable"); }
        if (!verifyClineArtifact(await readFile(manifestPath), await readFile(runtimePath))) throw Error("Unavailable");
    }
    private paths(): Record<ClineFileKey, string> {
        const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const settings = path.join(homedir(), ".cline", "data", "settings");
        return { providers: path.join(settings, "providers.json"), mcp: path.join(settings, "cline_mcp_settings.json"), globals: path.join(settings, "global-settings.json"), hook: path.join(root, ".clinerules", "hooks", "PreToolUse.ps1"), taskHook: path.join(root, ".clinerules", "hooks", "TaskStart.ps1") };
    }
    private async eligible(): Promise<boolean> {
        try {
            const source = await this.read(path.join(homedir(), ".cline", "data", "globalState.json")); if (!source) return false;
            const state = decodeBoundedJson(Buffer.from(source), { maxBytes: 262144, maxDepth: 16, maxNodes: 4096 }).body;
            const headers = state.openAiHeaders;
            const supportedHeaders = headers === undefined || !!headers && typeof headers === "object" && !Array.isArray(headers)
                && (Object.keys(headers).length === 0 || Object.keys(headers).length === 1 && Object.entries(headers).every(([key, value]) => key.toLowerCase() === "authorization" && value === this.#authorization));
            return state.hooksEnabled === true && state.optOutOfRemoteConfig === true && supportedHeaders;
        } catch { return false; }
    }
    private async configuredFiles(paths: Record<ClineFileKey, string>, lease: () => boolean): Promise<boolean> {
        try {
            const receipt = this.#activeReceipt; if (!receipt || !lease() || !await this.eligible()) return false;
            for (const entry of receipt.entries) if (clineFileDigest(await this.read(paths[entry.key])) !== entry.afterDigest) return false;
            return this.#activeReceipt === receipt && lease();
        } catch { return false; }
    }
    private async read(file: string): Promise<string | undefined> {
        try {
            const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 262144) throw Error("Unavailable");
            if (path.resolve(await realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase()) throw Error("Unavailable");
            const bytes = await readFile(file), after = await lstat(file);
            if (after.dev !== stat.dev || after.ino !== stat.ino || after.mtimeMs !== stat.mtimeMs || after.size !== stat.size || after.nlink !== 1 || bytes.length !== stat.size) throw Error("Unavailable");
            return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch (error) { if ((error as { code?: string }).code === "ENOENT") return; throw Error("Unavailable"); }
    }
    private async write(file: string, text: string | undefined): Promise<void> {
        const parent = path.dirname(file), canonical = await verifyOutputPath(parent, file);
        if (path.resolve(canonical).toLowerCase() !== path.resolve(file).toLowerCase()) throw Error("Unavailable");
        const current = await this.read(file);
        if (text === undefined) { if (current !== undefined) await unlink(file); return; }
        if (Buffer.byteLength(text) > 262144) throw Error("Unavailable");
        const temporary = path.join(parent, ".soterai-cline-" + randomUUID() + ".tmp"), handle = await open(temporary, "wx", 0o600);
        let owned: { dev: number; ino: number } | undefined, renamed = false;
        try {
            try {
                const handleStat = await handle.stat(), pathStat = await lstat(temporary);
                if (!pathStat.isFile() || pathStat.isSymbolicLink() || pathStat.nlink !== 1 || pathStat.ino !== handleStat.ino) throw Error("Unavailable");
                // Bind path-stat to path-stat. In the tested Windows runtime,
                // fstat.dev reports a volume ID while lstat.dev reports zero.
                owned = { dev: pathStat.dev, ino: pathStat.ino };
                await handle.writeFile(text, "utf8"); await handle.sync();
            } finally { await handle.close(); }
            if (await this.read(file) !== current || path.resolve(await verifyOutputPath(parent, file)).toLowerCase() !== path.resolve(file).toLowerCase()) throw Error("Unavailable");
            await rename(temporary, file); renamed = true;
        } finally {
            // Exact owned ephemeral file only; encrypted backups retain recovery
            // material. Never leave a plaintext adjacent config copy on failure.
            if (!renamed && owned) { try {
                const stat = await lstat(temporary);
                if (!stat.isSymbolicLink() && stat.isFile() && stat.nlink === 1 && stat.dev === owned.dev && stat.ino === owned.ino && stat.size <= Buffer.byteLength(text)
                    && path.resolve(await verifyOutputPath(parent, temporary)).toLowerCase() === path.resolve(temporary).toLowerCase()) {
                    const partial = await readFile(temporary);
                    if (partial.length === stat.size && partial.equals(Buffer.from(text).subarray(0, partial.length))) await unlink(temporary);
                }
            } catch { /* Uncertain ownership retains the file for explicit review. */ } }
        }
    }
    private async hookDirectory(root: string): Promise<void> {
        for (const relative of [".clinerules", ".clinerules/hooks"]) {
            const folder = path.join(root, relative);
            try { const stat = await lstat(folder); if (!stat.isDirectory() || stat.isSymbolicLink() || path.resolve(await realpath(folder)).toLowerCase() !== path.resolve(folder).toLowerCase()) throw Error("Unavailable"); }
            catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw Error("Unavailable"); await mkdir(folder); }
        }
    }
    private dependencies(paths: Record<ClineFileKey, string>, lease: () => boolean, identity: string): ClineDependencies {
        return { enabled: () => this.available() && lease(), fingerprint: () => identity,
            read: key => this.read(paths[key]), write: (key, value) => { if (!this.available() || !lease()) throw Error("Unavailable"); return this.write(paths[key], value); },
            backups: new EncryptedBackupSink(this.context), confirm: async preview => {
                const restoring = preview.operation === "restore", action = restoring ? "Restore reviewed Cline config" : "Apply reviewed Cline changes";
                return await vscode.window.showWarningMessage(restoring ? "Review pinned Cline restoration" : "Review pinned Cline setup", { modal: true,
                    detail: preview.treatment + "\n\n" + preview.diff.join("\n") + "\n\nChanged entries: " + preview.changes.join(", ") + ".\nStop active Cline tasks before applying. Cline may need a manual restart to load its config; routing remains unverified until checked. Saved project denies remain." }, action) === action;
            } };
    }
    async configure(): Promise<object> {
        if (this.#busy || !this.available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        try {
            const previous = this.context.globalState.get<{ root?: string }>(RECEIPT);
            if (previous?.root && previous.root !== vscode.workspace.workspaceFolders![0].uri.toString()) return { status: "ANOTHER_PROJECT_OWNS_SHARED_CLINE_CONFIG" };
            await this.artifact();
            if (!await this.eligible()) return { status: "CLINE_HOOKS_AND_REMOTE_CONFIG_OPT_OUT_REQUIRED" };
            // Establish the out-of-project storage before the gateway captures
            // an absent vault's nearest existing directory. Creating this parent
            // afterwards correctly invalidates that immutable empty-store lease.
            const directory = vscode.Uri.joinPath(this.context.globalStorageUri, "adapter-sessions");
            const relative = path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, directory.fsPath);
            if (!relative || !path.isAbsolute(relative) && !relative.startsWith(".." + path.sep) && relative !== "..") return { status: "UNAVAILABLE" };
            await vscode.workspace.fs.createDirectory(directory);
            const status = await this.manager.start(), owner = this.manager.ownedSnapshot();
            if (!status.running || owner.state !== "healthy" || !owner.session) return { status: "UNAVAILABLE" };
            const root = vscode.workspace.workspaceFolders![0].uri.toString();
            const lease = () => { const current = this.manager.ownedSnapshot(); return this.available() && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root && current.state === "healthy" && current.session === owner.session && current.port === owner.port; };
            this.withdraw(); this.#lease = lease; this.#abort = new AbortController();
            if (this.#bridge) await this.#bridge.dispose();
            const paths = this.paths();
            this.#bridge = new SafeReadBridge({ workspace: vscode.workspace.workspaceFolders![0].uri.fsPath, enabled: lease,
                ready: async signal => !signal.aborted && await this.configuredFiles(paths, lease) && (await this.manager.status()).running === true && !signal.aborted && lease(),
                read: async (file, recipient, signal) => {
                    if (!await this.configuredFiles(paths, lease)) return { status: "UNAVAILABLE" };
                    const result = await this.reader.readIntegration(vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, file), recipient, signal);
                    return await this.configuredFiles(paths, lease) ? result : { status: "CHANGED" };
                },
                classify: async (file, intent, signal) => {
                    if (!await this.configuredFiles(paths, lease)) return "UNAVAILABLE";
                    const result = await this.reader.classifyIntegration(vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, file), intent, signal);
                    return await this.configuredFiles(paths, lease) ? result : "UNAVAILABLE";
                } });
            const connection = await this.#bridge.start(), sealed = await sealBridgeConnection(connection);
            if (!sealed || !lease()) return { status: "UNAVAILABLE" };
            const ticket = vscode.Uri.joinPath(directory, "cline-session.ticket");
            const files = { providers: await this.read(paths.providers), mcp: await this.read(paths.mcp), globals: await this.read(paths.globals), hook: await this.read(paths.hook), taskHook: await this.read(paths.taskHook) } as ClineFiles;
            const token = await this.manager.getClientToken();
            const plan = createClinePlan(files, { url: status.url + "/v1/ai/openai-compatible", credential: token, codePath: process.execPath,
                mcpPath: vscode.Uri.joinPath(this.context.extensionUri, "dist", "soterai-mcp-server.js").fsPath, ticketPath: ticket.fsPath, workspace: vscode.workspace.workspaceFolders![0].uri.fsPath, session: owner.session });
            const identity = createHash("sha256").update(root + "\0" + owner.session).digest("hex"), deps = this.dependencies(paths, lease, identity);
            const originalConfirm = deps.confirm;
            deps.confirm = async preview => {
                if (!await originalConfirm(preview)) return false; if (!lease()) return false;
                await this.artifact(); await this.hookDirectory(vscode.workspace.workspaceFolders![0].uri.fsPath);
                const temporary = vscode.Uri.joinPath(directory, "cline-session-" + randomUUID() + ".tmp");
                await vscode.workspace.fs.writeFile(temporary, sealed); if (!lease()) return false;
                await vscode.workspace.fs.rename(temporary, ticket, { overwrite: true }); return lease();
            };
            const result = await plan.apply(deps, this.#abort.signal);
            if (result.status === "APPLIED" && result.receipt) {
                try { await this.context.globalState.update(RECEIPT, { receipt: result.receipt, root, paths }); }
                catch { await undoClineFiles(result.receipt, { ...deps, confirm: async () => true }); this.withdraw(); return { status: "INCOMPLETE" }; }
                this.#configured = true;
                this.#activeReceipt = result.receipt;
                this.#authorization = "Bearer " + token;
                void vscode.window.showInformationMessage("Cline config saved for the pinned version. Restart Cline manually and verify its current route. Native context and failed vendor hooks remain outside the verified managed route.");
            } else {
                if (result.status === "INCOMPLETE" && result.receipt) await this.context.globalState.update(RECEIPT, { receipt: result.receipt, root, paths });
                this.withdraw();
            }
            return { status: result.status, version: CLINE_PIN.version, badge: "Uncovered", routeVerification: "RELOAD_AND_ACTUAL_ROUTE_CHECK_REQUIRED" };
        } catch { this.withdraw(); return { status: "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
    async undo(): Promise<object> {
        if (this.#busy || !this.available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        try {
            await this.artifact();
            const saved = this.context.globalState.get<{ receipt: ClineReceipt; root: string; paths: Record<ClineFileKey, string> }>(RECEIPT);
            const root = vscode.workspace.workspaceFolders![0].uri.toString(), paths = this.paths();
            if (!saved || saved.root !== root || JSON.stringify(saved.paths) !== JSON.stringify(paths)) return { status: "UNAVAILABLE" };
            const result = await undoClineFiles(saved.receipt, this.dependencies(paths, () => this.available() && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root, saved.receipt.owner));
            if (result.status === "RESTORED") { this.withdraw(); await this.context.globalState.update(RECEIPT, undefined); }
            return { status: result.status };
        } catch { return { status: "UNAVAILABLE" }; } finally { this.#busy = false; }
    }
}
export function registerClineAdapter(context: vscode.ExtensionContext, manager: BrokerManager, reader: ProjectReaderBridge): void {
    const adapter = new ClineAdapter(context, manager, reader);
    context.subscriptions.push(adapter, vscode.commands.registerCommand("soterai.configurePinnedCline", async () => {
        const result = await adapter.configure() as { status: string };
        if (result.status === "CLINE_HOOKS_AND_REMOTE_CONFIG_OPT_OUT_REQUIRED") void vscode.window.showWarningMessage("This Cline profile needs hooks enabled, remote configuration opted out and no legacy custom-header override. Review Cline settings before applying SoterAI setup.");
        else if (result.status === "ANOTHER_PROJECT_OWNS_SHARED_CLINE_CONFIG") void vscode.window.showWarningMessage("This Cline profile is configured for another project. Restore its previous config in the owner project before setting up this project.");
        else if (!["APPLIED", "CANCELLED"].includes(result.status)) void vscode.window.showWarningMessage("Cline setup is incomplete and its route remains unverified. Review current tool settings and retained encrypted backups before retrying.");
        return result;
    }),
        vscode.commands.registerCommand("soterai.restorePinnedCline", () => adapter.undo()), vscode.commands.registerCommand("soterai.clineAdapterStatus", () => adapter.status()),
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) adapter.withdraw(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => adapter.withdraw()));
}
