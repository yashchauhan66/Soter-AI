import * as vscode from "vscode";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { redactAIContext as redactForSharing } from "@soterai/guard-core";
import { assertWorkspaceFileUri } from "../security/WorkspacePathGuard";
import { BoundarySnapshot, initializeBoundaryState, onDidChangeBoundaryRules, storedRules, updateRules, reviewRuleRelaxation } from "./BoundarySnapshot";
import { documentDigest, relativePath, validateGlob, OMITTED } from "./policy";
import { restrictionSaveEnabled, requireRestrictionSave, assertRestrictionWorkspace, RestrictionUnavailable, withManualRestriction, type RestrictionResult } from "./RestrictionOperation";
import { registerVersionedPolicyCommands } from "./VersionedPolicyCommands";

/** A read-only alternative URI, never an interceptor for file: or other extensions. */
export class RedactedDocumentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
    private readonly documents = new Map<string, vscode.Uri>();
    private readonly changed = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this.changed.event;

    createUri(source: vscode.Uri): vscode.Uri {
        if (this.documents.size >= 16) {
            const oldest = this.documents.keys().next().value!;
            this.documents.delete(oldest);
            this.changed.fire(vscode.Uri.parse(oldest));
        }
        const uri = vscode.Uri.parse(`soterai-redacted:/${randomUUID()}/preview.txt`);
        this.documents.set(uri.toString(), source);
        return uri;
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const source = this.documents.get(uri.toString());
        if (!source) return OMITTED;
        try {
            const boundary = await BoundarySnapshot.load();
            if (boundary.blocks(source)) return OMITTED;
            // Validate even when the editor has unsaved content.
            await assertWorkspaceFileUri(source);
            const disk = await boundary.read(source);
            const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === source.toString());
            const text = doc ? doc.getText() : disk;
            if (Buffer.byteLength(text, "utf8") > 64 * 1024) return OMITTED;
            return redactForSharing(doc ? boundary.sanitize(source, text) : disk);
        } catch { return OMITTED; }
    }

    refresh(): void { for (const key of this.documents.keys()) this.changed.fire(vscode.Uri.parse(key)); }
    dispose(): void { this.documents.clear(); this.changed.dispose(); }
}

export function registerAIBoundaryCommands(context: vscode.ExtensionContext): void {
    initializeBoundaryState(context.workspaceState);
    registerVersionedPolicyCommands(context);
    const provider = new RedactedDocumentProvider();
    context.subscriptions.push(provider, vscode.workspace.registerTextDocumentContentProvider("soterai-redacted", provider));
    context.subscriptions.push(onDidChangeBoundaryRules(() => provider.refresh()));
    const watcher = vscode.workspace.createFileSystemWatcher("**/{.aiignore,policy.json}");
    context.subscriptions.push(watcher, watcher.onDidChange(() => provider.refresh()), watcher.onDidCreate(() => provider.refresh()),
        watcher.onDidDelete(() => provider.refresh()), vscode.workspace.onDidChangeTextDocument(() => provider.refresh()),
        vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()));

    const reg = (id: string, action: (uri?: vscode.Uri) => Promise<void | RestrictionResult>, restriction = false) => {
        context.subscriptions.push(vscode.commands.registerCommand(id, async (uri?: vscode.Uri) => {
            if (restriction && !restrictionSaveEnabled()) return { status: "UNAVAILABLE" };
            try { return await action(uri); }
            catch (error) {
                if (error instanceof RestrictionUnavailable) return { status: "UNAVAILABLE" };
                void vscode.window.showErrorMessage("SoterAI could not apply the AI rule. Check the workspace path, policy syntax and storage availability.");
                return { status: "FAILED" };
            }
        }));
    };
    const target = (uri?: vscode.Uri) => {
        const selected = uri ?? vscode.window.activeTextEditor?.document.uri;
        const folder = selected && vscode.workspace.getWorkspaceFolder(selected);
        if (!selected || !folder || selected.scheme !== "file") throw new Error("Open a local workspace file.");
        return { uri: selected, folder, root: folder.uri.toString(), rel: path.relative(folder.uri.fsPath, selected.fsPath).replace(/\\/g, "/") || "." };
    };
    const updated = () => {
        provider.refresh();
        void vscode.window.showInformationMessage("AI rule saved for SoterAI context and redacted previews. Other extensions can still read the original file.");
    };

    reg("soterai.blockFromAI", async uri => {
        const item = target(uri);
        return withManualRestriction(item.root, async () => {
            await assertWorkspaceFileUri(item.uri);
            const stat = await vscode.workspace.fs.stat(item.uri);
            const kind = stat.type === vscode.FileType.Directory ? "folder" as const : "file" as const;
            await updateRules(item.root, rules => {
                requireRestrictionSave();
                assertRestrictionWorkspace(item.root, item.uri);
                if (!rules.paths.some(rule => rule.kind === kind && rule.pattern === item.rel)) rules.paths.push({ kind, pattern: item.rel });
                return rules;
            });
            assertRestrictionWorkspace(item.root, item.uri);
            updated();
            return { status: "SAVED" as const };
        }, { kind: "folder", pattern: item.rel });
    }, true);
    reg("soterai.blockGlobFromAI", async uri => {
        const item = uri || vscode.window.activeTextEditor ? target(uri) : undefined;
        const folder = item?.folder ?? (await vscode.window.showWorkspaceFolderPick());
        if (!folder) return { status: "CANCELLED" };
        const pattern = await vscode.window.showInputBox({ title: "Block a pattern from SoterAI context", prompt: "Deny glob, e.g. reports/** or *.pem. .aiignore supports the same syntax.", validateInput: value => {
            try { validateGlob(value); return undefined; } catch { return "Use *, ** or ?. Negation and regex are unsupported."; }
        } });
        if (!pattern) return { status: "CANCELLED" };
        const root = folder.uri.toString();
        const validated = validateGlob(pattern);
        return withManualRestriction(root, async () => {
            await updateRules(root, rules => {
                requireRestrictionSave();
                assertRestrictionWorkspace(root, folder.uri);
                if (!rules.paths.some(rule => rule.kind === "glob" && rule.pattern === validated)) rules.paths.push({ kind: "glob", pattern: validated });
                return rules;
            });
            assertRestrictionWorkspace(root, folder.uri);
            updated();
            return { status: "SAVED" as const };
        }, { kind: "glob", pattern: validated });
    }, true);
    reg("soterai.blockSelectionFromAI", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) return { status: "CANCELLED" };
        const item = target(editor.document.uri);
        return withManualRestriction(item.root, async () => {
        await assertWorkspaceFileUri(item.uri);
        const text = editor.document.getText();
        if (Buffer.byteLength(text, "utf8") > 64 * 1024) throw new Error("File too large; block the file instead.");
        const region = {
            path: item.rel, digest: documentDigest(text),
            start: editor.document.offsetAt(editor.selection.start), end: editor.document.offsetAt(editor.selection.end),
        };
        let hasStaleRegions = false;
        await updateRules(item.root, rules => {
            requireRestrictionSave();
            assertRestrictionWorkspace(item.root, item.uri);
            // Marking new text must never silently remove earlier protection.
            // Stale rules keep the whole file withheld until explicitly reviewed.
            hasStaleRegions = rules.regions.some(r => relativePath(r.path) === relativePath(item.rel) && r.digest !== region.digest);
            rules.regions.push(region);
            return rules;
        });
        assertRestrictionWorkspace(item.root, item.uri);
        if (hasStaleRegions) {
            provider.refresh();
            void vscode.window.showWarningMessage("Earlier protected text changed. SoterAI will withhold this whole file until you review its rules in Manage Manual AI Rules.");
        } else updated();
        return { status: "SAVED" as const };
        }, { kind: "file", pattern: item.rel });
    }, true);
    reg("soterai.manageAIRules", async () => {
        await reviewRuleRelaxation();
        provider.refresh();
    });
    reg("soterai.openRedactedPreview", async uri => {
        const item = target(uri);
        const document = await vscode.workspace.openTextDocument(provider.createUri(item.uri));
        await vscode.window.showTextDocument(document, { preview: true });
    });
}
