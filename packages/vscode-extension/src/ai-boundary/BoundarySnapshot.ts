import * as vscode from "vscode";
import * as path from "node:path";
import { lstat } from "node:fs/promises";
import { DEFAULT_PROJECT_POLICY, classifyPath, parseProjectPolicy, isSensitiveFilePath, type ProjectPolicy } from "@soterai/guard-core";
import { readBoundaryFile } from "./readFile";
import { matchesGlob, matchesRule, parseAiIgnore, parseManualRules, mergeManualRules, validateGlob, redactRegions, relativePath, documentDigest, OMITTED, type ManualRules } from "./policy";
import { SENSITIVE_MARKS_KEY, parseSensitiveMarks } from "../project-privacy/SensitiveRestrictions";

export const RULES_KEY = "soterai.aiForbidden.v1";
const boundaryRulesChanged = new vscode.EventEmitter<string>();
/** Fires the workspace root only after a successful persistent rule change. No content is emitted. */
export const onDidChangeBoundaryRules = boundaryRulesChanged.event;
let state: vscode.Memento | undefined;
const stateWrites = new WeakMap<vscode.Memento, Promise<unknown>>();
let legacyProtected: ((relativePath: string) => boolean) | undefined;
export function setBoundaryProtectedChecker(checker: (relativePath: string) => boolean): void { legacyProtected = checker; }
export function initializeBoundaryState(value: vscode.Memento): void { state = value; }
function readStoredRules(target: vscode.Memento | undefined, root: string): ManualRules {
    if (!target) throw new Error("AI policy storage is unavailable.");
    const all = target?.get<Record<string, unknown>>(RULES_KEY, {});
    if (all !== undefined && (!all || typeof all !== "object" || Array.isArray(all))) throw new Error("Invalid AI policy storage.");
    const legacy = parseSensitiveMarks(target ? target.get(SENSITIVE_MARKS_KEY, {}) : {}, root);
    return mergeManualRules(parseManualRules(all?.[root]), {
        paths: legacy.map(pattern => ({ kind: "file", pattern, sensitive: true })), regions: [],
    });
}
export function storedRules(root: string): ManualRules { return readStoredRules(state, root); }
function writeRules(root: string, update: (rules: ManualRules) => ManualRules): Promise<void> {
    const target = state;
    if (!target) return Promise.reject(new Error("AI policy storage is unavailable."));
    const write = (stateWrites.get(target) ?? Promise.resolve()).then(async () => {
        const all = target.get<Record<string, unknown>>(RULES_KEY, {});
        if (!all || typeof all !== "object" || Array.isArray(all)) throw new Error("Invalid AI policy storage.");
        const validated = parseManualRules(update(readStoredRules(target, root)));
        await target.update(RULES_KEY, { ...all, [root]: validated });
        if (JSON.stringify(all[root]) !== JSON.stringify(validated)) boundaryRulesChanged.fire(root);
    });
    stateWrites.set(target, write.catch(() => undefined));
    return write;
}
const policyEnabled = () => vscode.workspace.getConfiguration("soterai").get<boolean>("hardening.addOnlyPolicy", true);
export function updateRules(root: string, update: (rules: ManualRules) => ManualRules): Promise<void> {
    if (!policyEnabled()) return Promise.reject(new Error("AI policy updates disabled; context sharing unavailable."));
    return writeRules(root, current => mergeManualRules(current, parseManualRules(update(structuredClone(current)))));
}
export function saveRules(root: string, rules: ManualRules): Promise<void> {
    return updateRules(root, () => rules);
}

/** UI review only. No rule/approval argument and no exported programmatic removal primitive. */
export async function reviewRuleRelaxation(): Promise<void> {
    if (!policyEnabled()) throw new Error("Policy review disabled.");
    const folder = await vscode.window.showWorkspaceFolderPick();
    if (!folder) return;
    const root = folder.uri.toString();
    const rules = storedRules(root);
    const choices = [
        ...rules.paths.filter(rule => rule.sensitive !== true).map(rule => ({ label: `${rule.kind}: ${rule.pattern}`, value: JSON.stringify(rule), region: false })),
        ...rules.regions.map(rule => ({ label: `Protected text: ${rule.path} (${rule.start}-${rule.end})`, value: JSON.stringify(rule), region: true })),
    ];
    const choice = await vscode.window.showQuickPick(choices, { title: "Review an accepted deny", placeHolder: "Remove the repository entry first; retained denies need this separate review." });
    if (!choice) return;
    const approval = await vscode.window.showWarningMessage(
        `Relax ${choice.label} in ${folder.name}?\nnot agent-proof: an agent running as me could also change this`,
        { modal: true }, "Relax this deny");
    if (approval !== "Relax this deny" || !policyEnabled()) return;
    await writeRules(root, current => {
        if (choice.region) current.regions = current.regions.filter(rule => JSON.stringify(rule) !== choice.value);
        else current.paths = current.paths.filter(rule => rule.sensitive === true || JSON.stringify(rule) !== choice.value);
        return current;
    });
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

    /** Exact-root validity for UI configuration reporting; this does not establish an OS boundary. */
    availableForRoot(uri: vscode.Uri): boolean {
        return uri.scheme === "file" && this.roots.some(root => root.folder.uri.toString() === uri.toString() && !root.invalid);
    }

    static async load(): Promise<BoundarySnapshot> {
        const roots = await Promise.all((vscode.workspace.workspaceFolders ?? []).map(async folder => {
            const root: RootPolicy = {
                folder, globs: [...DEFAULT_PROJECT_POLICY.protectedFiles, ".git/", ".aiignore", ".soterai/", ".soterai-policy.json"],
                manual: { paths: [], regions: [] }, invalid: folder.uri.scheme !== "file" || !policyEnabled(),
                project: structuredClone(DEFAULT_PROJECT_POLICY),
            };
            try {
                root.manual = storedRules(folder.uri.toString());
                // Retain the legacy record, but commit its stronger treatment before any managed release.
                const persisted = parseManualRules(state?.get<Record<string, unknown>>(RULES_KEY, {})?.[folder.uri.toString()]);
                if (JSON.stringify(persisted) !== JSON.stringify(root.manual)) {
                    await updateRules(folder.uri.toString(), rules => rules);
                    root.manual = storedRules(folder.uri.toString());
                }
                const ignore = await optionalPolicyFile(folder, ".aiignore");
                const acceptedGlobs = ignore === undefined ? [] : parseAiIgnore(ignore);
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
                    acceptedGlobs.push(...root.project.protectedFiles.map(validateGlob));
                    if (root.project.aiContext.sensitivePathAction === "block") acceptedGlobs.push(...root.project.sensitivePaths.map(validateGlob));
                    if (root.project.aiContext.defaultAction === "block") acceptedGlobs.push("**");
                }
                if (acceptedGlobs.length && policyEnabled()) {
                    await updateRules(folder.uri.toString(), rules => ({ ...rules,
                        paths: [...rules.paths, ...acceptedGlobs.map(pattern => ({ kind: "glob" as const, pattern }))],
                    }));
                    root.manual = storedRules(folder.uri.toString());
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
        if (isSensitiveFilePath(entry.rel)) return true;
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

    /** Sensitivity and deny share the same immutable policy and access revision. */
    isSensitive(uri: vscode.Uri): boolean {
        const entry = this.locate(uri);
        return !entry || entry.root.invalid || isSensitiveFilePath(entry.rel)
            || entry.root.manual.paths.some(rule => rule.sensitive === true && matchesRule(entry.rel, rule))
            || [...entry.root.project.protectedFiles, ...entry.root.project.sensitivePaths]
                .some(pattern => matchesGlob(entry.rel, validateGlob(pattern)));
    }

    hasRegions(uri: vscode.Uri): boolean {
        const entry = this.locate(uri);
        return !!entry && entry.root.manual.regions.some(r => relativePath(r.path) === entry.rel);
    }

    /** Approval cannot override an invalid/disabled policy. Used by the explicit safe reader only. */
    accessRevision(uri: vscode.Uri): string | undefined {
        const entry = this.locate(uri);
        if (!entry || entry.root.invalid) return undefined;
        return documentDigest(JSON.stringify([entry.root.folder.uri.toString(), entry.root.globs,
            entry.root.manual, entry.root.project, legacyProtected?.(vscode.workspace.asRelativePath(uri)) === true]));
    }

    /** A one-time approved view still enforces protected regions; existing default reads remain denied. */
    approvedRegionView(uri: vscode.Uri, text: string): string {
        const entry = this.locate(uri);
        if (!entry || entry.root.invalid) return OMITTED;
        return redactRegions(entry.rel, text, entry.root.manual.regions);
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
