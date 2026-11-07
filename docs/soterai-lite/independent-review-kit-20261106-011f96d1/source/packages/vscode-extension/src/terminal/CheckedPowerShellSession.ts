import * as vscode from "vscode";
import * as path from "node:path";
import { constants, lstatSync, openSync, closeSync, writeFileSync, fsyncSync, fstatSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parsePowerShell51Command, PS51_LIMITS, type PowerShell51Command } from "../../../core/src/PowerShell51Command";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";
import type { AccessResult } from "../project-privacy/ProjectFileAccess";
import { BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { PowerShell51Worker, POWERSHELL51_EXECUTABLE, powerShell51Environment, type PowerShell51Output, type PowerShell51Snapshot } from "./PowerShell51Worker";
import { managedPathIdentity, managedRootIdentity, managedPolicyBinding } from "./ManagedOutputBinding";
import { prepareCheckedGitMetadata, type CheckedGitMetadata } from "./CheckedGitMetadata";

export interface ManagedReaderBridge { read(uri: vscode.Uri): Promise<AccessResult>; revoke(): void; isEnabled(): boolean }
interface Filter extends PowerShell51Output { available(): boolean; canRelease(): boolean }
interface Options { root: vscode.Uri; reader: ManagedReaderBridge;
    vault: { createManagedOutputFilter(root: vscode.Uri, enabled: () => boolean, route?: "ps51" | "cmd" | "gitBash"): Promise<Filter> };
    enabled: () => boolean; parentEnvironment: NodeJS.ProcessEnv }
interface Dependencies { createWorker?: (options: ConstructorParameters<typeof PowerShell51Worker>[0]) => Pick<PowerShell51Worker, "start" | "completion" | "snapshot" | "cancel" | "dispose">;
    parseCommand?: (input: unknown) => PowerShell51Command | undefined;
    admitWorker?: (snapshot: PowerShell51Snapshot) => Promise<boolean>;
    workerChanged?: (snapshot: PowerShell51Snapshot) => void;
    reviewCopy?: (source: vscode.Uri, destination: vscode.Uri) => Promise<boolean> }
const withheld = (): OutputResult => Object.freeze({ status: "WITHHELD", stdout: "", stderr: "", redacted: false, reason: "checked_command_withheld" });
const privateDestination = /(?:^|[\\/])(?:\.git|\.soterai)(?:[\\/]|$)|(?:^|[\\/])(?:\.aiignore|\.soterai-policy\.json)$/i;

/** Trusted finite-command dispatcher. Original files never enter the PS worker;
 * approved safe views remain subject to complete registered output filtering. */
export class CheckedPowerShellSession {
    static #pending = 0;
    #options: Options;
    #deps: Dependencies;
    #busy = false;
    #closed = false;
    #generation = 0;
    #worker: ReturnType<NonNullable<Dependencies["createWorker"]>> | undefined;
    #filter: Filter | undefined;
    constructor(options: Options, deps: Dependencies = {}) { this.#options = options; this.#deps = deps; }
    snapshot(): Readonly<{ state: "IDLE" | "BUSY" | "CLOSED"; worker?: PowerShell51Snapshot }> {
        return Object.freeze({ state: this.#closed ? "CLOSED" : this.#busy ? "BUSY" : "IDLE", ...(this.#worker ? { worker: this.#worker.snapshot() } : {}) });
    }
    cancel(): void { this.#generation++; try { this.#options.reader.revoke(); } catch { /* Constant withheld result. */ } this.#filter?.cancel(); this.#worker?.cancel(); }
    dispose(): void { this.#closed = true; this.cancel(); }
    #available(generation: number): boolean {
        try { return !this.#closed && generation === this.#generation && this.#options.enabled() === true && this.#options.reader.isEnabled() === true; } catch { return false; }
    }
    async execute(input: unknown): Promise<OutputResult> {
        const command = (this.#deps.parseCommand ?? parsePowerShell51Command)(input);
        if (!command || this.#busy || this.#closed || CheckedPowerShellSession.#pending >= PS51_LIMITS.maxWorkers) return withheld();
        const generation = this.#generation;
        if (!this.#available(generation)) return withheld();
        this.#busy = true; CheckedPowerShellSession.#pending++;
        try {
            const { root, reader, vault } = this.#options, rootIdentity = managedRootIdentity(root);
            const live = () => this.#available(generation) && managedRootIdentity(root) === rootIdentity;
            let file: vscode.Uri | undefined, identity: string | undefined, destination: vscode.Uri | undefined, parentIdentity: string | undefined;
            let text: string | undefined, directory: vscode.Uri | undefined, directoryIdentity: string | undefined;
            let git: CheckedGitMetadata | undefined;
            if (["READ", "SEARCH", "COPY"].includes(command.kind)) {
                if (command.kind !== "READ" && command.kind !== "SEARCH" && command.kind !== "COPY") return withheld();
                file = vscode.Uri.file(path.resolve(root.fsPath, command.path)); identity = managedPathIdentity(root.fsPath, file.fsPath, false);
                if (command.kind === "COPY") {
                    if (privateDestination.test(command.destination)) return withheld();
                    destination = vscode.Uri.file(path.resolve(root.fsPath, command.destination));
                    parentIdentity = managedPathIdentity(root.fsPath, path.dirname(destination.fsPath), true);
                    const boundary = await BoundarySnapshot.load();
                    if (!live() || boundary.blocks(destination) || boundary.isSensitive(destination) || boundary.classify(destination).level !== "normal") return withheld();
                    try { lstatSync(destination.fsPath); return withheld(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") return withheld(); }
                    const review = this.#deps.reviewCopy ?? (async (source, target) => await vscode.window.showWarningMessage("Create a new file containing only the approved, filtered safe view?", {
                        modal: true, detail: JSON.stringify({ source: path.relative(root.fsPath, source.fsPath), destination: path.relative(root.fsPath, target.fsPath), content: "Reviewed safe output only; existing files are never replaced" }, null, 2),
                    }, "Create safe copy") === "Create safe copy");
                    if (!await review(file, destination) || !live()) return withheld();
                }
                const result = await reader.read(file);
                if (result.status !== "ALLOWED_ONCE" || !live() || managedPathIdentity(root.fsPath, file.fsPath, false) !== identity) return withheld();
                text = result.text;
                if (command.kind === "SEARCH" || command.kind === "READ" && command.lines) {
                    const lines = text.split("\n"); if (lines.at(-1) === "") lines.pop();
                    const selected = command.kind === "SEARCH" ? lines.filter(line => line.includes(command.needle))
                        : command.lines!.side === "first" ? lines.slice(0, command.lines!.count) : lines.slice(-command.lines!.count);
                    text = selected.length ? selected.join("\n") + "\n" : "";
                }
            } else if (command.kind === "ENV") {
                const environment = powerShell51Environment(this.#options.parentEnvironment);
                text = Object.keys(environment).sort().filter(name => !command.name || name.toLowerCase() === command.name.toLowerCase()).map(name => name + "=[MASKED]\n").join("");
            } else if (command.kind === "PUBLIC" && command.action === "list") {
                directory = vscode.Uri.file(path.resolve(root.fsPath, command.args[0])); directoryIdentity = managedPathIdentity(root.fsPath, directory.fsPath, true);
                const boundary = await BoundarySnapshot.load();
                // BoundarySnapshot classifies file-relative paths. For root
                // names only, use an in-root metadata target without reading it.
                const policyTarget = path.relative(root.fsPath, directory.fsPath) === ""
                    ? vscode.Uri.joinPath(root, "__soterai_root_directory_metadata__") : directory;
                if (!live() || boundary.blocks(policyTarget) || boundary.isSensitive(policyTarget) || boundary.classify(policyTarget).level !== "normal") return withheld();
            } else if (command.kind === "GIT") {
                git = await prepareCheckedGitMetadata(root.fsPath, this.#options.parentEnvironment, live);
                if (!git || !live()) return withheld();
            }
            if (!live()) return withheld();
            const policy = managedPolicyBinding(root);
            const guard = (): boolean => {
                try { return live() && (!git || git.available()) && managedPolicyBinding(root) === policy
                    && (!file || managedPathIdentity(root.fsPath, file.fsPath, false) === identity)
                    && (!directory || managedPathIdentity(root.fsPath, directory.fsPath, true) === directoryIdentity)
                    && (!destination || managedPathIdentity(root.fsPath, path.dirname(destination.fsPath), true) === parentIdentity); }
                catch { return false; }
            };
            this.#filter = await vault.createManagedOutputFilter(root, guard);
            if (!guard() || !this.#filter.available()) return withheld();
            if (command.kind === "PUBLIC" || command.kind === "GIT") {
                this.#worker = (this.#deps.createWorker ?? (options => new PowerShell51Worker(options)))({ id: randomUUID(), executable: POWERSHELL51_EXECUTABLE,
                    root: root.fsPath, operation: command, ...(git ? { git } : {}), parentEnvironment: this.#options.parentEnvironment, output: this.#filter, enabled: guard });
                let admitted = true, observed = true;
                if (this.#deps.admitWorker) { try { admitted = await this.#deps.admitWorker(this.#worker.snapshot()) === true; } catch { admitted = false; } }
                const report = (snapshot: PowerShell51Snapshot) => {
                    try { this.#deps.workerChanged?.(snapshot); } catch { observed = false; this.#worker!.cancel(); }
                };
                if (!admitted || !guard()) this.#worker.cancel();
                else {
                    try { report(await this.#worker.start()); }
                    catch { observed = false; this.#worker.cancel(); }
                }
                // Even a failed observer/admission never discards owned close
                // and pipe completion. Cancellation requests do not prove exit.
                const result = await this.#worker.completion; report(result.snapshot);
                return admitted && observed && guard() && this.#filter.canRelease() ? result.output : withheld();
            }
            if (text === undefined || this.#filter.push("stdout", Buffer.from(text, "utf8")).status !== "BUFFERED") return withheld();
            if (destination) {
                const boundary = await BoundarySnapshot.load();
                if (!guard() || boundary.blocks(destination) || boundary.isSensitive(destination) || boundary.classify(destination).level !== "normal") return withheld();
            }
            // No await after the filter's last private key/cipher/policy check:
            // finished filters are single-use and cannot guard a later publish.
            const result = this.#filter.finish(0); if (result.status !== "COMPLETE" || !guard()) return withheld();
            if (destination) {
                const descriptor = openSync(destination.fsPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
                try {
                    if (!guard() || fstatSync(descriptor).nlink !== 1) return withheld();
                    writeFileSync(descriptor, result.stdout, "utf8"); fsyncSync(descriptor);
                } finally { closeSync(descriptor); }
                return Object.freeze({ status: "COMPLETE", stdout: "", stderr: "", redacted: result.redacted, exitCode: 0 });
            }
            return result;
        } catch { return withheld(); }
        finally {
            try { this.#filter?.dispose(); } catch { /* No fallback. */ }
            this.#filter = undefined; this.#worker = undefined; this.#busy = false; CheckedPowerShellSession.#pending--;
        }
    }
}
