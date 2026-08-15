import * as vscode from "vscode";
import { extractVaultCandidates } from "@soterai/guard-core";
import { VaultManager } from "../firewall/VaultManager";
import { assertWorkspaceFileUri } from "../security/WorkspacePathGuard";

/**
 * AutoVaultMigration — on-disk secret elimination for ALL agents.
 *
 * This is the ONLY mechanism that stops out-of-process agents (Claude Code CLI,
 * Codex CLI, any tool that reads files via OS syscalls) from seeing raw secrets.
 * It works by replacing raw secret values with [SOTERAI_PROTECTED_*] placeholders
 * directly in the workspace files so the on-disk content is already clean.
 *
 * Trigger points:
 *   1. Workspace open / extension activate  — scans all sensitive files once.
 *   2. New file created matching sensitive globs — scans + migrates immediately.
 *   3. Explicit user command "soterai.autoMigrateWorkspace".
 *
 * UX design:
 *   - If only a few files need migration a quick-pick confirmation is shown.
 *   - If migration is in progress a progress notification is shown.
 *   - The user can disable auto-scan via soterai.autoVaultMigration.enabled.
 */

const SENSITIVE_GLOBS = [
    "**/.env",
    "**/.env.*",
    "**/*.pem",
    "**/*.key",
    "**/id_rsa",
    "**/id_rsa.*",
    "**/id_ed25519",
    "**/id_ed25519.*",
    "**/.npmrc",
    "**/.pypirc",
    "**/.aws/credentials",
    "**/.azure/**/credentials*",
    "**/secrets.json",
    "**/secrets.yaml",
    "**/secrets.yml",
    "**/credentials.json",
    "**/credentials.yaml",
    "**/credentials.yml",
    "**/.docker/config.json",
    "**/.kube/config",
];

const EXCLUDE_GLOB = "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**}";

export class AutoVaultMigration implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly vault: VaultManager;
    /** Whether an auto-scan is already running — prevent overlapping scans. */
    private scanning = false;
    private initialScanTimer?: ReturnType<typeof setTimeout>;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.vault = new VaultManager(context);
    }

    /**
     * Start watching for new sensitive files and run the initial workspace scan.
     * Call this from activate() after the WorkspaceGuard is set up.
     */
    start(): void {
        const config = vscode.workspace.getConfiguration("soterai");
        if (!config.get<boolean>("autoVaultMigration.enabled", true)) return;
        if (!vscode.workspace.isTrusted) return;

        // Watch for new sensitive files and immediately offer migration.
        for (const glob of SENSITIVE_GLOBS) {
            const watcher = vscode.workspace.createFileSystemWatcher(glob);
            watcher.onDidCreate((uri) => void this.onNewFile(uri));
            this.disposables.push(watcher);
        }

        // Initial discovery is delayed and cancellable. It never changes files
        // without an explicit modal confirmation.
        this.initialScanTimer = setTimeout(() => {
            this.initialScanTimer = undefined;
            void this.scanWorkspace({ silent: true });
        }, 3000);
    }

    /** Called when a NEW sensitive file is created in the workspace. */
    private async onNewFile(uri: vscode.Uri): Promise<void> {
        const rel = vscode.workspace.asRelativePath(uri);
        // Small delay — give the writing process time to flush the file.
        await new Promise<void>((r) => setTimeout(r, 500));

        let text: string;
        try {
            await assertWorkspaceFileUri(uri);
            text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        } catch {
            return;
        }

        const candidates = extractVaultCandidates(text);
        if (candidates.length === 0) return;

        const choice = await vscode.window.showWarningMessage(
            `[SoterAI] New sensitive file "${rel}" contains ${candidates.length} secret(s). ` +
                "Migrate now to hide them from ALL AI agents?",
            { modal: false },
            "Migrate Now",
            "Later",
        );

        if (choice === "Migrate Now") {
            await this.migrateFile(uri);
        }
    }

    /**
     * Scan the entire workspace for sensitive files with raw secrets and offer
     * to migrate them all.
     *
     * @param opts.silent  When true, only show a notification if secrets were found.
     * @param opts.force   When true, skip the confirmation dialog.
     */
    async scanWorkspace(opts: { silent?: boolean; force?: boolean } = {}): Promise<void> {
        if (this.scanning) return;
        this.scanning = true;

        try {
            await vscode.window.withProgress(
                {
                    location: opts.silent ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
                    title: "SoterAI: Scanning workspace for unprotected secrets…",
                    cancellable: true,
                },
                async (progress, token) => {
                    const files: vscode.Uri[] = [];
                    for (const glob of SENSITIVE_GLOBS) {
                        if (token.isCancellationRequested) break;
                        const found = await vscode.workspace.findFiles(glob, EXCLUDE_GLOB, 200);
                        for (const f of found) {
                            if (!files.some((x) => x.fsPath === f.fsPath)) files.push(f);
                        }
                    }

                    const toMigrate: Array<{ uri: vscode.Uri; count: number }> = [];
                    for (const uri of files) {
                        if (token.isCancellationRequested) break;
                        const rel = vscode.workspace.asRelativePath(uri);
                        progress.report({ message: rel });
                        try {
                            await assertWorkspaceFileUri(uri);
                            const text = new TextDecoder().decode(
                                await vscode.workspace.fs.readFile(uri),
                            );
                            const candidates = extractVaultCandidates(text);
                            if (candidates.length > 0) {
                                toMigrate.push({ uri, count: candidates.length });
                            }
                        } catch {
                            /* skip unreadable files */
                        }
                    }

                    if (toMigrate.length === 0) {
                        if (!opts.silent) {
                            vscode.window.showInformationMessage(
                                "[SoterAI] All sensitive files are already protected (no raw secrets found).",
                            );
                        }
                        return;
                    }

                    const totalSecrets = toMigrate.reduce((s, f) => s + f.count, 0);
                    const fileList = toMigrate
                        .map((f) => `  • ${vscode.workspace.asRelativePath(f.uri)} (${f.count} secret(s))`)
                        .join("\n");

                    let proceed = opts.force ?? false;
                    if (!proceed) {
                        const choice = await vscode.window.showWarningMessage(
                            `[SoterAI] Found ${totalSecrets} raw secret(s) in ${toMigrate.length} file(s):\n${fileList}\n\n` +
                                "Migrate all to vault? Raw values will be replaced with placeholders on disk. " +
                                "An encrypted backup is saved outside the workspace.",
                            { modal: true },
                            "Migrate All",
                            "Review One-by-One",
                            "Skip",
                        );
                        if (choice === "Migrate All") proceed = true;
                        if (choice === "Review One-by-One") {
                            await this.reviewOneByOne(toMigrate.map((f) => f.uri));
                            return;
                        }
                    }

                    if (proceed) {
                        let migrated = 0;
                        for (const { uri } of toMigrate) {
                            if (token.isCancellationRequested) break;
                            progress.report({
                                message: `Migrating ${vscode.workspace.asRelativePath(uri)}…`,
                            });
                            migrated += await this.migrateFile(uri);
                        }
                        vscode.window.showInformationMessage(
                            `[SoterAI] ${migrated} secret(s) migrated to encrypted vault. ` +
                                "Workspace files now contain placeholders — all AI agents see only placeholders.",
                        );
                    }
                },
            );
        } finally {
            this.scanning = false;
        }
    }

    /** Migrate a single file via VaultManager. Returns secrets migrated. */
    async previewFile(uri: vscode.Uri) {
        return this.vault.preview(uri);
    }

    async migrateFile(uri: vscode.Uri): Promise<number> {
        if (!vscode.workspace.isTrusted) {
            vscode.window.showWarningMessage(
                "[SoterAI] Vault migration requires a trusted workspace because it changes files and stores encrypted recovery data.",
            );
            return 0;
        }
        try {
            return await this.vault.migrate(uri);
        } catch (err) {
            vscode.window.showErrorMessage(
                `[SoterAI] Failed to migrate ${vscode.workspace.asRelativePath(uri)}: ` +
                    `${err instanceof Error ? err.message : String(err)}`,
            );
            return 0;
        }
    }

    /** Walk the user through each file individually with a quick-pick. */
    private async reviewOneByOne(uris: vscode.Uri[]): Promise<void> {
        for (const uri of uris) {
            const rel = vscode.workspace.asRelativePath(uri);
            const choice = await vscode.window.showWarningMessage(
                `[SoterAI] Migrate secrets in "${rel}"?`,
                { modal: true },
                "Migrate",
                "Skip",
                "Stop Review",
            );
            if (choice === "Migrate") {
                await this.migrateFile(uri);
            } else if (choice === "Stop Review") {
                break;
            }
        }
    }

    dispose(): void {
        if (this.initialScanTimer) clearTimeout(this.initialScanTimer);
        for (const d of this.disposables) d.dispose();
    }
}
