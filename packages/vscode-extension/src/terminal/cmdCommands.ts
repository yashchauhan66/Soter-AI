import * as vscode from "vscode";
import { parseCmdCommand } from "../../../core/src/CmdCommand";
import { CmdWorker, CMD_EXECUTABLE } from "./CmdWorker";
export const CMD_HELP = "Managed checks — declared cmd commands\r\nHidden input; help and cls are local. ver, cd, dir, ASCII echo and bounded timeout run in the installed cmd.\r\ntype/find/set/copy use reviewed safe views; set values are masked. Expansions, chains, redirects, interpreters and unsupported syntax withhold.\r\nNo unmanaged shell, native read or upload interception.\r\n";
import { CheckedPowerShellSession, type ManagedReaderBridge } from "./CheckedPowerShellSession";
import { CheckedCmdProfile, PROFILE_ID, PROFILE_NAME } from "./CheckedCmdProfile";
import { PowerShell51Terminal } from "./PowerShell51Terminal";
import { managedRootIdentity } from "./ManagedOutputBinding";
import type { PowerShell51Snapshot } from "./PowerShell51Worker";

const OWNERSHIP = "soterai.lite.cmd.ownership.v1";
type Row = Omit<PowerShell51Snapshot, "state"> & { state: PowerShell51Snapshot["state"] | "UNVERIFIED" };
type Vault = ConstructorParameters<typeof CheckedPowerShellSession>[0]["vault"];
type Controller = { status(): unknown; shutdown(): Promise<void>; dispose(): void };
const active = new Set<Controller>();
export async function stopCheckedCmd(): Promise<void> { await Promise.all([...active].map(controller => controller.shutdown())); }
function parseRows(value: unknown): Row[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 64) throw new Error();
    const arrayFields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(arrayFields).length !== value.length + 1) throw new Error();
    for (let index = 0; index < value.length; index++) if (!arrayFields[String(index)] || !Object.hasOwn(arrayFields[String(index)], "value") || !arrayFields[String(index)].enumerable) throw new Error();
    const seen = new Set<string>();
    return value.map(item => {
        if (!item || typeof item !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error();
        const fields = Object.getOwnPropertyDescriptors(item);
        if (Reflect.ownKeys(fields).some(key => typeof key !== "string" || !["id", "state", "pid", "exitCode"].includes(key) || !Object.hasOwn(fields[key], "value"))) throw new Error();
        const row = item as Row;
        if (typeof row.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)
            || seen.has(row.id.toLowerCase()) || !["READY", "BLOCKED", "RUNNING", "CANCEL_PENDING", "STOP_UNCONFIRMED", "EXITED", "CANCELLED", "UNVERIFIED"].includes(row.state)
            || Object.hasOwn(row, "pid") && (!Number.isInteger(row.pid) || row.pid! <= 0 || row.pid! > 2147483647)
            || Object.hasOwn(row, "exitCode") && (!Number.isInteger(row.exitCode) || row.exitCode! < -2147483648 || row.exitCode! > 2147483647)) throw new Error();
        seen.add(row.id.toLowerCase());
        return Object.freeze({ id: row.id, state: row.state, ...(row.pid === undefined ? {} : { pid: row.pid }), ...(row.exitCode === undefined ? {} : { exitCode: row.exitCode }) });
    });
}

/** Registers only the private checked route; caller arguments never provide code. */
export function registerCheckedCmd(context: vscode.ExtensionContext, vault: Vault, reader?: ManagedReaderBridge): Controller {
    let disposed = false, stopped = false, valid = true, inputPending = 0, version = 0, written = -1;
    let recovered: Row[] = [];
    try { recovered = parseRows(context.globalState.get(OWNERSHIP)).map(row => Object.freeze({ ...row, state: "UNVERIFIED" })); }
    catch { valid = false; }
    const owned = new Map<string, Row>(), sessions = new Map<PowerShell51Terminal, CheckedPowerShellSession>();
    const registrations: vscode.Disposable[] = [];
    let writing: Promise<void> | undefined;
    const available = (): boolean => {
        try {
            if (disposed || stopped || !valid || process.platform !== "win32" || vscode.env.remoteName || !vscode.workspace.isTrusted
                || !reader || reader.isEnabled() !== true) return false;
            const config = vscode.workspace.getConfiguration("soterai");
            return ["lite.cmdTerminal", "lite.vaultMode", "lite.secretMatching", "lite.outputRedactor"].every(key => {
                const setting = config.inspect<boolean>(key);
                return (setting ? setting.globalValue ?? setting.defaultValue ?? true : config.get(key, true)) === true;
            });
        } catch { return false; }
    };
    const revoke = () => { for (const session of sessions.values()) session.cancel(); };
    const rows = (): Row[] => [...recovered, ...owned.values()];
    const persist = (): Promise<void> => {
        if (!valid) return Promise.resolve();
        if (writing) return writing;
        writing = (async () => {
            while (valid && written !== version) {
                const revision = version, next = rows();
                if (next.length > 64) { valid = false; revoke(); break; }
                try { await context.globalState.update(OWNERSHIP, next); written = revision; }
                catch { valid = false; revoke(); }
            }
        })().finally(() => { writing = undefined; });
        return writing;
    };
    const changed = (snapshot: PowerShell51Snapshot): void => {
        if (!valid || !owned.has(snapshot.id)) return;
        try {
            const row = parseRows([snapshot])[0];
            if (JSON.stringify(row) !== JSON.stringify(owned.get(row.id))) { owned.set(row.id, row); version++; void persist(); }
        } catch { valid = false; revoke(); }
    };
    const admit = async (snapshot: PowerShell51Snapshot): Promise<boolean> => {
        if (!available()) return false;
        try {
            const row = parseRows([snapshot])[0];
            if (row.state !== "READY" || row.pid !== undefined || owned.has(row.id) || recovered.some(prior => prior.id === row.id)) return false;
            const complete = [...owned].filter(([, prior]) => ["EXITED", "CANCELLED", "BLOCKED"].includes(prior.state));
            while (owned.size >= 32 && complete.length) { owned.delete(complete.shift()![0]); version++; }
            if (rows().length >= 64 || owned.size >= 32) return false;
            owned.set(row.id, row); version++; await persist();
            return available() && written === version;
        } catch { valid = false; revoke(); return false; }
    };
    const profile = new CheckedCmdProfile(context, available);
    const currentRoot = (value: unknown): vscode.Uri | undefined => {
        try { if (!(value instanceof vscode.Uri)) return undefined; managedRootIdentity(value); return value; } catch { return undefined; }
    };
    const choose = async (requested?: unknown): Promise<vscode.Uri | undefined> => {
        if (!available()) return undefined;
        if (requested !== undefined) return currentRoot(requested);
        const folders = vscode.workspace.workspaceFolders;
        const folder = folders?.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
        return available() ? currentRoot(folder?.uri) : undefined;
    };
    const create = (root: vscode.Uri): vscode.ExtensionTerminalOptions | undefined => {
        if (!available() || !currentRoot(root) || sessions.size >= 32) return undefined;
        const enabled = () => available() && currentRoot(root) !== undefined;
        const outputVault = { createManagedOutputFilter: (uri: vscode.Uri, live: () => boolean) => vault.createManagedOutputFilter(uri, live, "cmd") };
        const session = new CheckedPowerShellSession({ root, reader: reader!, vault: outputVault, enabled, parentEnvironment: process.env }, { admitWorker: admit, workerChanged: changed, parseCommand: parseCmdCommand, createWorker: options => new CmdWorker({ ...options, executable: CMD_EXECUTABLE }) });
        const pty = new PowerShell51Terminal(session, CMD_HELP, "cls"); sessions.set(pty, session);
        pty.onDidClose(() => { sessions.delete(pty); });
        return { name: PROFILE_NAME, pty };
    };
    const open = async (requested?: unknown): Promise<{ pty: PowerShell51Terminal } | undefined> => {
        const root = await choose(requested); if (!root) return undefined;
        const options = create(root); if (!options) return undefined;
        try { const terminal = vscode.window.createTerminal(options); terminal.show(); return { pty: options.pty as PowerShell51Terminal }; }
        catch { (options.pty as PowerShell51Terminal).close(); return undefined; }
    };
    const controller: Controller = {
        status: () => ({ available: available(), ownership: valid && written === version ? "SAVED" : "UNVERIFIED", recovered: [...recovered], workers: [...owned.values()], terminals: sessions.size }),
        async shutdown() {
            stopped = true; revoke();
            for (const [pty, session] of sessions) { const snapshot = session.snapshot().worker; if (snapshot) changed(snapshot); pty.close(); }
            if (valid) {
                version++; let timer: ReturnType<typeof setTimeout> | undefined;
                try { await Promise.race([persist(), new Promise<void>(done => { timer = setTimeout(() => { valid = false; done(); }, 500); })]); }
                finally { if (timer) clearTimeout(timer); }
            }
        },
        dispose() { if (disposed) return; disposed = true; stopped = true; revoke(); for (const pty of sessions.keys()) pty.close();
            clearInterval(poll); registrations.forEach(item => item.dispose()); active.delete(controller); void persist(); },
    };
    const reg = (id: string, handler: (...args: unknown[]) => unknown) => registrations.push(vscode.commands.registerCommand(id, handler));
    reg("soterai.configureCheckedCmd", async requested => { const root = await choose(requested); return root ? profile.configure(root) : { status: "UNAVAILABLE" }; });
    reg("soterai.restoreCheckedCmd", async requested => { const root = await choose(requested); return root ? profile.restore(root) : { status: "UNAVAILABLE" }; });
    reg("soterai.openCheckedCmd", async requested => ({ status: await open(requested) ? "OPENED" : "UNAVAILABLE" }));
    reg("soterai.runCheckedCmd", async () => {
        if (!available() || inputPending >= 2) return { status: "UNAVAILABLE" };
        inputPending++;
        try {
            const root = await choose(); if (!root) return { status: "UNAVAILABLE" };
            const input = await vscode.window.showInputBox({ title: "Run a checked cmd command", prompt: "Declared commands only; input stays hidden and is not saved.", password: true, ignoreFocusOut: false });
            if (input === undefined) return { status: "CANCELLED" };
            if (!available() || !currentRoot(root)) return { status: "UNAVAILABLE" };
            const tab = await open(root); if (!tab) return { status: "UNAVAILABLE" };
            void tab.pty.run(input); return { status: "RUN_REQUESTED" };
        } finally { inputPending--; }
    });
    reg("soterai.checkedCmdStatus", controller.status);
    registrations.push(vscode.window.registerTerminalProfileProvider(PROFILE_ID, { async provideTerminalProfile(token) {
        const root = await choose(); if (!root || token.isCancellationRequested) return undefined;
        const options = create(root); return options ? new vscode.TerminalProfile(options) : undefined;
    } }), vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) revoke(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { for (const session of sessions.values()) session.cancel(); }),
    vscode.window.onDidCloseTerminal(terminal => { const options = terminal.creationOptions; if ("pty" in options && sessions.has(options.pty as PowerShell51Terminal)) (options.pty as PowerShell51Terminal).close(); }));
    const poll = setInterval(() => { for (const session of sessions.values()) { const snapshot = session.snapshot().worker; if (snapshot) changed(snapshot); } }, 250);
    poll.unref(); active.add(controller); context.subscriptions.push(controller);
    return controller;
}
