import * as vscode from "vscode";
import * as path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { parseVaultAppDescriptor, type VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";
import { type FirewallDeps } from "../firewall/shared";
import { readVaultFile, samePath } from "../firewall/VaultStorage";
import { vaultRuntimeEnabled } from "../firewall/VaultManager";
import { VaultRuntime } from "./VaultRuntime";
import { VaultTaskTerminal, VaultDebugAdapter } from "./VaultSurfaces";

const TYPE = "soterai-vault";
let active: VaultRuntime | undefined;
export async function stopVaultRuntime(): Promise<void> { const runtime = active; active = undefined; if (runtime) await runtime.shutdown(); }
function definition(value: vscode.TaskDefinition): value is vscode.TaskDefinition & { descriptorId: string } {
    return value?.type === TYPE && typeof value.descriptorId === "string" && Object.keys(value).length === 2;
}
/** Native owner setup and ID-only task/debug providers. Private vault access is
 * always owned by VaultManager's fresh modal; no command returns an env object. */
export function registerVaultRuntimeCommands({ context, vault, requireTrust, refreshViews }: FirewallDeps): void {
    const runtime = new VaultRuntime(context, vault); active = runtime; context.subscriptions.push(runtime);
    const reg = (id: string, handler: (...args: unknown[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    const choose = async (requested?: unknown): Promise<VaultAppDescriptor | undefined> => {
        const all = runtime.descriptors();
        if (typeof requested === "string") return all.find(item => item.id === requested);
        if (requested !== undefined) return undefined;
        const item = await vscode.window.showQuickPick(all.map(descriptor => ({ label: path.basename(descriptor.program),
            description: `${descriptor.selections.length} selected variables`, detail: descriptor.program, descriptor })), { placeHolder: "Choose an allowlisted vault app" });
        return item?.descriptor;
    };
    const taskFor = (descriptor: VaultAppDescriptor): vscode.Task => {
        const task = new vscode.Task({ type: TYPE, descriptorId: descriptor.id }, vscode.TaskScope.Workspace,
            `Vault app: ${path.basename(descriptor.program)} (${descriptor.id.slice(0, 8)})`, "SoterAI",
            new vscode.CustomExecution(async () => new VaultTaskTerminal(runtime, descriptor.id)));
        task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Dedicated, clear: false }; return task;
    };
    reg("soterai.configureVaultApp", async () => {
        if (!vaultRuntimeEnabled() || !requireTrust("Vault applications")) return undefined;
        try {
            const app = (await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
                title: "Choose a trusted project Node app", filters: { JavaScript: ["js", "cjs", "mjs"] } }))?.[0];
            if (!app || app.scheme !== "file" || app.authority || app.query || app.fragment) return undefined;
            const folder = vscode.workspace.getWorkspaceFolder(app); if (!folder || folder.uri.scheme !== "file") return undefined;
            const program = await readVaultFile(app.fsPath, 1024 * 1024);
            const source = (await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
                defaultUri: folder.uri, title: "Choose an already migrated .env file" }))?.[0];
            if (!source || source.scheme !== "file" || source.authority || source.query || source.fragment
                || !samePath(vscode.workspace.getWorkspaceFolder(source)?.uri.fsPath ?? "", folder.uri.fsPath)) return undefined;
            const selections = await vault.runtimeSelections(source);
            const selected = await vscode.window.showQuickPick(selections.map(selection => ({ label: selection.name, picked: true, selection })),
                { canPickMany: true, placeHolder: "Select only the variables this app should receive" });
            if (!selected?.length) return undefined;
            const argsText = await vscode.window.showInputBox({ title: "Optional public app arguments", prompt: "JSON array of literal strings. Values are never substituted.", value: "[]" });
            if (argsText === undefined || argsText.length > 16384) return undefined;
            const value = parseVaultAppDescriptor({ schemaVersion: 1, id: randomUUID(), root: folder.uri.fsPath, program: app.fsPath, cwd: folder.uri.fsPath,
                source: source.fsPath, programDigest: createHash("sha256").update(program.text).digest("hex"), args: JSON.parse(argsText), selections: selected.map(item => item.selection) });
            if (!value) throw new Error(); const saved = await runtime.save(value); refreshViews();
            void vscode.window.showInformationMessage("Vault app saved. Every run asks for fresh approval; app code can inspect or upload its selected variables.");
            return { id: saved.id, saved: true };
        } catch { void vscode.window.showErrorMessage("App setup withheld. Choose a regular project Node entry and an already migrated environment file with unique variable names."); return undefined; }
    });
    reg("soterai.runVaultApp", async requested => {
        if (!vaultRuntimeEnabled() || !requireTrust("Vault applications")) return undefined;
        try { const descriptor = await choose(requested); if (!descriptor) return undefined;
            await vscode.tasks.executeTask(taskFor(descriptor)); return { descriptorId: descriptor.id, status: "TASK_REQUESTED" };
        } catch { void vscode.window.showErrorMessage("Vault app task unavailable. Existing restrictions and ciphertext are retained."); return undefined; }
    });
    reg("soterai.stopVaultApp", async requested => {
        const owned = runtime.jobs().filter(job => ["READY", "RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED"].includes(job.state));
        const id = typeof requested === "string" ? requested : requested === undefined
            ? (await vscode.window.showQuickPick(owned.map(job => ({ label: job.id, description: job.state })), { placeHolder: "Request cooperative stop of an owned app" }))?.label : undefined;
        if (id && owned.some(job => job.id === id)) runtime.stop(id);
        return runtime.jobs();
    });
    reg("soterai.vaultAppStatus", () => ({ descriptors: runtime.descriptors(), jobs: runtime.jobs() }));
    context.subscriptions.push(vscode.tasks.registerTaskProvider(TYPE, {
        provideTasks: () => vaultRuntimeEnabled() ? runtime.descriptors().map(taskFor) : [],
        resolveTask: task => definition(task.definition) && vaultRuntimeEnabled()
            ? runtime.descriptors().filter(d => d.id === task.definition.descriptorId).map(taskFor)[0] : undefined,
    }));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(TYPE, {
        provideDebugConfigurations: () => runtime.descriptors().map(d => ({ type: TYPE, request: "launch", name: `Vault app: ${path.basename(d.program)} (lifecycle only)`, descriptorId: d.id, noDebug: true })),
        resolveDebugConfiguration: async (_folder, config) => {
            if (!vaultRuntimeEnabled() || Object.keys(config).some(k => !["type", "request", "name", "descriptorId", "noDebug", "__configurationTarget"].includes(k))) return undefined;
            const descriptor = await choose(config.descriptorId); if (!descriptor) return undefined;
            return { type: TYPE, request: "launch", name: "Vault app (lifecycle only)", descriptorId: descriptor.id, noDebug: true };
        },
    }), vscode.debug.registerDebugAdapterDescriptorFactory(TYPE, {
        createDebugAdapterDescriptor: session => new vscode.DebugAdapterInlineImplementation(new VaultDebugAdapter(runtime,
            typeof session.configuration.descriptorId === "string" ? session.configuration.descriptorId : "unavailable")),
    }));
    if (runtime.jobs().some(job => job.state === "UNVERIFIED")) void vscode.window.showWarningMessage("Earlier vault app ownership is UNVERIFIED. These process IDs will not be adopted or stopped automatically.");
}
