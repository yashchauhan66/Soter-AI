import * as vscode from "vscode";
import * as path from "node:path";
import { open, constants } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { BoundarySnapshot, exportRootPolicy, updateVersionedPolicy, versionedPolicyEnabled } from "./BoundarySnapshot";
import { defaultVersionedPolicy, exportVersionedPolicy, mergeVersionedPolicies, parseVersionedPolicyText, STACK_PRESETS, MAX_POLICY_BYTES, type VersionedPolicy } from "./VersionedPolicy";
import { documentDigest } from "./policy";
import { readBoundaryFile } from "./readFile";
import { assertRestrictionWorkspace } from "./RestrictionOperation";
import { assertWorkspaceOutputUri } from "../security/WorkspacePathGuard";

type PolicyResult = { status: "SAVED" | "EXPORTED" | "CANCELLED" | "FAILED" | "UNAVAILABLE" };
const enabled = () => vscode.workspace.isTrusted && versionedPolicyEnabled()
    && vscode.workspace.getConfiguration("soterai").get("hardening.addOnlyPolicy", true);
class PolicyPreview implements vscode.TextDocumentContentProvider, vscode.Disposable {
    private readonly values = new Map<string, string>();
    pair(before: VersionedPolicy, after: VersionedPolicy): [vscode.Uri, vscode.Uri] {
        this.values.clear();
        const id = randomUUID();
        const a = vscode.Uri.parse(`soterai-policy-preview:/${id}/before.json`), b = vscode.Uri.parse(`soterai-policy-preview:/${id}/after.json`);
        this.values.set(a.toString(), exportVersionedPolicy(before)); this.values.set(b.toString(), exportVersionedPolicy(after));
        return [a, b];
    }
    provideTextDocumentContent(uri: vscode.Uri): string { return this.values.get(uri.toString()) ?? "Policy preview expired."; }
    dispose(): void { this.values.clear(); }
}
/** Fresh UI choices only. Arguments never select policy, approve it or choose its destination. */
export function registerVersionedPolicyCommands(context: vscode.ExtensionContext): void {
    const preview = new PolicyPreview();
    context.subscriptions.push(preview, vscode.workspace.registerTextDocumentContentProvider("soterai-policy-preview", preview));
    const reg = (id: string, action: () => Promise<PolicyResult>) => context.subscriptions.push(vscode.commands.registerCommand(id, async () => {
        if (!enabled()) return { status: "UNAVAILABLE" };
        try { return await action(); }
        catch {
            if (!enabled()) return { status: "UNAVAILABLE" };
            void vscode.window.showErrorMessage("SoterAI could not complete policy setup. Check the selected project, policy format, limits and storage. Existing protection stays in place.");
            return { status: "FAILED" };
        }
    }));
    async function choose(): Promise<vscode.WorkspaceFolder | undefined> {
        const folder = await vscode.window.showWorkspaceFolderPick();
        if (!folder) return;
        const root = folder.uri.toString(); assertRestrictionWorkspace(root);
        if (!enabled()) throw new Error("Policy setup unavailable.");
        if (!(await BoundarySnapshot.load()).availableForRoot(folder.uri)) throw new Error("Current policy unavailable.");
        assertRestrictionWorkspace(root);
        return folder;
    }
    async function review(root: string, added: VersionedPolicy): Promise<boolean> {
        const before = exportRootPolicy(root), after = mergeVersionedPolicies(before, added);
        const [left, right] = preview.pair(before, after);
        await vscode.commands.executeCommand("vscode.diff", left, right, "SoterAI: review added protection");
        assertRestrictionWorkspace(root);
        const accepted = await vscode.window.showWarningMessage(
            `Add this policy protection? Review the metadata diff. ${after.rules.paths.length} path rule(s), ${after.rules.regions.length} protected region(s), ${after.sensitiveGlobs.length} sensitive pattern(s). Existing denies cannot be removed by import. Sensitive contents stay masked even after read approval. Tested older schema-aware readers reject this storage format and make managed reads unavailable. This editor confirmation is not agent-proof.`,
            { modal: true }, "Add protection");
        if (!enabled()) throw new Error("Policy setup unavailable.");
        assertRestrictionWorkspace(root);
        if (documentDigest(exportVersionedPolicy(exportRootPolicy(root))) !== documentDigest(exportVersionedPolicy(before))) throw new Error("Reviewed protection changed.");
        return accepted === "Add protection";
    }
    reg("soterai.importLitePolicy", async () => {
        const folder = await choose(); if (!folder) return { status: "CANCELLED" };
        const root = folder.uri.toString();
        const files = await vscode.window.showOpenDialog({ title: "Import an additive SoterAI policy", defaultUri: folder.uri,
            canSelectFiles: true, canSelectFolders: false, canSelectMany: false, filters: { "Policy JSON": ["json"] }, openLabel: "Review policy" });
        const file = files?.[0]; if (!file) return { status: "CANCELLED" };
        assertRestrictionWorkspace(root, file);
        if (file.scheme !== "file" || path.extname(file.fsPath).toLowerCase() !== ".json") throw new Error("Project JSON policy required.");
        const text = await readBoundaryFile(folder.uri.fsPath, file.fsPath, MAX_POLICY_BYTES);
        const added = parseVersionedPolicyText(text);
        if (!await review(root, added)) return { status: "CANCELLED" };
        if (documentDigest(await readBoundaryFile(folder.uri.fsPath, file.fsPath, MAX_POLICY_BYTES)) !== documentDigest(text)) throw new Error("Reviewed import changed.");
        await updateVersionedPolicy(root, added);
        assertRestrictionWorkspace(root, file);
        void vscode.window.showInformationMessage("SoterAI policy protection saved. Imported rules add protection; existing denies remain.");
        return { status: "SAVED" };
    });
    reg("soterai.applyLitePolicyPreset", async () => {
        const folder = await choose(); if (!folder) return { status: "CANCELLED" };
        const root = folder.uri.toString();
        const selected = await vscode.window.showQuickPick(STACK_PRESETS.map(preset => ({ label: preset.label, description: `${preset.patterns.length} additional sensitive patterns`, id: preset.id })),
            { title: "Add a stack protection preset", placeHolder: "Configuration files may contain credentials; this keeps their contents masked." });
        if (!selected) return { status: "CANCELLED" };
        assertRestrictionWorkspace(root);
        const added = defaultVersionedPolicy([selected.id]);
        if (!await review(root, added)) return { status: "CANCELLED" };
        await updateVersionedPolicy(root, added); assertRestrictionWorkspace(root);
        void vscode.window.showInformationMessage("SoterAI stack protection saved. Earlier presets and denies remain accepted.");
        return { status: "SAVED" };
    });
    reg("soterai.exportLitePolicy", async () => {
        const folder = await choose(); if (!folder) return { status: "CANCELLED" };
        const root = folder.uri.toString();
        const file = await vscode.window.showSaveDialog({ title: "Export SoterAI policy metadata", defaultUri: vscode.Uri.joinPath(folder.uri, "soterai-policy.export.json"),
            filters: { "Policy JSON": ["json"] }, saveLabel: "Export metadata" });
        if (!file) return { status: "CANCELLED" };
        if (!enabled()) throw new Error("Policy setup unavailable.");
        assertRestrictionWorkspace(root, file);
        if (path.extname(file.fsPath).toLowerCase() !== ".json") throw new Error("JSON destination required.");
        const output = await assertWorkspaceOutputUri(file);
        const text = exportVersionedPolicy(exportRootPolicy(root));
        const handle = await open(output, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
        try { await handle.writeFile(text, "utf8"); await handle.sync(); }
        finally { await handle.close(); }
        assertRestrictionWorkspace(root, file);
        void vscode.window.showInformationMessage("SoterAI policy metadata exported: rule paths, patterns, digests and offsets. Source-file contents were not read or exported. Review metadata before sharing. Existing files are never overwritten.");
        return { status: "EXPORTED" };
    });
}
