import type { PrivateVaultPlan } from "../firewall/VaultMigrationPlan";
import { configSyntaxUnavailable as fail, createJsoncSecretPlan, createStaticConfigSecretPlan } from "./JsoncSecretPlan";
import { parseMcpToml } from "./McpTomlSyntax";

export type McpFormat = "mcp-jsonc" | "mcp-toml";
const caseGlob = (name: string) => name.replace(/[a-z]/gi, char => "[" + char.toLowerCase() + char.toUpperCase() + "]");
export const MCP_WORKSPACE_GLOBS = Object.freeze([
    "**/{" + [".mcp.json", "mcp.json", "mcp_config.json", "cline_mcp_settings.json", "claude_desktop_config.json"].map(caseGlob).join(",") + "}",
    "**/" + caseGlob(".gemini/settings.json"),
    "**/" + caseGlob(".claude/") + "{" + ["settings.json", "settings.local.json"].map(caseGlob).join(",") + "}",
    "**/{" + ["mcp.toml", ".mcp.toml"].map(caseGlob).join(",") + "}",
    "**/" + caseGlob(".codex/config.toml"),
]);
export function mcpFormatForPath(relative: string): McpFormat | undefined {
    if (typeof relative !== "string" || !relative || relative.length > 2048 || /[\\:\x00-\x1f\x7f]/.test(relative) || relative.startsWith("/") || relative.split("/").some(part => !part || part === "." || part === "..")) return fail();
    if (/(?:^|\/)(?:\.mcp|mcp|mcp_config|cline_mcp_settings|claude_desktop_config)\.json$/i.test(relative) || /(?:^|\/)(?:\.gemini\/settings|\.claude\/settings(?:\.local)?)\.json$/i.test(relative)) return "mcp-jsonc";
    if (/(?:^|\/)(?:\.?mcp\.toml|\.codex\/config\.toml)$/i.test(relative)) return "mcp-toml";
    return undefined;
}
/** Private parse-only plan; explicit encrypted whole-file checkpoint recovery. */
export function createMcpSecretPlan(text: string, format: McpFormat, generation: string): PrivateVaultPlan {
    if (format === "mcp-jsonc") return createJsoncSecretPlan(text, generation, "mcp");
    if (format === "mcp-toml") return createStaticConfigSecretPlan(text, generation, "mcp", parseMcpToml);
    return fail();
}
