import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { managedRootIdentity } from "./ManagedOutputBinding";

export const PROFILE_ID = "soterai.ps51.checked";
export const PROFILE_NAME = "SoterAI PowerShell 5.1 (checked commands)";
export const PROFILE_STATE = "soterai.lite.ps51.profile.v1";
const SETTING = "defaultProfile.windows";
type Prior = { present: false } | { present: true; value: string | null };
type Receipt = { schemaVersion: 1; root: string; target: vscode.ConfigurationTarget; phase: "PREPARED" | "APPLIED"; before: Prior; after: typeof PROFILE_NAME };
type Result = { status: "SAVED" | "CANCELLED" | "UNAVAILABLE" | "FAILED" };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function prior(value: unknown): Prior {
    if (value === undefined) return { present: false };
    if (value !== null && (typeof value !== "string" || value.length > 256 || /[\x00-\x1f\x7f]/.test(value))) throw new Error();
    return { present: true, value: value as string | null };
}
function parseReceipt(value: unknown): Receipt {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const record = value as Receipt;
    if (Object.keys(record).sort().join(",") !== "after,before,phase,root,schemaVersion,target" || record.schemaVersion !== 1
        || typeof record.root !== "string" || record.root.length > 4096 || ![vscode.ConfigurationTarget.Workspace, vscode.ConfigurationTarget.WorkspaceFolder].includes(record.target)
        || !["PREPARED", "APPLIED"].includes(record.phase) || record.after !== PROFILE_NAME || !record.before || typeof record.before !== "object"
        || typeof record.before.present !== "boolean") throw new Error();
    const expected = record.before.present ? prior(record.before.value) : prior(undefined);
    if (!equal(record.before, expected) || record.before.present && !expected.present) throw new Error();
    return { schemaVersion: 1, root: record.root, target: record.target, phase: record.phase, before: expected, after: PROFILE_NAME };
}

/** Owns only one project setting and its bounded restore receipt. Preview uses
 * private metadata documents; it never opens settings.json or a shell profile. */
export class CheckedPowerShellProfile {
    #context: vscode.ExtensionContext;
    #enabled: () => boolean;
    #busy = false;
    #views = new Map<string, string>();
    #scheme = "soterai-ps51-profile-" + randomUUID();
    constructor(context: vscode.ExtensionContext, enabled: () => boolean) {
        this.#context = context; this.#enabled = enabled;
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(this.#scheme, {
            provideTextDocumentContent: uri => this.#views.get(uri.toString()) ?? "Profile preview expired.",
        }), { dispose: () => this.#views.clear() });
    }
    configure(root: vscode.Uri): Promise<Result> { return this.#change(root, false); }
    restore(root: vscode.Uri): Promise<Result> { return this.#change(root, true); }
    #available(): boolean { try { return this.#enabled() === true; } catch { return false; } }
    #target(): vscode.ConfigurationTarget {
        return (vscode.workspace.workspaceFolders?.length ?? 0) > 1 && vscode.workspace.workspaceFile?.scheme === "file"
            ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    }
    #read(root: vscode.Uri, target: vscode.ConfigurationTarget): Prior {
        const inspected = vscode.workspace.getConfiguration("terminal.integrated", root).inspect<string | null>(SETTING);
        return prior(target === vscode.ConfigurationTarget.WorkspaceFolder ? inspected?.workspaceFolderValue : inspected?.workspaceValue);
    }
    #view(value: Prior): vscode.Uri {
        const uri = vscode.Uri.parse(this.#scheme + ":/" + randomUUID() + "/terminal-profile.json");
        this.#views.set(uri.toString(), JSON.stringify({ "terminal.integrated.defaultProfile.windows": value.present ? value.value : "(no project override)" }, null, 2));
        return uri;
    }
    async #change(root: vscode.Uri, restore: boolean): Promise<Result> {
        if (this.#busy || !this.#available()) return { status: "UNAVAILABLE" };
        this.#busy = true;
        try {
            const identity = managedRootIdentity(root), target = this.#target(), before = this.#read(root, target);
            const raw = this.#context.workspaceState.get<unknown>(PROFILE_STATE);
            let record: Receipt | undefined;
            if (raw !== undefined) {
                record = parseReceipt(raw);
                if (record.root !== root.toString() || record.target !== target) throw new Error();
            }
            if (restore && !record) return { status: "UNAVAILABLE" };
            if (!restore && record) return equal(before, prior(PROFILE_NAME)) && record.phase === "APPLIED" ? { status: "SAVED" } : { status: "FAILED" };
            if (!restore && equal(before, prior(PROFILE_NAME))) return { status: "UNAVAILABLE" }; // No prior value is owned to restore.
            if (restore && !equal(before, prior(PROFILE_NAME)) && !(record!.phase === "PREPARED" && equal(before, record!.before))) throw new Error();
            const next = restore ? record!.before : prior(PROFILE_NAME);
            const fresh = () => this.#available() && managedRootIdentity(root) === identity && this.#target() === target
                && equal(this.#read(root, target), before) && equal(this.#context.workspaceState.get(PROFILE_STATE), raw);
            this.#views.clear(); const oldUri = this.#view(before), nextUri = this.#view(next);
            await vscode.commands.executeCommand("vscode.diff", oldUri, nextUri, "Review project terminal profile");
            if (!fresh()) return { status: this.#available() ? "FAILED" : "UNAVAILABLE" };
            const action = restore ? "Restore previous terminal profile" : "Use checked PowerShell profile";
            if (await vscode.window.showWarningMessage("Apply this terminal profile change to the selected project?", { modal: true,
                detail: "Only terminal.integrated.defaultProfile.windows changes. Checked commands require managed review; other terminals remain outside these checks." }, action) !== action) return { status: "CANCELLED" };
            if (!fresh()) return { status: this.#available() ? "FAILED" : "UNAVAILABLE" };
            const prepared: Receipt = restore ? { ...record!, phase: "PREPARED" }
                : { schemaVersion: 1, root: root.toString(), target, phase: "PREPARED", before, after: PROFILE_NAME };
            await this.#context.workspaceState.update(PROFILE_STATE, prepared);
            const bound = () => this.#available() && managedRootIdentity(root) === identity && this.#target() === target
                && equal(this.#context.workspaceState.get(PROFILE_STATE), prepared);
            if (!bound() || !equal(this.#read(root, target), before)) throw new Error();
            if (!equal(before, next)) await vscode.workspace.getConfiguration("terminal.integrated", root).update(SETTING, next.present ? next.value : undefined, target);
            if (!bound() || !equal(this.#read(root, target), next)) throw new Error();
            const final = restore ? undefined : { ...prepared, phase: "APPLIED" as const };
            await this.#context.workspaceState.update(PROFILE_STATE, final);
            if (!this.#available() || managedRootIdentity(root) !== identity || this.#target() !== target || !equal(this.#read(root, target), next)
                || !equal(this.#context.workspaceState.get(PROFILE_STATE), final)) throw new Error();
            return { status: "SAVED" };
        } catch { return { status: this.#available() ? "FAILED" : "UNAVAILABLE" }; }
        finally { this.#busy = false; }
    }
}
