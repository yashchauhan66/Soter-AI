import type { DetectorMatch, DetectorResult } from "../types";

export const MCP_CONFIG_RISK_DETECTOR_VERSION = "1.0.0";

const MCP_PATTERNS = [
    { pattern: /\b(?:mcpServers?|mcp_config|mcp_server)\s*[:{=]/gi, type: "mcp_config", label: "MCP server config", score: 15, confidence: 0.8, message: "MCP server configuration detected." },
    { pattern: /\b(?:stdio|sse|streamableHttp)\s*[":]/gi, type: "mcp_transport", label: "MCP transport", score: 10, confidence: 0.7, message: "MCP transport configuration." },
    { pattern: /\b(?:command|args)\s*[":]\s*.*(?:npx|node|python|uvx)\b/gi, type: "mcp_command_exec", label: "MCP command execution", score: 25, confidence: 0.85, message: "MCP server spawns external process." },
    { pattern: /\b(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|api[_-]?key)\s*[":=]/gi, type: "mcp_api_key", label: "MCP API key", score: 30, confidence: 0.9, message: "API key in MCP configuration." },
    { pattern: /\b(?:env|environment)\s*[":]\s*\{[^}]*(?:KEY|SECRET|TOKEN|PASSWORD)/gi, type: "mcp_env_secret", label: "MCP env secret", score: 30, confidence: 0.85, message: "Secret in MCP environment config." },
    { pattern: /\b(?:url|endpoint|baseUrl)\s*[":]\s*["']?https?:\/\/(?!localhost|127\.0\.0\.1)/gi, type: "mcp_remote_url", label: "MCP remote URL", score: 20, confidence: 0.75, message: "MCP connects to remote server." },
];

export function detectMCPConfigRisk(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];
    for (const spec of MCP_PATTERNS) {
        spec.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = spec.pattern.exec(text)) !== null) {
            if (!m[0]) continue;
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
