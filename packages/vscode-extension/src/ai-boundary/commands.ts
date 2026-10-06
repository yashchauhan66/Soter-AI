import * as vscode from "vscode";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { redactAIContext as redactForSharing } from "@soterai/guard-core";
import { assertWorkspaceFileUri } from "../security/WorkspacePathGuard";
import { BoundarySnapshot, initializeBoundaryState, storedRules, updateRules } from "./BoundarySnapshot";
import { documentDigest, relativePath, validateGlob, OMITTED } from "./policy";

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
            return redactForSharing(boundary.sanitize(source, text));
        } catch { return OMITTED; }
    }

    refresh(): void { for (const key of this.documents.keys()) this.changed.fire(vscode.Uri.parse(key)); }
    dispose(): void { this.documents.clear(); this.changed.dispose(); }
}

export function registerAIBoundaryCommands(context: vscode.ExtensionContext): void {
    initializeBoundaryState(context.workspaceState);
    const provider = new RedactedDocumentProvider();
    context.subscriptions.push(provider, vscode.workspace.registerTextDocumentContentProvider("soterai-redacted", provider));
    const watcher = vscode.workspace.createFileSystemWatcher("**/{.aiignore,policy.json}");
    context.subscriptions.push(watcher, watcher.onDidChange(() => provider.refresh()), watcher.onDidCreate(() => provider.refresh()),
        watcher.onDidDelete(() => provider.refresh()), vscode.workspace.onDidChangeTextDocument(() => provider.refresh()),
        vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh()));

    const reg = (id: string, action: (uri?: vscode.Uri) => Promise<void>) => {
        context.subscriptions.push(vscode.commands.registerCommand(id, async (uri?: vscode.Uri) => {
            try { await action(uri); }
            catch { void vscode.window.showErrorMessage("SoterAI could not apply the AI rule. Check the workspace path, policy syntax and storage availability."); }
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
        await assertWorkspaceFileUri(item.uri);
        const stat = await vscode.workspace.fs.stat(item.uri);
        const kind = stat.type === vscode.FileType.Directory ? "folder" as const : "file" as const;
        await updateRules(item.root, rules => {
            if (!rules.paths.some(rule => rule.kind === kind && rule.pattern === item.rel)) rules.paths.push({ kind, pattern: item.rel });
            return rules;
        });
        updated();
    });
    reg("soterai.blockGlobFromAI", async uri => {
        const item = uri || vscode.window.activeTextEditor ? target(uri) : undefined;
        const folder = item?.folder ?? (await vscode.window.showWorkspaceFolderPick());
        if (!folder) return;
        const pattern = await vscode.window.showInputBox({ title: "Block a pattern from SoterAI context", prompt: "Deny glob, e.g. reports/** or *.pem. .aiignore supports the same syntax.", validateInput: value => {
            try { validateGlob(value); return undefined; } catch { return "Use *, ** or ?. Negation and regex are unsupported."; }
        } });
        if (!pattern) return;
        const root = folder.uri.toString();
        const validated = validateGlob(pattern);
        await updateRules(root, rules => {
            if (!rules.paths.some(rule => rule.kind === "glob" && rule.pattern === validated)) rules.paths.push({ kind: "glob", pattern: validated });
            return rules;
        });
        updated();
    });
    reg("soterai.blockSelectionFromAI", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) return;
        const item = target(editor.document.uri);
        await assertWorkspaceFileUri(item.uri);
        const text = editor.document.getText();
        if (Buffer.byteLength(text, "utf8") > 64 * 1024) throw new Error("File too large; block the file instead.");
        const region = {
            path: item.rel, digest: documentDigest(text),
            start: editor.document.offsetAt(editor.selection.start), end: editor.document.offsetAt(editor.selection.end),
        };
        await updateRules(item.root, rules => {
            // Re-marking after an edit replaces stale offsets; otherwise combine ranges.
            rules.regions = rules.regions.filter(r => relativePath(r.path) !== relativePath(item.rel) || r.digest === region.digest);
            rules.regions.push(region);
            return rules;
        });
        updated();
    });
    reg("soterai.manageAIRules", async () => {
        const folder = await vscode.window.showWorkspaceFolderPick();
        if (!folder) return;
        const root = folder.uri.toString();
        const rules = storedRules(root);
        const choices = [
            ...rules.paths.map((rule, index) => ({ label: `${rule.kind}: ${rule.pattern}`, index, region: false })),
            ...rules.regions.map((rule, index) => ({ label: `Protected text: ${rule.path} (${rule.start}-${rule.end})`, index, region: true })),
        ];
        const choice = await vscode.window.showQuickPick(choices, { title: "Remove a manual AI rule", placeHolder: ".aiignore and default rules are managed separately." });
        if (!choice) return;
        const approval = await vscode.window.showWarningMessage("Remove this rule from SoterAI context protection?", { modal: true }, "Remove rule");
        if (approval !== "Remove rule") return;
        const removed = JSON.stringify(choice.region ? rules.regions[choice.index] : rules.paths[choice.index]);
        await updateRules(root, current => {
            if (choice.region) current.regions = current.regions.filter(rule => JSON.stringify(rule) !== removed);
            else current.paths = current.paths.filter(rule => JSON.stringify(rule) !== removed);
            return current;
        });
        provider.refresh();
    });
    reg("soterai.openRedactedPreview", async uri => {
        const item = target(uri);
        const document = await vscode.workspace.openTextDocument(provider.createUri(item.uri));
        await vscode.window.showTextDocument(document, { preview: true });
    });
}
