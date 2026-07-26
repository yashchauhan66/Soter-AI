import * as vscode from "vscode";
import { escapeHtml, showInfoWebview, firstWorkspaceFolder } from "../firewall/util";

/** Glob patterns for vscode.workspace.findFiles() — NOT regex. */
const PROTECTED_GLOBS = [
    "**/.env*",
    "**/*.pem",
    "**/*.key",
    "**/*.p12",
    "**/*.pfx",
    "**/id_rsa*",
    "**/id_ed25519*",
    "**/.npmrc",
    "**/.pypirc",
    "**/.aws/credentials",
    "**/.azure/**/credentials*",
    "**/secrets.yaml",
    "**/secrets.yml",
    "**/secrets.json",
    "**/credentials.yaml",
    "**/credentials.yml",
    "**/credentials.json",
    "**/.docker/config.json",
    "**/.kube/config",
    "**/.ssh/known_hosts",
    "**/.gnupg/**",
];

const REPO_INSTRUCTION_FILES = [
    "CLAUDE.md",
    ".cursorrules",
    ".windsurfrules",
    ".clinerules",
    ".aiderules",
    ".github/copilot-instructions.md",
];

export interface ProtectedFileEntry {
    pattern: string;
    level: "protected" | "sensitive";
    addedAt: number;
    source: "auto" | "manual" | "policy";
}

const PROTECTED_STATE_KEY = "soterai.protectedWorkspace";
const WORKSPACE_MODE_KEY = "soterai.protectedWorkspaceEnabled";

export class WorkspaceGuard {
    private protectedFiles: ProtectedFileEntry[] = [];
    private enabled = false;
    private statusBarItem: vscode.StatusBarItem;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 94);
        this.statusBarItem.command = "soterai.showProtectedFiles";
        context.subscriptions.push(this.statusBarItem);

        const stored = context.globalState.get<ProtectedFileEntry[]>(PROTECTED_STATE_KEY);
        if (stored) this.protectedFiles = stored;
        this.enabled = context.globalState.get<boolean>(WORKSPACE_MODE_KEY) ?? false;
        this.updateStatusBar();
    }

    get isEnabled(): boolean { return this.enabled; }

    async enable(): Promise<void> {
        this.enabled = true;
        await this.context.globalState.update(WORKSPACE_MODE_KEY, true);
        await this.autoDetectFiles();
        this.updateStatusBar();
    }

    async disable(): Promise<void> {
        this.enabled = false;
        await this.context.globalState.update(WORKSPACE_MODE_KEY, false);
        this.updateStatusBar();
    }

    getProtectedFiles(): ReadonlyArray<ProtectedFileEntry> { return this.protectedFiles; }

    async addFile(relPath: string): Promise<void> {
        if (this.protectedFiles.some((f) => f.pattern === relPath)) return;
        this.protectedFiles.push({ pattern: relPath, level: "protected", addedAt: Date.now(), source: "manual" });
        await this.persist();
    }

    async removeFile(pattern: string): Promise<void> {
        this.protectedFiles = this.protectedFiles.filter((f) => f.pattern !== pattern);
        await this.persist();
    }

    isProtected(filePath: string): boolean {
        return this.protectedFiles.some((f) => {
            if (f.pattern.includes("*")) {
                // Escape regex special chars before replacing glob * with .*
                // This prevents ReDoS from patterns containing crafted regex characters
                const escaped = f.pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
                try {
                    const regex = new RegExp(`^${escaped}$`, "i");
                    return regex.test(filePath);
                } catch {
                    return false;
                }
            }
            return filePath.includes(f.pattern);
        });
    }

    async generateEnvExample(): Promise<vscode.Uri | undefined> {
        const uri = vscode.window.activeTextEditor?.document.uri;
        if (!uri) return undefined;
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        const lines = text.split("\n").map((line) => {
            if (line.trim().startsWith("#") || !line.includes("=")) return line;
            const eqIndex = line.indexOf("=");
            const key = line.substring(0, eqIndex);
            return `${key}=YOUR_${key.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_HERE`;
        });
        const dir = uri.path.substring(0, uri.path.lastIndexOf("/"));
        const exampleUri = vscode.Uri.joinPath(uri.with({ path: dir }), ".env.example");
        await vscode.workspace.fs.writeFile(exampleUri, new TextEncoder().encode(lines.join("\n")));
        return exampleUri;
    }

    getWorkspaceRiskScore(): number {
        let score = 0;
        const folder = firstWorkspaceFolder();
        if (!folder) return 0;

        for (const entry of this.protectedFiles) {
            if (entry.level === "protected") score += 15;
            else score += 5;
        }
        return Math.min(score, 100);
    }

    private async autoDetectFiles(): Promise<void> {
        const folder = firstWorkspaceFolder();
        if (!folder) return;

        for (const glob of PROTECTED_GLOBS) {
            const files = await vscode.workspace.findFiles(glob, "**/node_modules/**", 50);
            for (const file of files) {
                const rel = vscode.workspace.asRelativePath(file);
                if (!this.protectedFiles.some((f) => f.pattern === rel)) {
                    this.protectedFiles.push({ pattern: rel, level: "protected", addedAt: Date.now(), source: "auto" });
                }
            }
        }

        for (const instrFile of REPO_INSTRUCTION_FILES) {
            const files = await vscode.workspace.findFiles(`**/${instrFile}`, "**/node_modules/**", 10);
            for (const file of files) {
                const rel = vscode.workspace.asRelativePath(file);
                if (!this.protectedFiles.some((f) => f.pattern === rel)) {
                    this.protectedFiles.push({ pattern: rel, level: "sensitive", addedAt: Date.now(), source: "auto" });
                }
            }
        }

        await this.persist();
    }

    private async persist(): Promise<void> {
        await this.context.globalState.update(PROTECTED_STATE_KEY, this.protectedFiles);
    }

    private updateStatusBar(): void {
        if (this.enabled) {
            this.statusBarItem.text = `$(lock) Protected (${this.protectedFiles.length})`;
            this.statusBarItem.tooltip = `Protected Workspace Mode: Active. ${this.protectedFiles.length} files protected.`;
        } else {
            this.statusBarItem.text = "$(unlock) Protected Off";
            this.statusBarItem.tooltip = "Protected Workspace Mode is disabled.";
        }
        this.statusBarItem.show();
    }

    dispose(): void { this.statusBarItem.dispose(); }
}

export function registerWorkspaceGuardCommands(context: vscode.ExtensionContext, guard: WorkspaceGuard): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.enableProtectedWorkspace", async () => {
        await guard.enable();
        vscode.window.showInformationMessage("SoterAI Protected Workspace Mode enabled. Sensitive files auto-protected.");
    });

    reg("soterai.disableProtectedWorkspace", async () => {
        await guard.disable();
        vscode.window.showInformationMessage("SoterAI Protected Workspace Mode disabled.");
    });

    reg("soterai.showProtectedFilesList", () => {
        const files = guard.getProtectedFiles();
        const rows = files.map((f) => `<tr><td><code>${escapeHtml(f.pattern)}</code></td><td><span class="badge ${escapeHtml(f.level)}">${escapeHtml(f.level)}</span></td><td>${escapeHtml(f.source)}</td><td>${new Date(f.addedAt).toLocaleDateString()}</td></tr>`).join("");
        showInfoWebview("soteraiProtectedFilesList", "SoterAI: Protected Workspace Files",
            `<h1>Protected Workspace Files</h1><p>${files.length} protected file(s).</p>
            <table><tr><th>Pattern</th><th>Level</th><th>Source</th><th>Added</th></tr>
            ${rows || "<tr><td colspan='4'>No protected files.</td></tr>"}</table>
            <p class="note">Protected files are excluded from AI context. Auto-detected patterns include .env*, *.pem, id_rsa, .npmrc, .aws/credentials, and repo instruction files.</p>`
        );
    });

    reg("soterai.addFileToProtected", async () => {
        const uri = vscode.window.activeTextEditor?.document.uri;
        if (!uri) return vscode.window.showErrorMessage("Open a file to protect.");
        const rel = vscode.workspace.asRelativePath(uri);
        await guard.addFile(rel);
        vscode.window.showInformationMessage(`Added ${rel} to protected files.`);
    });

    reg("soterai.removeFileFromProtected", async () => {
        const files = guard.getProtectedFiles();
        if (files.length === 0) return vscode.window.showInformationMessage("No protected files to remove.");
        const pick = await vscode.window.showQuickPick(
            files.map((f) => ({ label: f.pattern, detail: f.level, pattern: f.pattern })),
            { title: "Remove Protected File", placeHolder: "Select a file to unprotect" }
        );
        if (pick) {
            await guard.removeFile(pick.pattern);
            vscode.window.showInformationMessage(`Removed ${pick.pattern} from protected files.`);
        }
    });

    reg("soterai.generateSafeEnvExample", async () => {
        const exampleUri = await guard.generateEnvExample();
        if (exampleUri) {
            await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(exampleUri));
            vscode.window.showInformationMessage("Generated .env.example with placeholder values (no secrets).");
        } else {
            vscode.window.showErrorMessage("Open a .env-style file first.");
        }
    });

    reg("soterai.showWorkspaceRiskScore", () => {
        const score = guard.getWorkspaceRiskScore();
        const level = score >= 70 ? "Critical" : score >= 35 ? "High" : score >= 15 ? "Medium" : "Low";
        vscode.window.showInformationMessage(`Workspace Risk Score: ${score}/100 (${level}). ${guard.getProtectedFiles().length} files protected.`);
    });
}
