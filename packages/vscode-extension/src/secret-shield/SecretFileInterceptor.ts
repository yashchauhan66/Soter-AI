import * as vscode from "vscode";
import { extractVaultCandidates } from "@soterai/guard-core";

/**
 * SecretFileInterceptor — early visibility for sensitive-file access.
 *
 * VS Code emits onDidOpenTextDocument after a document is available and does
 * not expose the caller or an awaitable interception hook. This component must
 * therefore never claim it redacted content before another extension read it.
 * It detects plaintext in sensitive files, records redacted metadata, and
 * offers the only cross-process prevention available here: an explicit,
 * encrypted on-disk vault migration.
 *
 * What this does NOT stop:
 *   - Out-of-process agents (Claude Code CLI, Codex CLI) that read files
 *     directly via the OS filesystem.  For those, VaultManager.migrate() on
 *     disk is the right answer — a migrated file has placeholders on disk.
 *   - An extension that has already read the file BEFORE SoterAI activated.
 *
 * It deliberately does not modify the editor buffer. The previous implementation
 * inserted placeholders without first persisting the secret in the vault; an
 * autosave could then destroy the only plaintext copy.
 */

/** File name / extension patterns whose content should always be scanned. */
const SENSITIVE_FILENAME_PATTERNS = [
    /^\.env($|\.)/i,              // .env, .env.local, .env.production …
    /\.pem$/i,
    /\.key$/i,
    /\.p12$/i,
    /\.pfx$/i,
    /^id_rsa/i,
    /^id_ed25519/i,
    /^\.npmrc$/i,
    /^\.pypirc$/i,
    /credentials$/i,              // .aws/credentials, credentials.json …
    /secrets\.(json|ya?ml)$/i,
    /^\.docker\/config\.json$/i,
    /^\.kube\/config$/i,
];

function isSensitiveFile(uri: vscode.Uri): boolean {
    const name = uri.path.split("/").pop() ?? "";
    const rel  = vscode.workspace.asRelativePath(uri);
    return SENSITIVE_FILENAME_PATTERNS.some((p) => p.test(name) || p.test(rel));
}

export class SecretFileInterceptor implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    /** Files already reported this session — avoid repeated notifications. */
    private readonly reportedThisSession = new Set<string>();

    constructor(
        _context: vscode.ExtensionContext,
        private readonly onDetected: (uri: vscode.Uri, count: number) => void,
    ) {
        // Intercept every document the editor opens.
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                void this.intercept(doc);
            }),
        );
        // Also scan documents that are already open when the extension activates.
        void this.scanAlreadyOpenDocuments();
    }

    /** Called once at activation for files that were open before we loaded. */
    private async scanAlreadyOpenDocuments(): Promise<void> {
        for (const doc of vscode.workspace.textDocuments) {
            await this.intercept(doc);
        }
    }

    private async intercept(doc: vscode.TextDocument): Promise<void> {
        if (doc.uri.scheme !== "file") return;
        if (!isSensitiveFile(doc.uri)) return;
        if (this.reportedThisSession.has(doc.uri.fsPath)) return;

        const config = vscode.workspace.getConfiguration("soterai");
        // Respect user opt-out. This is monitoring only; prevention requires
        // the explicit trusted-workspace vault migration flow.
        if (!config.get<boolean>("secretInterceptor.enabled", true)) return;

        const text = doc.getText();
        if (!text.trim()) return;

        let candidates;
        try {
            candidates = extractVaultCandidates(text);
        } catch {
            return;
        }
        if (candidates.length === 0) return;

        this.reportedThisSession.add(doc.uri.fsPath);

        this.onDetected(doc.uri, candidates.length);

        // Notify the user once per file per session.
        const rel = vscode.workspace.asRelativePath(doc.uri);
        const msg =
            `[SoterAI] ${candidates.length} plaintext secret(s) detected in "${rel}". ` +
            "VS Code cannot identify or block another extension's direct file read. " +
            "Migrate to the encrypted vault to remove plaintext from disk for editor and CLI agents.";
        vscode.window
            .showWarningMessage(msg, "Migrate to Vault", "Dismiss")
            .then((choice) => {
                if (choice === "Migrate to Vault") {
                    void vscode.commands.executeCommand("soterai.migrateCurrentFileToVault", doc.uri);
                }
            });
    }

    /**
     * Clear the session cache for a file — call this after the user migrates
     * it to the vault so the now-placeholder file is not double-redacted.
     */
    clearCache(uri: vscode.Uri): void {
        this.reportedThisSession.delete(uri.fsPath);
    }

    dispose(): void {
        for (const d of this.disposables) d.dispose();
    }
}
