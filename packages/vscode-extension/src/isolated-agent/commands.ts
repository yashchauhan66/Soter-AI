import * as vscode from "vscode";
import * as path from "node:path";
import { SecretContentScanner } from "@soterai/guard-core";
import { BrokerManager, type IsolatedAgentModelRequest } from "../broker/BrokerManager";
import type { GatewayRegistrationLease, GatewayRegistrySource } from "../broker/GatewayRegistryLease";
import { VaultManager } from "../firewall/VaultManager";
import type { ProjectReaderBridge } from "../project-privacy/commands";
import { managedPolicyBinding } from "../terminal/ManagedOutputBinding";
import { onDidChangeBoundaryRules, onDidChangeOwnerPolicySession } from "../ai-boundary/BoundarySnapshot";
import type { TrustedOperationBridge } from "../secretless-operations/commands";
import type { OperationBinding } from "../../../core/src/SecretlessOperationBroker";

interface Proposal {
    readonly schemaVersion: 1; readonly image: string; readonly model: string; readonly approvalSha256: string;
    readonly snapshotSha256: string; readonly fileCount: number; readonly byteCount: number; readonly maxTurns: 8; readonly scope: string;
}
interface Result {
    status: "COMPLETE" | "DENIED" | "UNAVAILABLE"; code: string; isolationVerified: boolean; cleanupVerified?: boolean;
    turns?: number; output?: string; changedFiles?: readonly { path: string; text: string }[];
}
export interface IsolatedAgentDependencies {
    prepare(input: { root: string; image: string; files: readonly string[]; prompt: string; model: string; registeredValues?: readonly string[];
        operations?: readonly { id: string; label: string }[]; operationPolicyDigest?: string }): Promise<Proposal>;
    run(proposal: Proposal, approvalSha256: string, dependencies: {
        model(request: IsolatedAgentModelRequest, signal: AbortSignal): Promise<unknown>;
        isCurrent(): boolean; signal?: AbortSignal;
        operation?(id: string, binding: OperationBinding, signal: AbortSignal): Promise<unknown>;
    }): Promise<Result>;
    registry: GatewayRegistrySource;
    chooseFiles(root: vscode.Uri): Promise<readonly vscode.Uri[] | undefined>;
}
const IMAGE = /^[a-z0-9][a-z0-9./:_-]{0,200}@sha256:[a-f0-9]{64}$/;
function safePath(value: string): boolean {
    return !!value && value.length <= 200 && !/[:\\\x00-\x1f\x7f]/.test(value) && value.split("/").every(part => !!part && part !== "." && part !== "..")
        && !/(?:^|\/)(?:\.git|node_modules|\.soterai|\.aws|\.ssh|\.codex|\.agents|\.env(?:\.[^/]*)?)(?:\/|$)/i.test(value);
}
function enabled(): boolean {
    try { const config = vscode.workspace.getConfiguration("soterai"), field = config.inspect<boolean>("lite.isolatedAgent");
        return (field ? field.globalValue ?? field.defaultValue ?? true : config.get("lite.isolatedAgent", true)) === true;
    } catch { return false; }
}
function renderResult(result: Result): string | undefined {
    if (result.status !== "COMPLETE" || !result.isolationVerified || result.cleanupVerified !== true || typeof result.output !== "string"
        || !Array.isArray(result.changedFiles) || result.changedFiles.length > 256) return;
    const seen = new Set<string>(), rows = ["Isolated agent result for owner review", "", "Summary:", result.output];
    for (const file of result.changedFiles) {
        if (!file || typeof file.path !== "string" || !safePath(file.path) || seen.has(file.path.toLowerCase()) || typeof file.text !== "string") return;
        seen.add(file.path.toLowerCase()); rows.push("", "File: " + JSON.stringify(file.path), "BEGIN PROPOSED CONTENT", file.text, "END PROPOSED CONTENT");
    }
    const text = rows.join("\n");
    return Buffer.byteLength(text) <= 512 * 1024 ? text : undefined;
}

/** Owner-only UI; command arguments never carry proposals, files, credentials or approvals. */
export function registerIsolatedAgentCommands(context: vscode.ExtensionContext, manager: BrokerManager, reader: ProjectReaderBridge,
    overrides: Partial<IsolatedAgentDependencies> = {}, operations?: TrustedOperationBridge): void {
    const deps: IsolatedAgentDependencies = {
        prepare: input => import("../../../soterai-cli/src/isolation/agent").then(module => module.prepareProtectedAgent(input)),
        run: (proposal, approval, dependencies) => import("../../../soterai-cli/src/isolation/agent").then(module => module.runProtectedAgent(proposal, approval, dependencies)),
        registry: new VaultManager(context),
        chooseFiles: root => Promise.resolve(vscode.window.showOpenDialog({ title: "Choose the isolated agent's saved files", defaultUri: root,
            canSelectFiles: true, canSelectFolders: false, canSelectMany: true, openLabel: "Review selected files" })), ...overrides,
    };
    let disposed = false, busy = false, revision = 0, active: AbortController | undefined;
    let pending: { text: string; current(): boolean; lease: GatewayRegistrationLease } | undefined;
    const clear = () => { pending?.lease.dispose(); pending = undefined; };
    const invalidate = () => { revision++; active?.abort(); clear(); };
    const workspace = () => {
        const folders = vscode.workspace.workspaceFolders;
        return !disposed && enabled() && reader.isEnabled() && process.platform === "win32" && !vscode.env.remoteName && vscode.workspace.isTrusted
            && folders?.length === 1 && folders[0].uri.scheme === "file" ? folders[0].uri : undefined;
    };
    context.subscriptions.push(vscode.commands.registerCommand("soterai.runIsolatedAgent", async (...args: unknown[]) => {
        if (args.length || busy || !workspace()) return { status: "UNAVAILABLE" };
        busy = true; clear(); active = new AbortController();
        const controller = active, root = workspace()!, epoch = revision;
        let lease: GatewayRegistrationLease | undefined, retained = false;
        try {
            const binding = managedPolicyBinding(root);
            const operationPolicy = operations?.policyDigest();
            const allowedOperations = operations?.list() ?? [];
            const baseCurrent = () => {
                try { return !controller.signal.aborted && revision === epoch && workspace()?.toString() === root.toString() && managedPolicyBinding(root) === binding
                    && operations?.policyDigest() === operationPolicy; }
                catch { return false; }
            };
            const picked = await deps.chooseFiles(root);
            if (!picked?.length) return { status: "CANCELLED" };
            if (!baseCurrent() || picked.length > 256 || picked.some(uri => !(uri instanceof vscode.Uri) || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment)) return { status: "UNAVAILABLE" };
            const selected = picked.map(uri => ({ label: path.relative(root.fsPath, uri.fsPath).split(path.sep).join("/"), uri }))
                .sort((a, b) => a.label.localeCompare(b.label));
            const files = selected.map(choice => choice.label);
            if (files.some(file => !safePath(file)) || new Set(files.map(file => file.toLowerCase())).size !== files.length) return { status: "DENIED", code: "FILE_NOT_PUBLIC" };
            for (const choice of selected) {
                if (!baseCurrent() || vscode.workspace.textDocuments.some(document => document.uri.toString() === choice.uri.toString() && document.isDirty)
                    || await reader.classifyIntegration(choice.uri, "read", controller.signal) !== "PUBLIC") return { status: "DENIED", code: "FILE_NOT_PUBLIC" };
            }
            const image = await vscode.window.showInputBox({ title: "Choose an existing pinned Docker image", prompt: "Use a local Node image with its @sha256 digest. This command does not download images.",
                placeHolder: "node:22@sha256:…", validateInput: value => IMAGE.test(value) ? undefined : "Enter an image reference pinned by @sha256 and 64 lowercase hex characters." });
            if (image === undefined) return { status: "CANCELLED" };
            if (!baseCurrent() || !IMAGE.test(image)) return { status: "UNAVAILABLE" };
            const prompt = await vscode.window.showInputBox({ title: "Describe the isolated coding task", prompt: "Use public task details. The selected files and task are checked before execution.",
                validateInput: value => value.trim() && Buffer.byteLength(value) <= 8192 ? undefined : "Enter a task up to 8 KiB." });
            if (prompt === undefined) return { status: "CANCELLED" };
            if (!baseCurrent() || !prompt.trim() || Buffer.byteLength(prompt) > 8192) return { status: "UNAVAILABLE" };
            const model = await vscode.window.showInputBox({ title: "Choose the guarded gateway model", prompt: "Use a model supported by the configured OpenAI-compatible provider.",
                validateInput: value => value.trim() && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value) ? undefined : "Enter a model identifier up to 256 characters." });
            if (model === undefined) return { status: "CANCELLED" };
            if (!baseCurrent() || !model.trim() || model.length > 256 || /[\x00-\x1f\x7f]/.test(model)) return { status: "UNAVAILABLE" };
            lease = await deps.registry.createGatewayRegistry(baseCurrent);
            const currentLease = lease, current = () => baseCurrent() && currentLease.available();
            const proposal = await lease.use(values => deps.prepare({ root: root.fsPath, image, files, prompt, model, registeredValues: values,
                operations: allowedOperations, operationPolicyDigest: operationPolicy }));
            if (!current()) return { status: "UNAVAILABLE" };
            const approved = await vscode.window.showWarningMessage("Run this isolated coding task?", { modal: true,
                detail: `Files: ${files.map(file => JSON.stringify(file)).join(", ")}\nImage: ${proposal.image}\nModel: ${proposal.model}\nSnapshot: ${proposal.snapshotSha256}\nApproval: ${proposal.approvalSha256}\n${proposal.fileCount} files; ${proposal.byteCount} bytes; up to ${proposal.maxTurns} turns.\n\n${proposal.scope}\nThe planner and tools run in a container with direct network access disabled. Model requests pass through this window's guarded broker. Generated changes stay separate until you review them.` }, "Run reviewed isolated task");
            if (approved !== "Run reviewed isolated task") return { status: "CANCELLED" };
            if (!current()) return { status: "UNAVAILABLE" };
            const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Running reviewed isolated task", cancellable: true }, async (_progress, token) => {
                const listener = token.onCancellationRequested(() => controller.abort());
                if (token.isCancellationRequested) controller.abort();
                try {
                    if (!current()) throw Error();
                    const started = await manager.start(), session = manager.ownedSnapshot().session;
                    if (!started.running || !session || !current()) throw Error();
                    const executionCurrent = () => current() && manager.ownedSnapshot().state === "healthy" && manager.ownedSnapshot().session === session;
                    return await deps.run(proposal, proposal.approvalSha256, { signal: controller.signal, isCurrent: executionCurrent,
                        model: async (request, signal) => {
                            if (!executionCurrent() || request.model !== proposal.model || signal.aborted) throw Error("Isolated model unavailable");
                            const response = await manager.requestIsolatedAgentModel(request, signal);
                            if (!executionCurrent() || signal.aborted) throw Error("Isolated model unavailable");
                            return response;
                        }, operation: operations ? async (id, binding, signal) => {
                            if (!executionCurrent() || signal.aborted || !allowedOperations.some(item => item.id === id)) throw Error("Operation unavailable");
                            const response = await operations.executeApproved(id, binding, signal);
                            if (!executionCurrent() || signal.aborted) throw Error("Operation unavailable");
                            return response;
                        } : undefined });
                } finally { listener.dispose(); }
            });
            if (!current()) return { status: "UNAVAILABLE", code: "SESSION_CHANGED" };
            const text = renderResult(result);
            const safe = text !== undefined && await lease.use(async values => { const scan = new SecretContentScanner(values).scan(text); return scan.complete && !scan.findings.length; });
            if (safe && text !== undefined && current()) {
                pending = { text, current, lease }; retained = true;
                void vscode.window.showInformationMessage("Isolated task completed. Review its proposed changes with SoterAI: Review Isolated Agent Result.");
            }
            return { status: safe ? "COMPLETE" : result.status === "COMPLETE" ? "DENIED" : result.status,
                code: safe ? result.code : result.status === "COMPLETE" ? "RESULT_WITHHELD" : /^[A-Z_]{1,64}$/.test(result.code) ? result.code : "RUN_UNAVAILABLE",
                isolationVerified: result.isolationVerified === true, cleanupVerified: result.cleanupVerified === true,
                changedFileCount: safe ? result.changedFiles!.length : 0 };
        } catch { return { status: controller.signal.aborted ? "CANCELLED" : "UNAVAILABLE", code: "RUN_UNAVAILABLE" }; }
        finally { if (!retained) lease?.dispose(); if (active === controller) active = undefined; busy = false; }
    }), vscode.commands.registerCommand("soterai.reviewIsolatedAgentResult", async (...args: unknown[]) => {
        const result = pending;
        if (args.length || busy || !result || !result.current()) return { status: "UNAVAILABLE" };
        busy = true;
        try {
            const document = await vscode.workspace.openTextDocument({ content: result.text, language: "plaintext" });
            await vscode.window.showTextDocument(document, { preview: true });
            if (pending !== result || !result.current() || document.getText() !== result.text) return { status: "UNAVAILABLE" };
            const choice = await vscode.window.showWarningMessage("Copy these reviewed isolated changes?", { modal: true,
                detail: "The exact preview will be copied for you to apply deliberately. It includes full proposed file contents; existing project files are not changed by this action." }, "Copy reviewed changes");
            if (choice !== "Copy reviewed changes") return { status: "PREVIEWED" };
            if (pending !== result || !result.current() || document.getText() !== result.text) return { status: "UNAVAILABLE" };
            await vscode.env.clipboard.writeText(result.text);
            return { status: "COPIED" };
        } catch { return { status: "UNAVAILABLE" }; }
        finally { busy = false; }
    }), vscode.workspace.onDidChangeWorkspaceFolders(invalidate),
        vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) invalidate(); }),
        vscode.workspace.onDidSaveTextDocument(invalidate), onDidChangeBoundaryRules(invalidate), onDidChangeOwnerPolicySession(invalidate),
        { dispose() { disposed = true; invalidate(); } });
}
