import * as vscode from "vscode";
import {
    scanExtensions,
    analyzeMCPConfig,
    generateSafeMCPPolicy,
    type ExtensionMetadata,
    type MCPAnalysis,
} from "@soterai/guard-core";
import { escapeHtml, showInfoWebview, firstWorkspaceFolder } from "./util";

// ── Phase 8: LLM Extension Risk Scanner ──────────────────────────────────────

/** Map VS Code's installed extensions into the guard-core metadata shape. */
function collectInstalledExtensions(): ExtensionMetadata[] {
    return vscode.extensions.all.map((e) => {
        const pkg = (e.packageJSON ?? {}) as ExtensionMetadata["packageJSON"] & { isBuiltin?: boolean };
        return {
            id: e.id,
            displayName: pkg?.displayName,
            publisher: pkg?.publisher,
            isBuiltin: (e as { isBuiltin?: boolean }).isBuiltin ?? pkg?.isBuiltin,
            version: (pkg as { version?: string })?.version,
            packageJSON: pkg,
        };
    });
}

function levelBadge(level: string): string {
    const cls = level === "high" ? "block" : level === "medium" ? "approval_required" : level === "low" ? "warn" : "allow";
    return `<span class="badge ${cls}">${escapeHtml(level)}</span>`;
}

function renderExtensionRows(assessments: ReturnType<typeof scanExtensions>["assessments"]): string {
    return assessments
        .filter((a) => !a.isBuiltin)
        .map(
            (a) =>
                `<tr><td><code>${escapeHtml(a.id)}</code></td>` +
                `<td>${escapeHtml(a.displayName)}</td>` +
                `<td>${a.isAI ? "🤖 AI" : "—"}</td>` +
                `<td>${levelBadge(a.level)} ${escapeHtml(String(a.riskScore))}</td>` +
                `<td>${a.signals.map((s) => escapeHtml(s.label)).join("<br>")}</td>` +
                `<td>${escapeHtml(a.recommendation)}</td></tr>`,
        )
        .join("");
}

export function scanInstalledExtensionsRisk(): void {
    const report = scanExtensions(collectInstalledExtensions());
    const rows = renderExtensionRows(report.assessments);
    showInfoWebview(
        "soteraiExtensionRisk",
        "SoterAI: Installed Extension Risk",
        `<h1>🧩 Installed Extension Risk (heuristic)</h1>
     <p>${report.total} installed · <strong>${report.aiExtensions} AI assistant(s)</strong> · <strong>${report.highRisk} high-risk</strong>.
     Built-in extensions are hidden.</p>
     <table><tr><th>Id</th><th>Name</th><th>AI?</th><th>Risk</th><th>Signals</th><th>Recommendation</th></tr>${
         rows || `<tr><td colspan="6">No third-party extensions detected.</td></tr>`
     }</table>
     <p class="note">Heuristic risk from local extension metadata only — <strong>not</strong> malware detection. A high score means "broad footprint / verify the source", never "malicious". AI assistants can read workspace code by design; keep secrets in the SoterAI vault and share only SoterAI-built safe context.</p>`,
    );
}

export function showAIExtensions(): void {
    const report = scanExtensions(collectInstalledExtensions());
    const ai = report.assessments.filter((a) => a.isAI);
    const rows = ai
        .map(
            (a) =>
                `<tr><td><code>${escapeHtml(a.id)}</code></td><td>${escapeHtml(a.displayName)}</td>` +
                `<td>${escapeHtml(a.publisher)}</td><td>${levelBadge(a.level)}</td>` +
                `<td>${escapeHtml(a.recommendation)}</td></tr>`,
        )
        .join("");
    showInfoWebview(
        "soteraiAIExtensions",
        "SoterAI: AI Extensions",
        `<h1>🤖 AI Coding Assistants Detected</h1>
     <p>${ai.length} AI-capable extension(s) that can read your code and context.</p>
     <table><tr><th>Id</th><th>Name</th><th>Publisher</th><th>Risk</th><th>Recommendation</th></tr>${
         rows || `<tr><td colspan="5">No AI coding assistants detected.</td></tr>`
     }</table>
     <p class="note">Detection is heuristic (id/name/category matching) and may miss new tools. These extensions are not blocked by SoterAI — a VS Code extension cannot stop another extension from reading files it already has access to. Move secrets into the SoterAI vault for real protection.</p>`,
    );
}

export async function generateExtensionRiskReport(): Promise<void> {
    const report = scanExtensions(collectInstalledExtensions());
    // Human-readable, secret-free markdown report.
    const lines: string[] = [
        "# SoterAI IDE Guard — Extension Risk Report",
        "",
        `- Total extensions: ${report.total}`,
        `- AI assistants: ${report.aiExtensions}`,
        `- High-risk (heuristic): ${report.highRisk}`,
        `- Scanner version: ${report.scannerVersion}`,
        "",
        "> Heuristic risk from local metadata only. NOT malware detection.",
        "",
        "## Third-party extensions (highest risk first)",
        "",
    ];
    for (const a of report.assessments.filter((x) => !x.isBuiltin)) {
        lines.push(`### ${a.displayName} \`${a.id}\``);
        lines.push(`- Publisher: ${a.publisher}`);
        lines.push(`- AI assistant: ${a.isAI ? "yes" : "no"}`);
        lines.push(`- Risk: ${a.level} (${a.riskScore})`);
        if (a.signals.length) lines.push(`- Signals: ${a.signals.map((s) => s.label).join("; ")}`);
        lines.push(`- Recommendation: ${a.recommendation}`);
        lines.push("");
    }
    const doc = await vscode.workspace.openTextDocument({ content: lines.join("\n"), language: "markdown" });
    await vscode.window.showTextDocument(doc);
}

// ── Phase 9: MCP / Tool Permission Monitor ───────────────────────────────────

/** Common locations MCP configs live across AI tools. */
export const MCP_CONFIG_GLOBS = [
    ".vscode/mcp.json",
    ".cursor/mcp.json",
    ".cursor/mcp.jsonc",
    ".windsurf/mcp.json",
    ".mcp.json",
    "mcp.json",
    ".claude/mcp.json",
    ".continue/config.json",
    ".soterai/mcp.json",
];

async function findMCPConfigs(): Promise<vscode.Uri[]> {
    const folder = firstWorkspaceFolder();
    if (!folder) return [];
    const found: vscode.Uri[] = [];
    for (const rel of MCP_CONFIG_GLOBS) {
        const uri = vscode.Uri.joinPath(folder.uri, rel);
        try {
            await vscode.workspace.fs.stat(uri);
            found.push(uri);
        } catch {
            /* not present */
        }
    }
    return found;
}

async function analyzeConfigUri(uri: vscode.Uri): Promise<{ rel: string; analysis: MCPAnalysis }> {
    const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    return { rel: vscode.workspace.asRelativePath(uri), analysis: analyzeMCPConfig(text) };
}

function permBadges(perms: string[]): string {
    return perms.map((p) => `<span class="badge ${p === "broad_root" || p === "shell" ? "block" : "warn"}">${escapeHtml(p)}</span>`).join(" ");
}

export async function scanMCPConfigs(): Promise<void> {
    const configs = await findMCPConfigs();
    if (configs.length === 0) {
        return void vscode.window.showInformationMessage(
            "No MCP config files found (looked for .vscode/mcp.json, .cursor/mcp.json, .mcp.json, etc.).",
        );
    }
    const results = await Promise.all(configs.map(analyzeConfigUri));
    const totalServers = results.reduce((n, r) => n + r.analysis.serverCount, 0);
    const totalHigh = results.reduce((n, r) => n + r.analysis.highRisk, 0);
    const sections = results
        .map((r) => {
            const rows = r.analysis.servers
                .map(
                    (s) =>
                        `<tr><td><code>${escapeHtml(s.name)}</code></td>` +
                        `<td><code>${escapeHtml(s.transport)}</code></td>` +
                        `<td>${permBadges(s.permissions)}</td>` +
                        `<td>${escapeHtml(s.secretEnvKeys.join(", "))}</td>` +
                        `<td>${levelBadge(s.level)} ${escapeHtml(String(s.riskScore))}</td>` +
                        `<td>${s.reasons.map((x) => escapeHtml(x)).join("<br>")}</td></tr>`,
                )
                .join("");
            return `<h2>📄 ${escapeHtml(r.rel)}</h2>${
                r.analysis.parseError ? `<p class="note">${escapeHtml(r.analysis.parseError)}</p>` : ""
            }<table><tr><th>Server</th><th>Transport</th><th>Permissions</th><th>Secret env</th><th>Risk</th><th>Reasons</th></tr>${
                rows || `<tr><td colspan="6">No servers declared.</td></tr>`
            }</table>`;
        })
        .join("");
    showInfoWebview(
        "soteraiMCPScan",
        "SoterAI: MCP Permissions",
        `<h1>🔌 MCP / Tool Permissions</h1>
     <p>${configs.length} config file(s) · ${totalServers} server(s) · <strong>${totalHigh} high/critical</strong>.</p>
     ${sections}
     <p class="note">Permission table is derived from declared config only. Secret <em>values</em> are never read or shown — only env var names. Tool descriptions are treated as untrusted (possible prompt injection).</p>`,
    );
}

export async function showMCPToolPermissions(): Promise<void> {
    // Same data as scanMCPConfigs but focused on the active file if it is an MCP config.
    const active = vscode.window.activeTextEditor?.document;
    if (active && /mcp\.jsonc?$|\.continue[\\/]config\.json$/.test(active.uri.fsPath)) {
        const analysis = analyzeMCPConfig(active.getText());
        const rows = analysis.servers
            .map(
                (s) =>
                    `<tr><td><code>${escapeHtml(s.name)}</code></td><td>${permBadges(s.permissions)}</td>` +
                    `<td>${escapeHtml(s.envKeys.join(", "))}</td><td>${levelBadge(s.level)}</td></tr>`,
            )
            .join("");
        return showInfoWebview(
            "soteraiMCPPerms",
            "SoterAI: MCP Tool Permissions",
            `<h1>🔌 MCP Tool Permissions — ${escapeHtml(vscode.workspace.asRelativePath(active.uri))}</h1>
       <table><tr><th>Server</th><th>Permissions</th><th>Env keys</th><th>Risk</th></tr>${
           rows || `<tr><td colspan="4">No servers.</td></tr>`
       }</table>
       <p class="note">Env var names shown; values never read.</p>`,
        );
    }
    // Otherwise fall back to a full workspace scan.
    await scanMCPConfigs();
}

export async function blockRiskyMCPRecommendation(): Promise<void> {
    const configs = await findMCPConfigs();
    if (configs.length === 0) return void vscode.window.showInformationMessage("No MCP config files found to review.");
    const results = await Promise.all(configs.map(analyzeConfigUri));
    const risky = results.flatMap((r) => r.analysis.servers.filter((s) => s.level === "high" || s.level === "critical").map((s) => ({ rel: r.rel, s })));
    if (risky.length === 0) {
        return void vscode.window.showInformationMessage("No high/critical-risk MCP servers found. Nothing to block.");
    }
    const lines = risky.map((r) => `• [${r.s.level}] ${r.s.name} in ${r.rel} — ${r.s.reasons[0] ?? ""}`);
    const pick = await vscode.window.showWarningMessage(
        `SoterAI found ${risky.length} risky MCP server(s):\n${lines.join("\n")}\n\nSoterAI cannot edit another tool's config for you, but you should disable or scope these. Open the first config to fix it?`,
        { modal: true },
        "Open Config",
    );
    if (pick === "Open Config") {
        const uri = configs.find((c) => vscode.workspace.asRelativePath(c) === risky[0].rel);
        if (uri) await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
    }
}

export async function generateMCPSafePolicy(): Promise<void> {
    const configs = await findMCPConfigs();
    const merged: MCPAnalysis = {
        analyzerVersion: "1.0.0",
        detectorVersion: "1.0.0",
        serverCount: 0,
        highRisk: 0,
        servers: [],
    };
    for (const uri of configs) {
        const { analysis } = await analyzeConfigUri(uri);
        merged.servers.push(...analysis.servers);
        merged.serverCount += analysis.serverCount;
        merged.highRisk += analysis.highRisk;
    }
    const policy = generateSafeMCPPolicy(merged);
    const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(policy, null, 2),
        language: "json",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(
        merged.serverCount > 0
            ? `Generated least-privilege MCP policy for ${merged.serverCount} server(s).`
            : "Generated an MCP safe-policy template (no MCP servers found).",
    );
}

/** Register Phase 8 & 9 commands. */
export function registerScannerCommands(context: vscode.ExtensionContext): void {
    const reg = (id: string, handler: (...args: any[]) => any) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    reg("soterai.scanInstalledExtensionsRisk", scanInstalledExtensionsRisk);
    reg("soterai.showAIExtensions", showAIExtensions);
    reg("soterai.generateExtensionRiskReport", generateExtensionRiskReport);
    reg("soterai.scanMCPConfigs", scanMCPConfigs);
    reg("soterai.showMCPToolPermissions", showMCPToolPermissions);
    reg("soterai.blockRiskyMCPRecommendation", blockRiskyMCPRecommendation);
    reg("soterai.generateMCPSafePolicy", generateMCPSafePolicy);
}
