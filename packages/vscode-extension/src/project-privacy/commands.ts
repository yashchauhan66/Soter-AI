import * as vscode from "vscode";
import * as path from "node:path";
import { lstat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { BoundarySnapshot, updateRules, onDidChangeBoundaryRules } from "../ai-boundary/BoundarySnapshot";
import { readBoundaryFile } from "../ai-boundary/readFile";
import { relativePath, OMITTED } from "../ai-boundary/policy";
import { assertWorkspaceFileUri } from "../security/WorkspacePathGuard";
import { ProjectFileAccess, type CapturedFile, type AccessReceipt, type AccessResult, type RequestSurface } from "./ProjectFileAccess";
import { ProjectReadTerminal } from "./ReadTerminal";
import { openProjectPrivacyPanel } from "./panel";
import { restrictionSaveEnabled, requireRestrictionSave, assertRestrictionWorkspace, RestrictionUnavailable, restrictionResult,
    withManualRestriction, manualRestrictionPending, onDidChangeManualRestriction } from "../ai-boundary/RestrictionOperation";

const NEVER_RELEASE = /(?:^|\/)(?:\.git|\.soterai)(?:\/|$)|(?:^|\/)(?:\.aiignore|\.soterai-policy\.json)$/i;

class ApprovedViewProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
    private readonly views = new Map<string, string>();
    private readonly changed = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this.changed.event;
    constructor(private readonly enabled: () => boolean) {}
    create(text: string): vscode.Uri {
        if (this.views.size >= 16) {
            const oldest = this.views.keys().next().value!;
            this.views.delete(oldest); this.changed.fire(vscode.Uri.parse(oldest));
        }
        const uri = vscode.Uri.parse(`soterai-approved:/${randomUUID()}/safe-view.txt`);
        this.views.set(uri.toString(), text);
        return uri;
    }
    provideTextDocumentContent(uri: vscode.Uri): string { return this.enabled() ? this.views.get(uri.toString()) ?? OMITTED : OMITTED; }
    clear(): void {
        const keys = [...this.views.keys()]; this.views.clear();
        for (const key of keys) this.changed.fire(vscode.Uri.parse(key));
    }
    dispose(): void { this.views.clear(); this.changed.dispose(); }
}

export function approvalMessage(receipt: AccessReceipt): string {
    const treatment = receipt.kind === "environment-schema"
        ? `Only ${receipt.fieldCount} variable name(s) with [MASKED] values will be released. Comments and original values stay withheld.`
        : receipt.kind === "sensitive-summary" ? "Only a masked summary will be released. Sensitive file contents stay withheld."
        : "One saved-file view will be released with recognized secrets and protected regions removed. Unrecognized private text can remain.";
    return `Allow one safe read of ${JSON.stringify(receipt.relativePath)} in ${JSON.stringify(receipt.workspace)}?\n\n`
        + treatment + `\n\nRoute: ${receipt.surface}. Review expires after 60 seconds and is bound to this saved file and policy revision. `
        + "The persistent restriction remains. This editor confirmation is not agent-proof; requester identity is not OS-verified. Other tools' direct reads are outside this reader.";
}

export function registerProjectPrivacyCommands(context: vscode.ExtensionContext): void {
    const pendingSensitiveWrites = new Map<string, number>();
    const fileKey = (uri: vscode.Uri) => path.resolve(uri.fsPath).toLowerCase();
    const enabled = () => vscode.workspace.isTrusted
        && vscode.workspace.getConfiguration("soterai").get<boolean>("projectPrivacy.enabled", true)
        && vscode.workspace.getConfiguration("soterai").get<boolean>("projectPrivacy.atomicSensitivePolicy", true)
        && vscode.workspace.getConfiguration("soterai").get<boolean>("projectPrivacy.safeViewComposition", true)
        && vscode.workspace.getConfiguration("soterai").get<boolean>("hardening.addOnlyPolicy", true);
    const provider = new ApprovedViewProvider(enabled);
    const access = new ProjectFileAccess<vscode.Uri>({ enabled, now: () => performance.now(), capture, confirm: async receipt =>
        await vscode.window.showWarningMessage(approvalMessage(receipt), { modal: true }, "Allow safe read once") === "Allow safe read once" });
    context.subscriptions.push(provider, access, vscode.workspace.registerTextDocumentContentProvider("soterai-approved", provider),
        onDidChangeBoundaryRules(() => { access.revoke(); provider.clear(); }),
        onDidChangeManualRestriction(() => { access.revoke(); provider.clear(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => { access.revoke(); provider.clear(); }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration("soterai")) { access.revoke(); provider.clear(); }
        }));

    async function capture(uri: vscode.Uri): Promise<CapturedFile> {
        if (!(uri instanceof vscode.Uri) || uri.scheme !== "file") throw new Error("Local file required.");
        if (pendingSensitiveWrites.has(fileKey(uri))) throw new Error("Sensitive policy update pending.");
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (!folder || folder.uri.scheme !== "file") throw new Error("Project file required.");
        const root = folder.uri.toString();
        if (manualRestrictionPending(root, uri)) throw new Error("Manual restriction update pending.");
        const rel = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, "/");
        if (NEVER_RELEASE.test(relativePath(rel))) throw new Error("Policy/history files cannot be released through this reader.");
        const canonical = await assertWorkspaceFileUri(uri);
        if (path.resolve(canonical).toLowerCase() !== fileKey(uri)) throw new Error("File aliases are unsupported.");
        const boundary = await BoundarySnapshot.load();
        const policyRevision = boundary.accessRevision(uri);
        if (!policyRevision) throw new Error("Policy unavailable.");
        const content = await readBoundaryFile(folder.uri.fsPath, uri.fsPath);
        if (path.resolve(await assertWorkspaceFileUri(uri)).toLowerCase() !== fileKey(uri)) throw new Error("File identity changed.");
        const stat = await lstat(uri.fsPath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe file.");
        if (pendingSensitiveWrites.has(fileKey(uri))) throw new Error("Sensitive policy update pending.");
        if (manualRestrictionPending(root, uri)) throw new Error("Manual restriction update pending.");
        if ((await BoundarySnapshot.load()).accessRevision(uri) !== policyRevision) throw new Error("Policy changed during capture.");
        return { workspace: folder.uri.toString(), relativePath: rel, policyRevision,
            fileIdentity: JSON.stringify([stat.dev, stat.ino, stat.birthtimeMs, stat.size, stat.mtimeMs]),
            content, regionView: boundary.approvedRegionView(uri, content),
            sensitive: boundary.isSensitive(uri) || boundary.classify(uri).level !== "normal" };
    }

    async function chooseFile(): Promise<vscode.Uri | undefined> {
        if (!enabled()) { void vscode.window.showWarningMessage("Project safe reads are unavailable. Check project privacy settings and workspace trust."); return; }
        const picked = await vscode.window.showOpenDialog({ title: "Choose a project file for a safe view", canSelectFiles: true,
            canSelectFolders: false, canSelectMany: false, defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
            openLabel: "Review safe access" });
        return picked?.[0];
    }
    async function request(uri: vscode.Uri | undefined, surface: RequestSurface): Promise<AccessResult> {
        if (!uri) return { status: "DENIED" };
        // Complete accepted-policy migration before starting this request's revocation epoch.
        try { await BoundarySnapshot.load(); } catch { return { status: "UNAVAILABLE" }; }
        return access.request(uri, surface);
    }
    const reg = (id: string, handler: (...args: unknown[]) => unknown) => {
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    };
    reg("soterai.openProjectPrivacy", () => { openProjectPrivacyPanel(context); return { status: "OPENED" }; });
    reg("soterai.restrictProjectFile", async (argument?: unknown) => {
        if (!enabled() || !restrictionSaveEnabled()) return { status: "UNAVAILABLE" };
        const uri = argument instanceof vscode.Uri ? argument : await chooseFile();
        if (!uri) return { status: enabled() ? "CANCELLED" : "UNAVAILABLE" };
        access.revoke(); provider.clear();
        try { return restrictionResult(await vscode.commands.executeCommand("soterai.blockFromAI", uri)); }
        catch { return { status: "FAILED" }; }
        finally { access.revoke(); provider.clear(); }
    });
    reg("soterai.reviewSafeFileAccess", async (argument?: unknown) => {
        const uri = argument instanceof vscode.Uri ? argument : await chooseFile();
        const result = await request(uri, "safe-preview");
        if (result.status !== "ALLOWED_ONCE") { void vscode.window.showInformationMessage(`Safe read withheld: ${result.status}.`); return result; }
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(provider.create(result.text)), { preview: true });
        return result;
    });
    // Adapter entrypoint for integrations: no approval/raw/expiry argument is accepted.
    reg("soterai.readProjectFileSafely", (argument?: unknown) => request(argument instanceof vscode.Uri ? argument : undefined, "integration-command"));
    let markWrites = Promise.resolve();
    reg("soterai.restrictSensitiveFile", async (argument?: unknown) => {
        if (!enabled() || !restrictionSaveEnabled()) { void vscode.window.showWarningMessage("Sensitive restriction setup is unavailable. Check project privacy settings and workspace trust."); return { status: "UNAVAILABLE" }; }
        const uri = argument instanceof vscode.Uri ? argument : await chooseFile();
        if (!uri) return { status: "CANCELLED" };
        // A failed save must not leave an earlier review or virtual preview active.
        const key = fileKey(uri);
        pendingSensitiveWrites.set(key, (pendingSensitiveWrites.get(key) ?? 0) + 1);
        access.revoke(); provider.clear();
        const chosenFolder = vscode.workspace.getWorkspaceFolder(uri);
        const root = chosenFolder?.uri.toString();
        const write = root ? withManualRestriction(root, () => markWrites.then(async () => {
            requireRestrictionSave();
            assertRestrictionWorkspace(root, uri);
            if (!enabled()) throw new RestrictionUnavailable();
            if (path.resolve(await assertWorkspaceFileUri(uri)).toLowerCase() !== fileKey(uri)) throw new Error("File aliases are unsupported.");
            const folder = chosenFolder!;
            const rel = relativePath(path.relative(folder.uri.fsPath, uri.fsPath));
            const stat = await lstat(uri.fsPath);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Regular file required.");
            await updateRules(folder.uri.toString(), () => {
                requireRestrictionSave();
                assertRestrictionWorkspace(root, uri);
                if (!enabled()) throw new RestrictionUnavailable();
                return { paths: [{ kind: "file", pattern: rel, sensitive: true }], regions: [] };
            });
            assertRestrictionWorkspace(root, uri);
            access.revoke(); provider.clear();
            void vscode.window.showInformationMessage("Sensitive restriction saved for managed readers. Approved safe views stay masked. Other tools can still read originals.");
        }), { kind: "file", pattern: path.relative(chosenFolder!.uri.fsPath, uri.fsPath).replace(/\\/g, "/") }) : Promise.reject(new Error("Project file required."));
        markWrites = write.catch(() => undefined);
        try { await write; return { status: "SAVED" }; }
        catch (error) {
            if (error instanceof RestrictionUnavailable) return { status: "UNAVAILABLE" };
            void vscode.window.showErrorMessage("Sensitive restriction could not be saved. Review workspace policy and storage availability."); return { status: "FAILED" };
        }
        finally {
            const remaining = (pendingSensitiveWrites.get(key) ?? 1) - 1;
            if (remaining) pendingSensitiveWrites.set(key, remaining);
            else pendingSensitiveWrites.delete(key);
            access.revoke(); provider.clear();
        }
    });
    reg("soterai.revokeProjectReads", () => {
        access.revoke(); provider.clear();
        void vscode.window.showInformationMessage("Pending managed reads revoked and safe previews cleared. Previously released data cannot be recalled.");
        return { status: "REVOKED" };
    });
    reg("soterai.openProjectReadTerminal", async () => {
        if (!enabled()) { void vscode.window.showWarningMessage("Project read terminal unavailable. Check project privacy settings and workspace trust."); return { status: "UNAVAILABLE" }; }
        const folders = vscode.workspace.workspaceFolders;
        const folder = folders?.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
        if (!folder || folder.uri.scheme !== "file") return { status: "CANCELLED" };
        const pty = new ProjectReadTerminal(async rel => {
            try {
                relativePath(rel);
                return await request(vscode.Uri.joinPath(folder.uri, rel.replace(/\\/g, "/")), "managed-read-terminal");
            } catch { return { status: "UNAVAILABLE" }; }
        }, () => { access.revoke(); provider.clear(); });
        const terminal = vscode.window.createTerminal({ name: "SoterAI Project Reader", pty });
        context.subscriptions.push(terminal); terminal.show();
        return { status: "OPENED" };
    });
}
