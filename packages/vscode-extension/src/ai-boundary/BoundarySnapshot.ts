import * as vscode from "vscode";
import * as path from "node:path";
import { lstat } from "node:fs/promises";
import { DEFAULT_PROJECT_POLICY, classifyPath, parseProjectPolicy, type ProjectPolicy } from "@soterai/guard-core";
import { readBoundaryFile } from "./readFile";
import { matchesGlob, matchesRule, parseAiIgnore, parseManualRules, redactRegions, relativePath, OMITTED, type ManualRules } from "./policy";

export const RULES_KEY = "soterai.aiForbidden.v1";
let state: vscode.Memento | undefined;
const stateWrites = new WeakMap<vscode.Memento, Promise<unknown>>();
let legacyProtected: ((relativePath: string) => boolean) | undefined;
export function setBoundaryProtectedChecker(checker: (relativePath: string) => boolean): void { legacyProtected = checker; }
export function initializeBoundaryState(value: vscode.Memento): void { state = value; }
export function storedRules(root: string): ManualRules {
    const all = state?.get<Record<string, unknown>>(RULES_KEY, {});
    if (all !== undefined && (!all || typeof all !== "object" || Array.isArray(all))) throw new Error("Invalid AI policy storage.");
    return parseManualRules(all?.[root]);
}
export function updateRules(root: string, update: (rules: ManualRules) => ManualRules): Promise<void> {
    const target = state;
    if (!target) return Promise.reject(new Error("AI policy storage is unavailable."));
    const write = (stateWrites.get(target) ?? Promise.resolve()).then(async () => {
        const all = target.get<Record<string, unknown>>(RULES_KEY, {});
        if (!all || typeof all !== "object" || Array.isArray(all)) throw new Error("Invalid AI policy storage.");
        const validated = parseManualRules(update(parseManualRules(all[root])));
        await target.update(RULES_KEY, { ...all, [root]: validated });
    });
    stateWrites.set(target, write.catch(() => undefined));
    return write;
}
export function saveRules(root: string, rules: ManualRules): Promise<void> {
    return updateRules(root, () => rules);
}

interface RootPolicy { folder: vscode.WorkspaceFolder; globs: string[]; manual: ManualRules; invalid: boolean; project: ProjectPolicy }

async function optionalPolicyFile(folder: vscode.WorkspaceFolder, rel: string): Promise<string | undefined> {
    const target = path.join(folder.uri.fsPath, rel);
    try { await lstat(target); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
    return readBoundaryFile(folder.uri.fsPath, target);
}

/** Immutable policy per collection. Invalid/unreadable existing policy denies that root. */
export class BoundarySnapshot {
    private constructor(private readonly roots: RootPolicy[]) {}

    static async load(): Promise<BoundarySnapshot> {
        const roots = await Promise.all((vscode.workspace.workspaceFolders ?? []).map(async folder => {
            const root: RootPolicy = {
                folder, globs: [...DEFAULT_PROJECT_POLICY.protectedFiles, ".git/", ".aiignore", ".soterai/", ".soterai-policy.json"],
                manual: { paths: [], regions: [] }, invalid: folder.uri.scheme !== "file",
                project: structuredClone(DEFAULT_PROJECT_POLICY),
            };
            try {
                root.manual = storedRules(folder.uri.toString());
                const ignore = await optionalPolicyFile(folder, ".aiignore");
                if (ignore !== undefined) root.globs.push(...parseAiIgnore(ignore));
                const project = await optionalPolicyFile(folder, ".soterai/policy.json");
                if (project !== undefined) {
                    const parsed: unknown = JSON.parse(project);
                    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid project policy.");
                    const protectedFiles = (parsed as { protectedFiles?: unknown })?.protectedFiles;
                    if (protectedFiles !== undefined) {
                        if (!Array.isArray(protectedFiles) || protectedFiles.some(p => typeof p !== "string" || /[\r\n]/.test(p))) throw new Error("Invalid project policy.");
                        if (protectedFiles.length > 256 || protectedFiles.some(p => p.length > 256 || !p.trim())) throw new Error("Invalid project policy.");
                    }
                    const sensitive = (parsed as { sensitivePaths?: unknown }).sensitivePaths;
                    if (sensitive !== undefined && (!Array.isArray(sensitive)
                        || sensitive.length > 256 || sensitive.some(p => typeof p !== "string" || !p.trim() || p.length > 256))) throw new Error("Invalid sensitive paths.");
                    root.project = parseProjectPolicy(parsed);
                }
            } catch { root.invalid = true; }
            return root;
        }));
        return new BoundarySnapshot(roots);
    }

    private locate(uri: vscode.Uri): { root: RootPolicy; rel: string } | undefined {
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        const root = this.roots.find(entry => entry.folder.uri.toString() === folder?.uri.toString());
        if (!root || uri.scheme !== "file") return undefined;
        try { return { root, rel: relativePath(path.relative(root.folder.uri.fsPath, uri.fsPath)) }; }
        catch { return undefined; }
    }

    blocks(uri: vscode.Uri): boolean {
        const entry = this.locate(uri);
        if (!entry || entry.root.invalid) return true;
        if (legacyProtected?.(vscode.workspace.asRelativePath(uri))) return true;
        const classification = classifyPath(entry.rel, entry.root.project);
        return entry.root.globs.some(glob => matchesGlob(entry.rel, glob))
            || entry.root.manual.paths.some(rule => matchesRule(entry.rel, rule))
            || classification.level === "protected" || classification.action === "block";
    }

    classify(uri: vscode.Uri) {
        const entry = this.locate(uri);
        return classifyPath(entry?.rel ?? "", entry?.root.project ?? DEFAULT_PROJECT_POLICY);
    }

    hasRegions(uri: vscode.Uri): boolean {
        const entry = this.locate(uri);
        return !!entry && entry.root.manual.regions.some(r => relativePath(r.path) === entry.rel);
    }

    sanitize(uri: vscode.Uri, text: string): string {
        const entry = this.locate(uri);
        if (!entry || this.blocks(uri)) return OMITTED;
        return redactRegions(entry.rel, text, entry.root.manual.regions);
    }

    selection(uri: vscode.Uri, text: string, start: number, end: number): string {
        const entry = this.locate(uri);
        if (!entry || this.blocks(uri)) return OMITTED;
        return redactRegions(entry.rel, text, entry.root.manual.regions, start, end);
    }

    async read(uri: vscode.Uri): Promise<string> {
        const entry = this.locate(uri);
        if (!entry || this.blocks(uri)) return OMITTED;
        return this.sanitize(uri, await readBoundaryFile(entry.root.folder.uri.fsPath, uri.fsPath));
    }
}

/** Apply path/region policy to the original document before extracting a shareable selection. */
export async function applySelectionBoundary(editor: vscode.TextEditor): Promise<string> {
    try {
        const boundary = await BoundarySnapshot.load();
        if (boundary.blocks(editor.document.uri)) return OMITTED;
        await boundary.read(editor.document.uri);
        const text = editor.document.getText();
        if (Buffer.byteLength(text, "utf8") > 64 * 1024) return OMITTED;
        return boundary.selection(editor.document.uri, text,
            editor.document.offsetAt(editor.selection.start), editor.document.offsetAt(editor.selection.end));
    } catch { return OMITTED; }
}
