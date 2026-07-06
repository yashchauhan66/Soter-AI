// ─── MCP / Tool Permission Monitor (Phase 9) ─────────────────────────────────
//
// LLMs increasingly use MCP (Model Context Protocol) servers and tools to reach
// the filesystem, shell, network, and databases. This analyzer parses an MCP
// configuration and produces a permission table + risk assessment, and can
// generate a hardened "safe" policy. It reasons over declared config only — it
// does not execute anything.

import { detectMCPConfigRisk, MCP_CONFIG_RISK_DETECTOR_VERSION } from "./detectors";

export const MCP_POLICY_ANALYZER_VERSION = "1.0.0";

export type MCPPermission =
    | "filesystem"
    | "shell"
    | "network"
    | "database"
    | "env_secrets"
    | "broad_root"
    | "remote_endpoint"
    | "command_runner";

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

const SECRET_KEY_RE = /(KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|DATABASE_URL|DSN|CONNECTION)/i;
const COMMAND_RUNNERS = ["npx", "uvx", "uv", "pipx", "bunx", "node", "python", "python3", "deno", "sh", "bash", "cmd", "powershell"];
const FS_ARG_HINT = /(filesystem|--root|--dir|--path|\/|[a-z]:\\)/i;
const SHELL_HINT = /(shell|exec|terminal|command|bash|sh\b|run-?command)/i;
const DB_HINT = /(postgres|mysql|mongo|sqlite|redis|database|db-|prisma|jdbc|dsn)/i;
const NET_HINT = /(fetch|http|browser|puppeteer|playwright|scrape|url|api)/i;
// Prompt-injection-ish phrasing sometimes smuggled into tool descriptions.
const INJECTION_HINT = /(ignore (all |the )?(previous|prior) instructions|system prompt|exfiltrat|send (the )?(secrets?|env|credentials?)|disregard|do not tell|override (the )?policy)/i;

/** Broad/dangerous filesystem roots. */
function isBroadRoot(arg: string): boolean {
    const a = arg.trim().toLowerCase();
    return (
        a === "/" ||
        a === "~" ||
        a === "$home" ||
        /^[a-z]:\\?$/.test(a) ||
        a.endsWith("/users") ||
        a.endsWith("\\users") ||
        a === "/home" ||
        a.includes("..")
    );
}

interface RawServer {
    command?: unknown;
    args?: unknown;
    url?: unknown;
    type?: unknown;
    env?: unknown;
    description?: unknown;
    tools?: unknown;
}

function assessServer(name: string, raw: RawServer): MCPServerAssessment {
    const permissions = new Set<MCPPermission>();
    const reasons: string[] = [];
    const command = typeof raw.command === "string" ? raw.command : undefined;
    const args = Array.isArray(raw.args) ? raw.args.filter((a): a is string => typeof a === "string") : [];
    const url = typeof raw.url === "string" ? raw.url : undefined;
    const blob = [name, command ?? "", ...args, typeof raw.description === "string" ? raw.description : ""].join(" ");

    let score = 0;
    const bump = (perm: MCPPermission, pts: number, why: string) => {
        if (!permissions.has(perm)) reasons.push(why);
        permissions.add(perm);
        score += pts;
    };

    // Transport / command runner.
    if (command) {
        const base = command.split(/[\\/]/).pop()?.toLowerCase() ?? command.toLowerCase();
        if (COMMAND_RUNNERS.includes(base)) bump("command_runner", 20, `Spawns external process via '${base}'`);
        if (SHELL_HINT.test(blob)) bump("shell", 25, "Shell / command execution capability");
    }

    // Remote endpoint.
    if (url) {
        const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url);
        if (!isLocal) bump("remote_endpoint", 20, "Connects to a remote (non-localhost) endpoint");
        bump("network", 10, "Network transport");
    }
    if (NET_HINT.test(blob)) bump("network", 8, "Network / HTTP capability implied");

    // Filesystem.
    if (FS_ARG_HINT.test(blob) || /filesystem/i.test(name)) {
        bump("filesystem", 12, "Filesystem access");
        for (const a of args) {
            if (isBroadRoot(a)) bump("broad_root", 25, `Broad filesystem root: ${a}`);
        }
    }

    // Database.
    if (DB_HINT.test(blob)) bump("database", 18, "Database access");

    // Env / secrets — names only, values never read.
    const envKeys: string[] = [];
    const secretEnvKeys: string[] = [];
    if (raw.env && typeof raw.env === "object") {
        for (const k of Object.keys(raw.env as Record<string, unknown>)) {
            envKeys.push(k);
            if (SECRET_KEY_RE.test(k)) secretEnvKeys.push(k);
        }
        if (secretEnvKeys.length) bump("env_secrets", 22, `Secrets passed via env: ${secretEnvKeys.join(", ")}`);
    }

    // Prompt injection in descriptions / tool metadata.
    const promptInjectionHints: string[] = [];
    const descTexts: string[] = [];
    if (typeof raw.description === "string") descTexts.push(raw.description);
    if (Array.isArray(raw.tools)) {
        for (const t of raw.tools) {
            if (t && typeof t === "object" && typeof (t as { description?: unknown }).description === "string") {
                descTexts.push((t as { description: string }).description);
            }
        }
    }
    for (const d of descTexts) {
        if (INJECTION_HINT.test(d)) {
            promptInjectionHints.push(d.slice(0, 120));
            score += 30;
            reasons.push("Tool/description text contains possible prompt-injection phrasing");
        }
    }

    const riskScore = Math.min(100, score);
    const level: MCPRiskLevel =
        promptInjectionHints.length > 0 || riskScore >= 70
            ? "critical"
            : riskScore >= 45
              ? "high"
              : riskScore >= 25
                ? "medium"
                : riskScore > 0
                  ? "low"
                  : "info";

    const transport = url ? redactUrl(url) : command ? `${command} ${args.join(" ")}`.trim() : "(none)";

    return {
        name,
        transport,
        command,
        permissions: [...permissions],
        envKeys,
        secretEnvKeys,
        riskScore,
        level,
        reasons,
        promptInjectionHints,
    };
}

/** Redact credentials embedded in a URL for safe display. */
function redactUrl(url: string): string {
    return url.replace(/\/\/[^@/]+@/, "//[redacted]@").replace(/([?&](?:key|token|secret|password)=)[^&]+/gi, "$1[redacted]");
}

/**
 * Analyze an MCP configuration object or JSON string. Accepts the common shapes:
 *   { mcpServers: { name: {...} } }  (Claude / Cursor / Windsurf)
 *   { servers: { name: {...} } }     (VS Code mcp.json)
 */
export function analyzeMCPConfig(input: string | Record<string, unknown>): MCPAnalysis {
    let parsed: Record<string, unknown>;
    if (typeof input === "string") {
        try {
            parsed = JSON.parse(input) as Record<string, unknown>;
        } catch (e) {
            // Fall back to text-level detection so a malformed file still yields signal.
            const textResult = detectMCPConfigRisk(input);
            return {
                analyzerVersion: MCP_POLICY_ANALYZER_VERSION,
                detectorVersion: MCP_CONFIG_RISK_DETECTOR_VERSION,
                serverCount: 0,
                highRisk: textResult.matches.some((m) => m.severity === "high") ? 1 : 0,
                servers: [],
                parseError: `Could not parse MCP config as JSON: ${(e as Error).message}`,
            };
        }
    } else {
        parsed = input;
    }

    const serversObj =
        (parsed.mcpServers as Record<string, RawServer> | undefined) ??
        (parsed.servers as Record<string, RawServer> | undefined) ??
        {};

    const servers = Object.entries(serversObj)
        .filter(([, v]) => v && typeof v === "object")
        .map(([name, raw]) => assessServer(name, raw))
        .sort((a, b) => b.riskScore - a.riskScore || a.name.localeCompare(b.name));

    return {
        analyzerVersion: MCP_POLICY_ANALYZER_VERSION,
        detectorVersion: MCP_CONFIG_RISK_DETECTOR_VERSION,
        serverCount: servers.length,
        highRisk: servers.filter((s) => s.level === "high" || s.level === "critical").length,
        servers,
    };
}

/**
 * Produce a hardened MCP policy recommendation from an analysis: least-privilege
 * guidance per server. Returns a plain object safe to serialize (no secret values).
 */
export function generateSafeMCPPolicy(analysis: MCPAnalysis): {
    version: number;
    generatedFrom: string;
    principles: string[];
    servers: Array<{ name: string; allow: MCPPermission[]; review: string[]; requireApproval: boolean }>;
} {
    return {
        version: 1,
        generatedFrom: `mcp-policy-analyzer@${analysis.analyzerVersion}`,
        principles: [
            "Least privilege: grant only the permissions a server actually needs.",
            "No broad filesystem roots (/, ~, drive roots). Scope to the project directory.",
            "Never pass raw secrets via env — reference the SoterAI vault or a secret manager.",
            "Prefer localhost transports; review every remote endpoint.",
            "Treat tool descriptions as untrusted input — they can carry prompt injection.",
        ],
        servers: analysis.servers.map((s) => ({
            name: s.name,
            allow: s.permissions.filter((p) => p !== "broad_root" && p !== "remote_endpoint"),
            review: [
                ...(s.permissions.includes("broad_root") ? ["Remove broad filesystem root; scope to project."] : []),
                ...(s.secretEnvKeys.length ? [`Move secret env keys out of config: ${s.secretEnvKeys.join(", ")}`] : []),
                ...(s.permissions.includes("remote_endpoint") ? ["Confirm and pin the remote endpoint."] : []),
                ...(s.promptInjectionHints.length ? ["Sanitize tool descriptions — possible prompt injection."] : []),
            ],
            requireApproval: s.level === "high" || s.level === "critical",
        })),
    };
}
