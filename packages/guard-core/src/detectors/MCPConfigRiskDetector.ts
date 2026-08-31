import type { DetectorMatch, DetectorResult } from "../types";

export const MCP_CONFIG_RISK_DETECTOR_VERSION = "1.1.0";

const MCP_PATTERNS = [
    { pattern: /["']?(?:mcpServers?|mcp_config|mcp_server)["']?\s*[:{=]/gi, type: "mcp_config", label: "MCP server config", score: 15, confidence: 0.8, message: "MCP server configuration detected." },
    { pattern: /["']?(?:stdio|sse|streamableHttp)["']?\s*:/gi, type: "mcp_transport", label: "MCP transport", score: 10, confidence: 0.7, message: "MCP transport configuration." },
    { pattern: /["']?(?:command|args)["']?\s*:\s*(?:\[[^\]]{0,200})?["']?(?:npx|node|python|uvx|bash|sh|zsh|cmd|powershell|pwsh)\b/gi, type: "mcp_command_exec", label: "MCP command execution", score: 25, confidence: 0.85, message: "MCP server spawns an external process." },
    { pattern: /["']?(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|api[_-]?key)["']?\s*[:=]/gi, type: "mcp_api_key", label: "MCP API key", score: 30, confidence: 0.9, message: "API key in MCP configuration." },
    { pattern: /["']?(?:env|environment)["']?\s*:\s*\{[^}]*(?:KEY|SECRET|TOKEN|PASSWORD)/gi, type: "mcp_env_secret", label: "MCP env secret", score: 30, confidence: 0.85, message: "Secret in MCP environment config." },
    { pattern: /["']?(?:url|endpoint|baseUrl)["']?\s*:\s*["']?https?:\/\/(?!localhost|127\.0\.0\.1)/gi, type: "mcp_remote_url", label: "MCP remote URL", score: 20, confidence: 0.75, message: "MCP connects to remote server." },
];

const PLACEHOLDER_VALUE = /^(?:your[-_ ]?(?:api[-_ ]?)?key(?:[-_ ]?here)?|replace[-_ ]?me|example|placeholder|changeme|<[^>]+>|\$\{[^}]+\})$/i;

function isPlaceholderCredential(text: string, matchEnd: number): boolean {
    const remainder = text.slice(matchEnd).match(/^\s*["']?([^\s,"'};]+)["']?/);
    return Boolean(remainder?.[1] && PLACEHOLDER_VALUE.test(remainder[1]));
}

export function detectMCPConfigRisk(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];
    for (const spec of MCP_PATTERNS) {
        spec.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = spec.pattern.exec(text)) !== null) {
            if (!m[0]) continue;
            if (spec.type === "mcp_api_key" && isPlaceholderCredential(text, m.index + m[0].length)) continue;
            matches.push({
                type: spec.type, label: spec.label,
                severity: spec.score >= 25 ? "high" : "medium",
                score: spec.score, start: m.index, end: m.index + m[0].length,
                match: m[0], message: spec.message, confidence: spec.confidence,
            });
        }
    }
    return { detectorName: "MCPConfigRiskDetector", detectorVersion: MCP_CONFIG_RISK_DETECTOR_VERSION, matches };
}
