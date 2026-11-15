import * as vscode from "vscode";
import * as path from "node:path";
import { homedir } from "node:os";
import { constants } from "node:fs";
import { lstat, readFile, realpath, mkdir, open, rename, unlink } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { BrokerManager } from "../broker/BrokerManager";
import { EncryptedBackupSink } from "../broker/EncryptedBackupSink";
import type { ProjectReaderBridge } from "../project-privacy/commands";
import { SafeReadBridge } from "../agent/SafeReadBridge";
import { safeReadMcpEnabled } from "../agent/mcpProvider";
import { sealBridgeConnection } from "../agent/SealedBridgeTicket";
import { verifyOutputPath } from "../security/FileSystemPathPolicy";
import { fileIdentity } from "../firewall/VaultStorage";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import { CLINE_PIN, CLINE_SUPPORTED_PINS, resolveClineArtifact, clineDefaultPathsEnvironment, clineLegacyRouteSupported, clineFileDigest, createClinePlan, undoClineFiles, type ClinePin, type ClineFileKey, type ClineFiles, type ClineReceipt, type ClineDependencies } from "./ClineAdapterPolicy";
import { clineSessionSelection, type ClineSessionSelection } from "./ClineSessionPolicy";

const RECEIPT = "soterai.lite.clineAdapter.receipt.v1";
export function clineAdapterEnabled(): boolean {
    try { const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.clineAdapter");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.clineAdapter", true)) === true; } catch { return false; }
}
/** Owner-invoked current-version setup. No config discovery/read during activation. */
export class ClineAdapter implements vscode.Disposable {
    #verifiedVersion: string | undefined;
    #bridge: SafeReadBridge | undefined;
    #lease: (() => boolean) | undefined;
    #abort: AbortController | undefined;
    #busy = false;
    #disposed = false;
    #configured = false;
    #activeReceipt: ClineReceipt | undefined;
    #authorization: string | undefined;
    #selection: ClineSessionSelection | undefined;
    #activePaths: Record<ClineFileKey, string> | undefined;
    #validation: Promise<boolean> | undefined;
    #withdrawalReason: string | undefined;
    #admissionGuard: vscode.Disposable | undefined;
    #poll: ReturnType<typeof setInterval>;
    constructor(private readonly context: vscode.ExtensionContext, private readonly manager: BrokerManager, private readonly reader: ProjectReaderBridge) {
        this.#poll = setInterval(() => {
            if (this.#lease && !this.#lease()) this.withdraw("SESSION_LEASE_CHANGED");
            else if (this.#configured) void this.validateSession();
        }, 250); this.#poll.unref?.();
    }
    private available(): boolean {
        try { return !this.#disposed && process.platform === "win32" && clineAdapterEnabled() && safeReadMcpEnabled() && this.reader.isEnabled()
            && vscode.workspace.isTrusted && vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.scheme === "file"; } catch { return false; }
    }
    withdraw(reason = "SESSION_WITHDRAWN"): void {
        const heldSession = this.#configured || !!this.#admissionGuard;
        this.#abort?.abort(); this.#lease = undefined; this.#configured = false; this.#activeReceipt = undefined; this.#authorization = undefined;
        this.#selection = undefined; this.#activePaths = undefined; this.#validation = undefined; this.#withdrawalReason = reason; this.#bridge?.rotate();
        // The data credential is shared by this window. Stop that owned broker
        // rather than leaving a withdrawn Cline credential able to forward.
        if (heldSession) { try { void this.manager.stop().catch(() => undefined); } catch { /* Guard remains latched. */ } }
    }
    dispose(): void { this.#disposed = true; this.withdraw(); this.#admissionGuard?.dispose(); this.#admissionGuard = undefined; clearInterval(this.#poll); void this.#bridge?.dispose(); this.#bridge = undefined; }
    status(): object { return { status: this.#configured && this.#lease?.() ? "CONFIGURED_NEW_TASK_AND_ROUTE_VERIFICATION_REQUIRED" : "UNAVAILABLE", version: this.#verifiedVersion ?? CLINE_PIN.version,
        supportedVersions: CLINE_SUPPORTED_PINS.map(pin => pin.version),
        badge: "Uncovered", sessionState: this.#configured && this.#lease?.() ? "CONFIGURED_UNVERIFIED" : this.#withdrawalReason ? "WITHDRAWN" : "NOT_CONFIGURED",
        ...(this.#withdrawalReason ? { reason: this.#withdrawalReason } : {}),
        gatewayAdmission: this.#configured && this.#admissionGuard ? "GUARDED_WHILE_SELECTION_IS_CURRENT" : "UNAVAILABLE",
        routeVerification: "Start a new Cline task and check the current route. Provider, model or mode changes and Reload Window withdraw this session; restore and configure again.",
        scope: "Pinned Windows OpenAI-compatible configuration and managed gateway/hooks/read checks. Session withdrawal stops this window's broker. Cached tasks, direct provider traffic, failed vendor hooks and native attachments require their declared checks; this is not host-wide mediation." }; }
    private async artifact(): Promise<Readonly<ClinePin>> {
        const extension = vscode.extensions.getExtension("saoudrizwan.claude-dev");
        if (!extension || !CLINE_SUPPORTED_PINS.some(pin => pin.version === extension.packageJSON?.version)) throw Error("Unavailable");
        const root = extension.extensionUri.fsPath, manifestPath = path.join(root, "package.json"), runtimePath = path.join(root, "dist/extension.js");
        for (const file of [manifestPath, runtimePath]) { const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32 * 1024 * 1024) throw Error("Unavailable"); }
        const pin = resolveClineArtifact(await readFile(manifestPath), await readFile(runtimePath));
        if (!pin || pin.version !== extension.packageJSON?.version) throw Error("Unavailable");
        this.#verifiedVersion = pin.version;
        return pin;
    }
    private paths(): Record<ClineFileKey, string> {
        const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const settings = path.join(homedir(), ".cline", "data", "settings");
        return { providers: path.join(settings, "providers.json"), mcp: path.join(settings, "cline_mcp_settings.json"), globals: path.join(settings, "global-settings.json"), hook: path.join(root, ".clinerules", "hooks", "PreToolUse.ps1"), taskHook: path.join(root, ".clinerules", "hooks", "TaskStart.ps1") };
    }
    private async globalState(): Promise<Record<string, unknown>> {
        const source = await this.read(path.join(homedir(), ".cline", "data", "globalState.json")); if (!source) throw Error("Unavailable");
        return decodeBoundedJson(Buffer.from(source), { maxBytes: 262144, maxDepth: 16, maxNodes: 4096 }).body;
    }
    private async selection(): Promise<ClineSessionSelection | undefined> {
        try { return clineSessionSelection(await this.globalState()); } catch { return; }
    }
    private async prerequisiteStatus(): Promise<"READY" | "CLINE_LEGACY_ROUTE_OVERRIDE_UNSUPPORTED" | "CLINE_HOOKS_AND_REMOTE_CONFIG_OPT_OUT_REQUIRED" | "CLINE_PROVIDER_SELECTION_UNSUPPORTED"> {
        try {
            const state = await this.globalState();
            if (!clineLegacyRouteSupported(state)) return "CLINE_LEGACY_ROUTE_OVERRIDE_UNSUPPORTED";
            const headers = state.openAiHeaders;
            const supportedHeaders = headers === undefined || !!headers && typeof headers === "object" && !Array.isArray(headers)
                && (Object.keys(headers).length === 0 || Object.keys(headers).length === 1 && Object.entries(headers).every(([key, value]) => key.toLowerCase() === "authorization" && value === this.#authorization));
            if (state.hooksEnabled !== true || state.optOutOfRemoteConfig !== true || !supportedHeaders) return "CLINE_HOOKS_AND_REMOTE_CONFIG_OPT_OUT_REQUIRED";
            return clineSessionSelection(state) ? "READY" : "CLINE_PROVIDER_SELECTION_UNSUPPORTED";
        } catch { return "CLINE_HOOKS_AND_REMOTE_CONFIG_OPT_OUT_REQUIRED"; }
    }
    private async eligible(): Promise<boolean> { return await this.prerequisiteStatus() === "READY"; }
    /** Recheck at each managed admission; polling only updates local session state. */
    async validateSession(): Promise<boolean> {
        if (!this.#configured || !this.#lease || !this.#activePaths) return false;
        if (this.#validation) return this.#validation;
        const lease = this.#lease, paths = this.#activePaths;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const pending = Promise.race([this.configuredFiles(paths, lease), new Promise<boolean>(resolve => {
            timer = setTimeout(() => { if (this.#lease === lease) this.withdraw("CLINE_VALIDATION_UNAVAILABLE"); resolve(false); }, 2000); timer.unref?.();
        })]);
        this.#validation = pending;
        try { return await pending; }
        finally { if (timer) clearTimeout(timer); if (this.#validation === pending) this.#validation = undefined; }
    }
    private async configuredFiles(paths: Record<ClineFileKey, string>, lease: () => boolean): Promise<boolean> {
        const receipt = this.#activeReceipt, selection = this.#selection;
        const invalid = (reason: string) => {
            if (receipt && this.#activeReceipt === receipt) this.withdraw(reason);
            return false;
        };
        try {
            if (!receipt || !selection || !lease() || !this.#lease?.()) return invalid("SESSION_LEASE_CHANGED");
            if (!await this.eligible()) return invalid("CLINE_PREREQUISITES_CHANGED");
            if ((await this.selection())?.fingerprint !== selection.fingerprint) return invalid("CLINE_SELECTION_CHANGED");
            for (const entry of receipt.entries) if (clineFileDigest(await this.read(paths[entry.key])) !== entry.afterDigest) return invalid("CLINE_CONFIGURATION_CHANGED");
            // Selection can change while owned files are being inspected.
            if ((await this.selection())?.fingerprint !== selection.fingerprint || !await this.eligible()) return invalid("CLINE_SELECTION_CHANGED");
            return this.#activeReceipt === receipt && lease() && this.#lease?.() === true;
        } catch { return invalid("CLINE_VALIDATION_UNAVAILABLE"); }
    }
    private async read(file: string): Promise<string | undefined> {
        try {
            const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 262144) throw Error("Unavailable");
            if (path.resolve(await realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase()) throw Error("Unavailable");
            const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
            try {
                const before = await handle.stat();
                if (!before.isFile() || before.nlink !== 1 || fileIdentity(before) !== fileIdentity(stat)) throw Error("Unavailable");
                // One bounded allocation even if an external writer grows the
                // settings file after stat. Never use an unbounded readFile here.
                const bytes = Buffer.alloc(before.size + 1); let used = 0;
                while (used < bytes.length) { const result = await handle.read(bytes, used, bytes.length - used, used); if (!result.bytesRead) break; used += result.bytesRead; }
                const after = await handle.stat(), current = await lstat(file);
                if (used !== before.size || !current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || after.nlink !== 1
                    || fileIdentity(after) !== fileIdentity(before) || fileIdentity(current) !== fileIdentity(before)
                    || path.resolve(await realpath(file)).toLowerCase() !== path.resolve(file).toLowerCase()) throw Error("Unavailable");
                return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, used));
            } finally { await handle.close(); }
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
                const lifecycle = restoring ? "The managed session will be withdrawn. Review Cline's provider settings before starting a new task."
                    : "Stop active Cline tasks before applying. Start a new Cline task after setup; existing tasks retain prior state. Changing either mode's provider/model, switching Plan/Act mode or Reload Window withdraws the session and stops this window's broker. Restore the previous config and run setup again.";
                return await vscode.window.showWarningMessage(restoring ? "Review pinned Cline restoration" : "Review pinned Cline setup", { modal: true,
                    detail: preview.treatment + "\n\n" + preview.diff.join("\n") + "\n\nChanged entries: " + preview.changes.join(", ") + ".\n" + lifecycle + " Current routing remains unverified until checked. Saved project denies remain." }, action) === action;
            } };
    }
    async configure(): Promise<object> {
        if (this.#busy || !this.available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        try {
            if (!clineDefaultPathsEnvironment(process.env)) { this.withdraw("CLINE_DEFAULT_PROFILE_REQUIRED"); return { status: "CLINE_DEFAULT_PROFILE_REQUIRED" }; }
            const previous = this.context.globalState.get<{ root?: string; receipt?: ClineReceipt; paths?: Record<ClineFileKey, string> }>(RECEIPT);
            const root = vscode.workspace.workspaceFolders![0].uri.toString();
            if (previous?.root && previous.root !== root) return { status: "ANOTHER_PROJECT_OWNS_SHARED_CLINE_CONFIG" };
            const pin = await this.artifact();
            const prerequisite = await this.prerequisiteStatus();
            if (prerequisite !== "READY") { this.withdraw(prerequisite); return { status: prerequisite }; }
            const selection = await this.selection();
            if (!selection) { this.withdraw("CLINE_PROVIDER_SELECTION_UNSUPPORTED"); return { status: "CLINE_PROVIDER_SELECTION_UNSUPPORTED" }; }
            const paths = this.paths();
            if (previous !== undefined) {
                const lease = this.#lease;
                if (previous?.root === root && JSON.stringify(previous.paths) === JSON.stringify(paths)
                    && this.#configured && lease && this.#activeReceipt && JSON.stringify(previous.receipt) === JSON.stringify(this.#activeReceipt)
                    && await this.configuredFiles(paths, lease) && lease()) {
                    return { status: "ALREADY_CONFIGURED", version: pin.version, badge: "Uncovered", routeVerification: "START_NEW_TASK_AND_ACTUAL_ROUTE_CHECK_REQUIRED" };
                }
                this.withdraw(); return { status: "CLINE_RESTORE_REQUIRED" };
            }
            // Establish the out-of-project storage before the gateway captures
            // an absent vault's nearest existing directory. Creating this parent
            // afterwards correctly invalidates that immutable empty-store lease.
            const directory = vscode.Uri.joinPath(this.context.globalStorageUri, "adapter-sessions");
            const relative = path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, directory.fsPath);
            if (!relative || !path.isAbsolute(relative) && !relative.startsWith(".." + path.sep) && relative !== "..") return { status: "UNAVAILABLE" };
            await vscode.workspace.fs.createDirectory(directory);
            const status = await this.manager.start(), owner = this.manager.ownedSnapshot();
            if (!status.running || owner.state !== "healthy" || !owner.session) return { status: "UNAVAILABLE" };
            const lease = () => { const current = this.manager.ownedSnapshot(); return this.available() && clineDefaultPathsEnvironment(process.env)
                && vscode.extensions.getExtension("saoudrizwan.claude-dev")?.packageJSON?.version === pin.version
                && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root && current.state === "healthy" && current.session === owner.session && current.port === owner.port; };
            this.withdraw(); this.#lease = lease; this.#abort = new AbortController(); this.#selection = selection; this.#activePaths = paths;
            if (this.#bridge) await this.#bridge.dispose();
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
                mcpPath: vscode.Uri.joinPath(this.context.extensionUri, "dist", "soterai-mcp-server.js").fsPath, ticketPath: ticket.fsPath, workspace: vscode.workspace.workspaceFolders![0].uri.fsPath, session: owner.session, model: selection.model }, pin.version);
            const identity = createHash("sha256").update(root + "\0" + owner.session).digest("hex"), deps = this.dependencies(paths, lease, identity);
            const originalConfirm = deps.confirm;
            deps.confirm = async preview => {
                if (!await originalConfirm(preview)) return false;
                if (!lease() || (await this.selection())?.fingerprint !== selection.fingerprint || !await this.eligible()) return false;
                const currentPin = await this.artifact(); if (currentPin.version !== pin.version) return false;
                await this.hookDirectory(vscode.workspace.workspaceFolders![0].uri.fsPath);
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
                this.#withdrawalReason = undefined;
                if (!await this.validateSession()) return { status: "CLINE_RESTORE_REQUIRED", badge: "Uncovered" };
                this.#admissionGuard = this.manager.registerGatewayAdmissionGuard("cline", () => this.validateSession());
                void vscode.window.showInformationMessage("Cline config saved for the pinned version. Start a new Cline task and verify its current route. Reload Window withdraws this managed session; restore and configure again. Native context and failed vendor hooks remain outside the verified managed route.");
            } else {
                if (result.status === "INCOMPLETE" && result.receipt) {
                    await this.manager.stop();
                    await this.context.globalState.update(RECEIPT, { receipt: result.receipt, root, paths });
                }
                this.withdraw();
            }
            return { status: result.status, version: pin.version, badge: "Uncovered", routeVerification: "START_NEW_TASK_AND_ACTUAL_ROUTE_CHECK_REQUIRED" };
        } catch { this.withdraw(); return { status: "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
    async undo(): Promise<object> {
        if (this.#busy || !this.available()) return { status: "UNAVAILABLE" }; this.#busy = true;
        try {
            if (!clineDefaultPathsEnvironment(process.env)) return { status: "CLINE_DEFAULT_PROFILE_REQUIRED" };
            const pin = await this.artifact();
            const saved = this.context.globalState.get<{ receipt: ClineReceipt; root: string; paths: Record<ClineFileKey, string> }>(RECEIPT);
            const root = vscode.workspace.workspaceFolders![0].uri.toString(), paths = this.paths();
            if (!saved || saved.root !== root || JSON.stringify(saved.paths) !== JSON.stringify(paths)) return { status: "UNAVAILABLE" };
            const result = await undoClineFiles(saved.receipt, this.dependencies(paths, () => this.available() && clineDefaultPathsEnvironment(process.env)
                && vscode.extensions.getExtension("saoudrizwan.claude-dev")?.packageJSON?.version === pin.version
                && vscode.workspace.workspaceFolders?.[0]?.uri.toString() === root, saved.receipt.owner), pin.version);
            if (result.status === "RESTORED") {
                this.withdraw("CLINE_CONFIGURATION_RESTORED"); await this.context.globalState.update(RECEIPT, undefined);
                this.#admissionGuard?.dispose(); this.#admissionGuard = undefined;
            }
            return { status: result.status };
        } catch { return { status: "UNAVAILABLE" }; } finally { this.#busy = false; }
    }
}
export function registerClineAdapter(context: vscode.ExtensionContext, manager: BrokerManager, reader: ProjectReaderBridge): void {
    const adapter = new ClineAdapter(context, manager, reader);
    context.subscriptions.push(adapter, vscode.commands.registerCommand("soterai.configurePinnedCline", async () => {
        const result = await adapter.configure() as { status: string };
        if (result.status === "CLINE_HOOKS_AND_REMOTE_CONFIG_OPT_OUT_REQUIRED") void vscode.window.showWarningMessage("This Cline profile needs hooks enabled, remote configuration opted out and no legacy custom-header override. Review Cline settings before applying SoterAI setup.");
        else if (result.status === "CLINE_PROVIDER_SELECTION_UNSUPPORTED") void vscode.window.showWarningMessage("Select the same OpenAI-compatible model for both Cline Plan and Act modes and disable subagents, cloud sessions and worktrees before setup. Provider, model and mode changes require reviewed restoration and a new managed session.");
        else if (result.status === "CLINE_LEGACY_ROUTE_OVERRIDE_UNSUPPORTED") void vscode.window.showWarningMessage("Cline has a legacy provider URL override that can bypass the managed route. Review and clear that override in Cline before setup. Changing a settings file outside Cline does not refresh its cached state.");
        else if (result.status === "CLINE_DEFAULT_PROFILE_REQUIRED") void vscode.window.showWarningMessage("This Cline session uses custom profile/settings paths. The adapter supports the default profile; review those overrides before setup. No default-profile files were changed.");
        else if (result.status === "ANOTHER_PROJECT_OWNS_SHARED_CLINE_CONFIG") void vscode.window.showWarningMessage("This Cline profile is configured for another project. Restore its previous config in the owner project before setting up this project.");
        else if (result.status === "CLINE_RESTORE_REQUIRED") void vscode.window.showWarningMessage("Review and restore the previous managed Cline configuration before setting up a fresh session. Changed files need review; retained encrypted backups remain available.");
        else if (!["APPLIED", "ALREADY_CONFIGURED", "CANCELLED"].includes(result.status)) void vscode.window.showWarningMessage("Cline setup is incomplete and its route remains unverified. Review current tool settings and retained encrypted backups before retrying.");
        return result;
    }),
        vscode.commands.registerCommand("soterai.restorePinnedCline", () => adapter.undo()), vscode.commands.registerCommand("soterai.clineAdapterStatus", async () => { await adapter.validateSession(); return adapter.status(); }),
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) adapter.withdraw(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => adapter.withdraw()));
}
