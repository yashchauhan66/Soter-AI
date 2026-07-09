import * as vscode from "vscode";
import { escapeHtml, showInfoWebview, firstWorkspaceFolder } from "../firewall/util";

const INJECTION_PATTERNS = [
    { pattern: /ignore previous instructions/i, label: "Ignore previous instructions" },
    { pattern: /ignore all previous/i, label: "Ignore all previous" },
    { pattern: /disregard.*instructions/i, label: "Disregard instructions" },
    { pattern: /override.*safety/i, label: "Override safety" },
    { pattern: /bypass.*security/i, label: "Bypass security" },
    { pattern: /always trust/i, label: "Always trust this" },
    { pattern: /store this secret/i, label: "Store this secret" },
    { pattern: /remember credentials/i, label: "Remember credentials" },
    { pattern: /do not reveal/i, label: "Do not reveal" },
    { pattern: /exfiltrate/i, label: "Exfiltration instruction" },
    { pattern: /read \.env/i, label: "Read .env instruction" },
    { pattern: /send to/i, label: "Send to external" },
    { pattern: /hidden instruction/i, label: "Hidden instruction" },
    { pattern: /secret instruction/i, label: "Secret instruction" },
    { pattern: /system prompt/i, label: "System prompt override" },
    { pattern: /you are now/i, label: "Identity override" },
    { pattern: /new instructions/i, label: "New instructions" },
    { pattern: /forget everything/i, label: "Forget everything" },
    { pattern: /reset your/i, label: "Reset instructions" },
    { pattern: /act as/i, label: "Act as override" },
];

const INVISIBLE_UNICODE_RANGES = [
    /[\u200B-\u200F]/g,
    /[\u2060-\u2064]/g,
    /[\uFEFF]/g,
    /[\u00AD]/g,
    /[\u2028-\u2029]/g,
];

const MEMORY_FILE_PATTERNS = [
    "**/.cursorrules",
    "**/CLAUDE.md",
    "**/.windsurfrules",
    "**/.clinerules",
    "**/.aiderules",
    "**/.github/copilot-instructions.md",
    "**/.cursor/rules/**",
    "**/.soterai/memory/**",
    "**/prompt*.md",
    "**/prompts/**",
];

export interface MemoryPoisoningFinding {
    file: string;
    line: number;
    pattern: string;
    label: string;
    risk: "high" | "critical";
    excerpt: string;
}

export class MemoryGuard {
    private findings: MemoryPoisoningFinding[] = [];

    async scanMemoryFiles(): Promise<MemoryPoisoningFinding[]> {
        this.findings = [];
        const folder = firstWorkspaceFolder();
        if (!folder) return this.findings;

        for (const pattern of MEMORY_FILE_PATTERNS) {
            const files = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 50);
            for (const file of files) {
                await this.scanFile(file);
            }
        }
        return this.findings;
    }

    async scanFile(uri: vscode.Uri): Promise<MemoryPoisoningFinding[]> {
        try {
            const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
            const rel = vscode.workspace.asRelativePath(uri);
            const lines = text.split("\n");

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                for (const { pattern, label } of INJECTION_PATTERNS) {
                    if (pattern.test(line)) {
                        this.findings.push({
                            file: rel,
                            line: i + 1,
                            pattern: pattern.source,
                            label,
                            risk: "high",
                            excerpt: line.substring(0, 120),
                        });
                    }
                }

                for (const range of INVISIBLE_UNICODE_RANGES) {
                    const matches = line.match(range);
                    if (matches && matches.length > 0) {
                        this.findings.push({
                            file: rel,
                            line: i + 1,
                            pattern: "invisible_unicode",
                            label: "Invisible Unicode characters detected",
                            risk: "critical",
                            excerpt: line.substring(0, 120),
                        });
                        break;
                    }
                }

                if (/<!--.*-->/i.test(line) && /ignore|instruction|secret|read|env|exfiltrate/i.test(line)) {
                    this.findings.push({
                        file: rel,
                        line: i + 1,
                        pattern: "html_comment_injection",
                        label: "Suspicious HTML comment with instruction keywords",
                        risk: "high",
                        excerpt: line.substring(0, 120),
                    });
                }
            }
        } catch { /* skip unreadable */ }
        return this.findings;
    }

    getFindings(): ReadonlyArray<MemoryPoisoningFinding> { return this.findings; }
}

export function registerMemoryGuardCommands(context: vscode.ExtensionContext, guard: MemoryGuard): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.scanMemoryRisk", async () => {
        const findings = await guard.scanMemoryFiles();
        const rows = findings.map((f) => `<tr><td><code>${escapeHtml(f.file)}</code></td><td>${f.line}</td><td><span class="badge ${escapeHtml(f.risk)}">${escapeHtml(f.risk.toUpperCase())}</span></td><td>${escapeHtml(f.label)}</td><td><code>${escapeHtml(f.excerpt)}</code></td></tr>`).join("");

        showInfoWebview("soteraiMemoryGuard", "SoterAI: Memory Poisoning Risk",
            `<h1>Memory Poisoning Guard</h1><p>${findings.length} potential poisoning finding(s) in AI instruction/memory files.</p>
            <table><tr><th>File</th><th>Line</th><th>Risk</th><th>Pattern</th><th>Excerpt</th></tr>
            ${rows || "<tr><td colspan='5'>No poisoning patterns detected.</td></tr>"}</table>
            <p class="note">Scans repo instruction files and memory files for prompt injection, invisible Unicode, and suspicious comments. Does not modify files automatically.</p>`
        );
    });

    reg("soterai.cleanPoisonedInstructions", async () => {
        const findings = await guard.scanMemoryFiles();
        if (findings.length === 0) return vscode.window.showInformationMessage("No poisoned instructions found.");

        const confirm = await vscode.window.showWarningMessage(
            `Found ${findings.length} suspicious pattern(s) in instruction files. SoterAI can show you the files for manual review. It will not modify files automatically.`,
            { modal: true },
            "Show Files"
        );
        if (confirm === "Show Files") {
            const files = [...new Set(findings.map((f) => f.file))];
            for (const rel of files.slice(0, 5)) {
                const uris = await vscode.workspace.findFiles(`**/${rel}`, undefined, 1);
                if (uris[0]) await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uris[0]));
            }
        }
    });

    reg("soterai.showMemoryPoisoningFindings", async () => {
        const findings = await guard.scanMemoryFiles();
        if (findings.length === 0) return vscode.window.showInformationMessage("No memory poisoning findings.");

        const rows = findings.map((f) => `<tr><td><code>${escapeHtml(f.file)}</code></td><td>${f.line}</td><td><span class="badge ${escapeHtml(f.risk)}">${escapeHtml(f.risk.toUpperCase())}</span></td><td>${escapeHtml(f.label)}</td><td><code>${escapeHtml(f.excerpt)}</code></td></tr>`).join("");

        showInfoWebview("soteraiMemoryPoisoning", "SoterAI: Memory Poisoning Findings",
            `<h1>Memory Poisoning Findings</h1><p>${findings.length} finding(s).</p>
            <table><tr><th>File</th><th>Line</th><th>Risk</th><th>Pattern</th><th>Excerpt</th></tr>${rows}</table>`
        );
    });
}
