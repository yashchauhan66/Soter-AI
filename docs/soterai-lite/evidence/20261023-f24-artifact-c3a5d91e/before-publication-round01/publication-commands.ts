import * as vscode from "vscode";
import * as path from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import { isSensitiveFilePath } from "@soterai/guard-core";
import { BoundarySnapshot } from "../../ai-boundary/BoundarySnapshot";
import { readBoundaryFile } from "../../ai-boundary/readFile";
import { assertWorkspaceFileUri } from "../../security/WorkspacePathGuard";
import { buildSafeFileView, isEnvironmentFile } from "../SafeFileView";
import { developmentContract, localDevelopmentFields, syntheticEnvironment, type SyntheticField, type SyntheticPreset } from "./DevelopmentContract";
import { canonicalDirectory, publicationRelativePath } from "./PublicationPaths";
import { PublicationSession, type PublicationCapture, type PublicationPlan } from "./PublicWorkspace";
import { artifactScannerEnabled } from "../../artifacts/ArtifactFlags";
import { artifactPublicationText } from "../../artifacts/ArtifactContent";
import { managedRootIdentity } from "../../terminal/ManagedOutputBinding";

export type PublicWorkspaceCommandResult = { readonly status: "PREPARED" | "PREVIEWED" | "CANCELLED" | "UNAVAILABLE" | "FAILED";
    readonly destination?: string; readonly manifestSha256?: string };

function exactCanonicalFile(canonical: string, selected: string): void {
    const spelling = (value: string) => process.platform === "win32"
        ? path.resolve(value).replace(/^[a-z]:/i, drive => drive.toUpperCase()) : path.resolve(value);
    if (spelling(canonical) !== spelling(selected)) throw new Error("Source filename is a filesystem alias.");
}

export function publicationReviewMessage(plan: PublicationPlan, destination: string): string {
    return `Publish ${plan.entries.length} explicitly reviewed output files to ${JSON.stringify(destination)}?\n\n`
        + plan.entries.map(file => `${file.path} (${file.bytes} bytes; ${file.treatment})`).join("\n")
        + `\n\nManifest SHA-256: ${plan.manifestSha256}\n`
        + "NO ISOLATION: this is a separate saved-file snapshot, not an OS or agent sandbox. Same-user Cline and other tools can still read originals. "
        + "Recognized-secret redaction can miss private text. Review selected public source content before publication. "
        + "Environment values are never copied; approved variable names receive synthetic examples only. "
        + "No database, app or network service is started. No source file is overwritten, no automatic synchronization occurs. "
        + "Review is bound to this manifest and current saved-file/policy identities and expires after five minutes. "
        + "This editor confirmation is not agent-proof. Cancellation before publication writes nothing. Revocation stops remaining writes; incomplete output is retained without a completion manifest. Released copies cannot be recalled.";
}

/** Native user-selection commands, deliberately without caller-supplied paths, approvals or secrets. */
export function registerPublicWorkspaceCommands(context: vscode.ExtensionContext): void {
    const enabled = () => artifactScannerEnabled() && vscode.workspace.isTrusted
        && vscode.workspace.getConfiguration("soterai").get<boolean>("projectPrivacy.enabled", true)
        && vscode.workspace.getConfiguration("soterai").get<boolean>("projectPrivacy.atomicSensitivePolicy", true)
        && vscode.workspace.getConfiguration("soterai").get<boolean>("projectPrivacy.safePublication", false)
        && vscode.workspace.getConfiguration("soterai").get<boolean>("hardening.addOnlyPolicy", true);
    const active = new Set<PublicationSession>();
    let pending = false, generation = 0;
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration("soterai")) { generation++; for (const session of active) session.revoke(); }
    }), vscode.workspace.onDidChangeWorkspaceFolders(() => {
        generation++; for (const session of active) session.revoke();
    }), new vscode.Disposable(() => { generation++; for (const session of active) session.revoke(); active.clear(); }));

    async function capture(folder: vscode.WorkspaceFolder, rel: string, valid: () => boolean): Promise<PublicationCapture> {
        if (!valid()) throw new Error("Safe publication disabled.");
        publicationRelativePath(rel);
        const uri = vscode.Uri.joinPath(folder.uri, ...rel.split("/"));
        await canonicalDirectory(folder.uri.fsPath);
        exactCanonicalFile(await assertWorkspaceFileUri(uri), uri.fsPath);
        const boundary = await BoundarySnapshot.load();
        const revision = boundary.accessRevision(uri);
        if (!revision) throw new Error("Publication policy unavailable.");
        const environment = isEnvironmentFile(rel);
        const classification = boundary.classify(uri);
        if (environment && boundary.hasRegions(uri)) throw new Error("Environment files with protected regions cannot publish a schema.");
        if (!environment && (boundary.blocks(uri) || boundary.isSensitive(uri) || isSensitiveFilePath(rel)
            || classification.level === "sensitive" || classification.level === "protected")) {
            throw new Error("A restricted or sensitive file was selected. It cannot be published.");
        }
        const text = await readBoundaryFile(folder.uri.fsPath, uri.fsPath);
        exactCanonicalFile(await assertWorkspaceFileUri(uri), uri.fsPath);
        const stat = await lstat(uri.fsPath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Regular unaliased source file required.");
        const approvedText = boundary.approvedRegionView(uri, text);
        const releaseText = environment ? approvedText : artifactPublicationText(rel, approvedText);
        const view = buildSafeFileView(rel, releaseText, false, text);
        if (!environment && view.kind !== "redacted-file") throw new Error("Unsupported source view.");
        if (environment && view.kind !== "environment-schema") throw new Error("Environment schema unavailable.");
        if ((await BoundarySnapshot.load()).accessRevision(uri) !== revision || !valid()) throw new Error("Policy changed during capture.");
        const environmentNames = environment ? view.text.split("\n").map(line => /^([A-Za-z_][A-Za-z0-9_]*)=\[MASKED\]$/.exec(line)?.[1])
            .filter((name): name is string => !!name) : undefined;
        return { relativePath: rel, revision, identity: JSON.stringify([stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.birthtimeMs,
            createHash("sha256").update(text).digest("hex")]),
            safeText: view.text, kind: environment ? "environment-schema" : "public-code", environmentNames };
    }

    async function run(publish: boolean): Promise<PublicWorkspaceCommandResult> {
        if (!enabled() || pending) {
            void vscode.window.showWarningMessage("Public snapshot preparation is unavailable. Enable the experimental safe-publication setting in a trusted workspace, or finish the pending review.");
            return { status: "UNAVAILABLE" };
        }
        pending = true;
        let session: PublicationSession | undefined;
        try {
            const folder = vscode.workspace.workspaceFolders?.length === 1 ? vscode.workspace.workspaceFolders[0]
                : await vscode.window.showWorkspaceFolderPick();
            if (!folder || folder.uri.scheme !== "file") return { status: "CANCELLED" };
            const epoch = generation, identity = managedRootIdentity(folder.uri);
            const valid = () => {
                try { return enabled() && epoch === generation && managedRootIdentity(folder.uri) === identity; }
                catch { return false; }
            };
            const picked = await vscode.window.showOpenDialog({ title: "Select saved files to review as public AI context",
                defaultUri: folder.uri, canSelectFiles: true, canSelectFolders: false, canSelectMany: true,
                openLabel: "Review selected files" });
            if (!valid()) return { status: "UNAVAILABLE" };
            if (!picked?.length) return { status: "CANCELLED" };
            const selected = picked.map(uri => {
                if (uri.scheme !== "file" || vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== folder.uri.toString()) {
                    throw new Error("All selected files must be in the chosen local project.");
                }
                return publicationRelativePath(path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, "/"));
            });
            const names = new Set<string>();
            for (const rel of selected.filter(isEnvironmentFile)) {
                const source = await capture(folder, rel, valid);
                source.environmentNames?.forEach(name => names.add(name));
            }
            let fields: SyntheticField[] = [];
            if (names.size) {
                const keys = await vscode.window.showQuickPick([...names].sort().map(label => ({ label })), {
                    title: "Approve variable names for the public development contract", canPickMany: true,
                    placeHolder: "Names may themselves be private. No values or comments will be released." });
                if (!keys) return { status: "CANCELLED" };
                const preset = await vscode.window.showQuickPick([
                    { label: "Synthetic text placeholders", preset: "text" as SyntheticPreset,
                        description: "All selected fields get SOTERAI_SYNTHETIC_VALUE; not a working service." },
                    { label: "Empty examples", preset: "empty" as SyntheticPreset,
                        description: "All selected fields are empty; no original value is included." },
                    { label: "Local development defaults", preset: "local-defaults" as const,
                        description: "Approved names get fixed synthetic PORT/loopback URL examples; no database, application or service is started." },
                ], { title: "Choose the synthetic example treatment" });
                if (!preset) return { status: "CANCELLED" };
                fields = preset.preset === "local-defaults" ? localDevelopmentFields(keys.map(key => key.label))
                    : keys.map(key => ({ name: key.label, preset: preset.preset as SyntheticPreset }));
            }
            session = new PublicationSession(folder.uri.fsPath, { enabled: valid, now: () => performance.now(), capture: rel => capture(folder, rel, valid) });
            active.add(session);
            const plan = await session.prepare(selected, fields);
            const preview = "SoterAI public snapshot review — NO ISOLATION\n\n"
                + JSON.stringify(plan, null, 2) + "\n\nSynthetic .env.example:\n"
                + syntheticEnvironment(developmentContract(fields));
            if (!valid()) return { status: "UNAVAILABLE" };
            const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: preview });
            if (!valid()) return { status: "UNAVAILABLE" };
            await vscode.window.showTextDocument(document, { preview: true });
            if (!valid()) return { status: "UNAVAILABLE" };
            if (!publish) return { status: "PREVIEWED", manifestSha256: plan.manifestSha256 };
            const parent = await vscode.window.showOpenDialog({ title: "Choose a parent outside the source and protected stores; a new snapshot folder will be created",
                canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: "Choose snapshot parent" });
            if (!valid()) return { status: "UNAVAILABLE" };
            if (!parent?.[0]) return { status: "CANCELLED" };
            if (parent[0].scheme !== "file") throw new Error("Local output folder required.");
            const destination = path.join(parent[0].fsPath, `soterai-public-${plan.id}`);
            const approval = await vscode.window.showWarningMessage(publicationReviewMessage(plan, destination),
                { modal: true }, "Publish reviewed snapshot");
            if (approval !== "Publish reviewed snapshot") return { status: "CANCELLED" };
            const stores = [context.globalStorageUri.fsPath, ...(context.storageUri ? [context.storageUri.fsPath] : []),
                ...[".codex", ".ssh", ".aws", ".azure", ".gnupg", ".vscode", ".config"].map(name => path.join(homedir(), name))];
            const result = await session.publish(plan, destination, stores);
            void vscode.window.showInformationMessage(`Public snapshot prepared at ${result.destination}. NO ISOLATION; synthetic examples only. Originals remain reachable to same-user tools.`);
            return { status: "PREPARED", destination: result.destination, manifestSha256: result.manifestSha256 };
        } catch {
            void vscode.window.showErrorMessage("Public snapshot not completed. Review selected-file restrictions, size limits, saved changes and the new output location. "
                + "A manifest alone does not prove successful preparation; require PREPARED and verified output hashes. Any incomplete output is retained for manual inspection. Source files were not overwritten.");
            return { status: "FAILED" };
        } finally {
            session?.revoke();
            if (session) active.delete(session);
            pending = false;
        }
    }
    context.subscriptions.push(vscode.commands.registerCommand("soterai.preparePublicWorkspace", () => run(true)),
        vscode.commands.registerCommand("soterai.previewDevelopmentContract", () => run(false)));
}
