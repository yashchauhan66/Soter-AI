import * as vscode from "vscode";
import * as path from "node:path";
import { matchesRule, relativePath, type PathRule } from "./policy";

export interface RestrictionResult { status: "SAVED" | "FAILED" | "CANCELLED" | "UNAVAILABLE" }

/** This flag controls new manual saves, never enforcement of accepted denies. */
export function restrictionSaveEnabled(): boolean {
    try {
        const config = vscode.workspace.getConfiguration("soterai");
        const inspected = config.inspect<boolean>("lite.restrictionSave");
        // Machine-scoped flags cannot be weakened by workspace/language values.
        const value = inspected
            ? inspected.globalValue ?? inspected.defaultValue ?? true
            : config.get<boolean>("lite.restrictionSave", true);
        return value === true;
    } catch { return false; }
}

export class RestrictionUnavailable extends Error {
    constructor() { super("Manual restriction setup is unavailable."); }
}
export function requireRestrictionSave(): void {
    if (!restrictionSaveEnabled()) throw new RestrictionUnavailable();
}

/** Bind queued work and its result to the project the owner actually chose. */
export function assertRestrictionWorkspace(root: string, uri?: vscode.Uri): void {
    const active = vscode.workspace.workspaceFolders?.some(folder => folder.uri.scheme === "file" && folder.uri.toString() === root);
    if (!active || (uri && vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== root)) {
        throw new Error("The chosen workspace changed during restriction setup.");
    }
}

interface PendingRestriction { scope?: PathRule }
const pending = new Map<string, Set<PendingRestriction>>();
const activity = new vscode.EventEmitter<string>();
/** Metadata only; bracket manual intent, not repeated snapshot policy enrollment. */
export const onDidChangeManualRestriction = activity.event;
export function manualRestrictionPending(root: string, uri?: vscode.Uri): boolean {
    const operations = pending.get(root);
    if (!operations?.size) return false;
    if (!uri) return true;
    try {
        const folder = vscode.workspace.workspaceFolders?.find(item => item.uri.toString() === root);
        if (!folder) return true;
        const relative = relativePath(path.relative(folder.uri.fsPath, uri.fsPath));
        return [...operations].some(item => !item.scope || matchesRule(relative.normalize("NFC"), { ...item.scope, pattern: item.scope.pattern.normalize("NFC") }));
    } catch { return true; }
}

export async function withManualRestriction<T>(root: string, operation: () => Promise<T>, scope?: PathRule): Promise<T> {
    requireRestrictionSave();
    return withPendingRestriction(root, operation, scope);
}

/** Shared pending lifecycle; each operation must validate its own setup flag. */
export async function withPendingRestriction<T>(root: string, operation: () => Promise<T>, scope?: PathRule): Promise<T> {
    assertRestrictionWorkspace(root);
    const operations = pending.get(root) ?? new Set<PendingRestriction>();
    const record = { scope };
    operations.add(record);
    pending.set(root, operations);
    activity.fire(root);
    try { return await operation(); }
    finally {
        operations.delete(record);
        if (!operations.size) pending.delete(root);
        activity.fire(root);
    }
}

/** Validate child metadata; never reflect arbitrary command output or errors. */
export function restrictionResult(value: unknown): RestrictionResult {
    const status = value && typeof value === "object" && !Array.isArray(value)
        ? (value as { status?: unknown }).status : undefined;
    switch (status) {
        case "SAVED": case "FAILED": case "CANCELLED": case "UNAVAILABLE": return { status };
        default: return { status: "FAILED" };
    }
}
