export declare const MCP_POLICY_ANALYZER_VERSION = "1.1.0";
export type MCPPermission = "filesystem" | "shell" | "network" | "database" | "env_secrets" | "broad_root" | "remote_endpoint" | "command_runner";
export type MCPRiskLevel = "info" | "low" | "medium" | "high" | "critical";
export interface MCPServerAssessment {
    name: string;
    /** stdio command + args, or a remote url — redacted for display. */
    transport: string;
    command?: string;
    permissions: MCPPermission[];
    /** env var *names* only — values are never surfaced. */
    envKeys: string[];
    /** env var names that look like secrets. */
    secretEnvKeys: string[];
    riskScore: number;
    level: MCPRiskLevel;
    reasons: string[];
    /** Tool/description text flagged for possible prompt injection. */
    promptInjectionHints: string[];
}
export interface MCPAnalysis {
    analyzerVersion: string;
    detectorVersion: string;
    serverCount: number;
    highRisk: number;
    servers: MCPServerAssessment[];
    /** Parse-level problems (malformed config, etc.). */
    parseError?: string;
}
/**
 * Analyze an MCP configuration object or JSON string. Accepts the common shapes:
 *   { mcpServers: { name: {...} } }  (Claude / Cursor / Windsurf)
 *   { servers: { name: {...} } }     (VS Code mcp.json)
 */
export declare function analyzeMCPConfig(input: string | Record<string, unknown>): MCPAnalysis;
/**
 * Produce a hardened MCP policy recommendation from an analysis: least-privilege
 * guidance per server. Returns a plain object safe to serialize (no secret values).
 */
export declare function generateSafeMCPPolicy(analysis: MCPAnalysis): {
    version: number;
    generatedFrom: string;
    principles: string[];
    servers: Array<{
        name: string;
        allow: MCPPermission[];
        review: string[];
        requireApproval: boolean;
    }>;
};
//# sourceMappingURL=MCPPolicyAnalyzer.d.ts.map