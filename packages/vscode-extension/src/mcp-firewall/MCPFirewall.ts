import * as vscode from "vscode";
import { escapeHtml, showInfoWebview, firstWorkspaceFolder } from "../firewall/util";
import { MCP_CONFIG_GLOBS } from "../firewall/scanners";
import { advisoryNotice, PROTECTION } from "../protection/ProtectionLevel";

const TOOL_CLASSIFICATIONS: Record<string, string[]> = {
    filesystem: ["read", "write", "list", "glob", "search", "open", "create", "delete", "move", "copy"],
    shell: ["exec", "run", "execute", "command", "shell", "bash", "sh", "cmd", "powershell", "spawn"],
    network: ["fetch", "http", "request", "api", "url", "web", "browse", "download", "upload"],
    database: ["query", "sql", "database", "db", "postgres", "mysql", "mongo", "redis"],
    browser: ["open", "navigate", "click", "type", "screenshot", "puppeteer", "playwright", "selenium"],
    memory: ["memory", "store", "recall", "context", "session", "history"],
    credential: ["auth", "token", "key", "secret", "password", "credential", "oauth"],
};

const INJECTION_PATTERNS = [
    /ignore previous instructions/i,
    /disregard.*instructions/i,
    /override.*safety/i,
    /bypass.*security/i,
    /always trust/i,
    /do not reveal/i,
    /hidden instruction/i,
    /secret instruction/i,
    /system prompt/i,
    /you are now/i,
    /new instructions/i,
];

export interface MCPToolEntry {
    name: string;
    serverName: string;
    configPath: string;
    permissions: string[];
    riskScore: number;
    level: "low" | "medium" | "high" | "critical";
    reasons: string[];
    envKeys: string[];
    blocked: boolean;
}

const TOOL_STATE_KEY = "soterai.mcpToolPolicy";

export class MCPFirewall {
    private tools: MCPToolEntry[] = [];
    private blockedTools = new Set<string>();

    constructor(private readonly context: vscode.ExtensionContext) {
        const blocked = context.globalState.get<string[]>(TOOL_STATE_KEY);
        if (blocked) this.blockedTools = new Set(blocked);
    }

    async scanConfigs(): Promise<MCPToolEntry[]> {
        this.tools = [];
        const folder = firstWorkspaceFolder();
        if (!folder) return this.tools;

        for (const rel of MCP_CONFIG_GLOBS) {
            const uri = vscode.Uri.joinPath(folder.uri, rel);
            try {
                const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
                this.parseConfig(text, rel);
            } catch { /* not present */ }
        }
        return this.tools;
    }

    isToolBlocked(toolName: string): boolean {
        return this.blockedTools.has(toolName);
    }

    async blockTool(toolName: string): Promise<void> {
        this.blockedTools.add(toolName);
        await this.context.globalState.update(TOOL_STATE_KEY, Array.from(this.blockedTools));
    }

    async approveTool(toolName: string): Promise<void> {
        this.blockedTools.delete(toolName);
        await this.context.globalState.update(TOOL_STATE_KEY, Array.from(this.blockedTools));
    }

    getTools(): ReadonlyArray<MCPToolEntry> { return this.tools; }

    generateSafePolicy(): Record<string, unknown> {
        const policy: Record<string, unknown> = { mcpTools: {} };
        for (const tool of this.tools) {
            (policy.mcpTools as Record<string, unknown>)[tool.name] = {
                level: tool.level,
                blocked: this.blockedTools.has(tool.name),
                permissions: tool.permissions,
                reasons: tool.reasons,
            };
        }
        return policy;
    }

    private parseConfig(text: string, configPath: string): void {
        let config: Record<string, unknown>;
        try { config = JSON.parse(text); } catch { return; }

        const servers = (config.mcpServers ?? config.servers ?? {}) as Record<string, Record<string, unknown>>;
        for (const [name, server] of Object.entries(servers)) {
            if (!server || typeof server !== "object") continue;
            const permissions: string[] = [];
            const reasons: string[] = [];
            let riskScore = 0;
            const envKeys: string[] = [];

            const command = typeof server.command === "string" ? server.command.toLowerCase() : "";
            const args = Array.isArray(server.args) ? server.args.map(String) : [];
            const description = typeof server.description === "string" ? server.description : "";

            if (["bash", "sh", "cmd", "powershell", "exec", "run", "npx"].includes(command)) {
                permissions.push("shell");
                riskScore += 30;
                reasons.push(`Shell command: ${command}`);
            }

            if (args.some((a) => /\$\{|`|exec|eval|curl|wget|rm|chmod|sudo/i.test(a))) {
                permissions.push("shell");
                riskScore += 25;
                reasons.push("Suspicious arguments detected");
            }

            const env = (server.env ?? {}) as Record<string, string>;
            for (const key of Object.keys(env)) {
                envKeys.push(key);
                if (/key|secret|token|password|credential/i.test(key)) {
                    permissions.push("credential_access");
                    riskScore += 20;
                    reasons.push(`Secret env key: ${key}`);
                }
            }

            const toolNames = args.join(" ").toLowerCase();
            for (const [category, keywords] of Object.entries(TOOL_CLASSIFICATIONS)) {
                if (keywords.some((kw) => toolNames.includes(kw) || command.includes(kw))) {
                    if (!permissions.includes(category)) permissions.push(category);
                    if (["filesystem", "shell", "network"].includes(category)) riskScore += 10;
                }
            }

            if (INJECTION_PATTERNS.some((p) => p.test(description))) {
                riskScore += 40;
                reasons.push("Prompt injection detected in tool description");
            }

            if (permissions.includes("shell") && permissions.includes("filesystem")) {
                riskScore += 15;
                reasons.push("Combined shell + filesystem access");
            }

            const level: MCPToolEntry["level"] = riskScore >= 60 ? "critical" : riskScore >= 40 ? "high" : riskScore >= 20 ? "medium" : "low";

            this.tools.push({ name, serverName: name, configPath, permissions, riskScore, level, reasons, envKeys, blocked: this.blockedTools.has(name) });
        }
    }
}

export function registerMCPFirewallCommands(context: vscode.ExtensionContext, firewall: MCPFirewall): void {
    const reg = (id: string, handler: (...args: any[]) => any) => context.subscriptions.push(vscode.commands.registerCommand(id, handler));

    reg("soterai.openMCPToolFirewall", async () => {
        const tools = await firewall.scanConfigs();
        const rows = tools.map((t) => {
            const riskClass = t.level === "critical" || t.level === "high" ? "block" : t.level === "medium" ? "warn" : "allow";
            const denyCell = t.blocked
                ? `<span class="badge block">DENY-LISTED — still in config (drift)</span>`
                : `<span class="badge allow">not deny-listed</span>`;
            return `<tr><td><code>${escapeHtml(t.name)}</code></td><td><code>${escapeHtml(t.configPath)}</code></td><td>${t.permissions.map((p) => `<span class="badge ${escapeHtml(p)}">${escapeHtml(p)}</span>`).join(" ")}</td><td>${escapeHtml(t.envKeys.join(", "))}</td><td><span class="badge ${riskClass}">${escapeHtml(t.level.toUpperCase())} ${t.riskScore}</span></td><td>${denyCell}</td><td>${t.reasons.map((r) => escapeHtml(r)).join("<br>")}</td></tr>`;
        }).join("");

        showInfoWebview("soteraiMCPFirewall", "SoterAI: MCP Tool Firewall",
            `<h1>MCP Tool Firewall</h1><p>${tools.length} tool(s) scanned across MCP configs.</p>
            <p class="note"><strong>${escapeHtml(PROTECTION.MONITORED.label)}:</strong> ${escapeHtml(PROTECTION.MONITORED.meaning)} SoterAI analyzes MCP configs and records your deny-list, but a VS Code extension cannot intercept another MCP client's traffic. Deny-listed tools still present in a config are flagged as drift below.</p>
            <table><tr><th>Tool</th><th>Config</th><th>Permissions</th><th>Secret Env</th><th>Risk</th><th>Deny-list</th><th>Reasons</th></tr>
            ${rows || "<tr><td colspan='7'>No MCP tools found.</td></tr>"}</table>
            <p class="note">Tool descriptions are treated as untrusted (possible prompt injection). Secret env var names shown; values never read.</p>`
        );
    });

    reg("soterai.generateSafeMCPPolicyFile", () => {
        const policy = firewall.generateSafePolicy();
        const doc = vscode.workspace.openTextDocument({ content: JSON.stringify(policy, null, 2), language: "json" });
        doc.then((d) => vscode.window.showTextDocument(d));
        vscode.window.showInformationMessage("Safe MCP policy generated.");
    });

    reg("soterai.blockMCPTool", async () => {
        const tools = await firewall.scanConfigs();
        const pick = await vscode.window.showQuickPick(
            tools.map((t) => ({ label: t.name, detail: `${t.level} - ${t.reasons[0] ?? "No reasons"}`, name: t.name })),
            { title: "Deny-list MCP Tool (advisory)", placeHolder: "Select a tool to deny-list" }
        );
        if (pick) {
            await firewall.blockTool(pick.name);
            const action = await vscode.window.showWarningMessage(
                `MCP tool "${pick.name}" added to SoterAI's deny-list. ` + advisoryNotice("The MCP deny-list") +
                " To actually stop the tool, remove it from the MCP config.",
                "Open MCP Config",
            );
            if (action === "Open MCP Config") {
                const tool = tools.find((t) => t.name === pick.name);
                const folder = firstWorkspaceFolder();
                if (tool && folder) {
                    try {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, tool.configPath));
                        await vscode.window.showTextDocument(doc);
                    } catch { /* config no longer present */ }
                }
            }
        }
    });

    reg("soterai.approveMCPTool", async () => {
        const tools = await firewall.scanConfigs();
        const blocked = tools.filter((t) => firewall.isToolBlocked(t.name));
        if (blocked.length === 0) return vscode.window.showInformationMessage("No deny-listed MCP tools.");
        const pick = await vscode.window.showQuickPick(
            blocked.map((t) => ({ label: t.name, detail: t.level, name: t.name })),
            { title: "Remove MCP Tool From Deny-list", placeHolder: "Select a deny-listed tool to approve" }
        );
        if (pick) {
            await firewall.approveTool(pick.name);
            vscode.window.showInformationMessage(`MCP tool "${pick.name}" removed from SoterAI's deny-list.`);
        }
    });
}
