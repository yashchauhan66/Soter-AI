import { analyzeMCPConfig, type MCPPermission, type MCPServerAssessment } from "./MCPPolicyAnalyzer";
import { RuntimePolicyEngine, type EnforcementAction, type ProtectionMode } from "./RuntimePolicyEngine";
import { containsRawSecret, redactForSharing } from "./Redactor";
import { assessTaint, type TaintedSource } from "./TaintEngine";

export interface MCPGatewayRequest {
    mcpConfig?: string | Record<string, unknown>;
    serverName: string;
    toolName: string;
    args: Record<string, unknown>;
    protectionMode?: ProtectionMode;
    allowedPermissions?: MCPPermission[];
    taintedSources?: TaintedSource[];
}

export interface MCPGatewayDecision {
    action: EnforcementAction;
    riskScore: number;
    coverageLevel: "STRONG_ENFORCEMENT";
    server?: MCPServerAssessment;
    reasonCodes: string[];
    categories: string[];
    redactedArgsPreview: string;
    explanation: string;
    deterministic: true;
}

export function evaluateMCPToolInvocation(request: MCPGatewayRequest): MCPGatewayDecision {
    const analysis = request.mcpConfig ? analyzeMCPConfig(request.mcpConfig) : undefined;
    const server = analysis?.servers.find((item) => item.name === request.serverName);
    const categories: string[] = [];
    const reasonCodes: string[] = [];
    let riskScore = server?.riskScore ?? 50;

    if (!server) {
        riskScore = Math.max(riskScore, 70);
        categories.push("unknown_mcp_server");
        reasonCodes.push("UNKNOWN_MCP_SERVER");
    } else {
        categories.push(...server.permissions);
        if (server.level === "critical" || server.level === "high") reasonCodes.push("HIGH_RISK_MCP_SERVER");
        const allowed = new Set(request.allowedPermissions ?? []);
        const disallowed = server.permissions.filter((permission) => !allowed.has(permission));
        if (disallowed.length) {
            riskScore = Math.max(riskScore, 75);
            reasonCodes.push("MCP_PERMISSION_NOT_ALLOWED");
        }
        if (server.promptInjectionHints.length) {
            riskScore = Math.max(riskScore, 90);
            categories.push("prompt_injection");
            reasonCodes.push("MCP_PROMPT_INJECTION");
        }
    }

    const serializedArgs = safeStringify(request.args);
    if (containsRawSecret(serializedArgs)) {
        riskScore = Math.max(riskScore, 95);
        categories.push("secret_egress");
        reasonCodes.push("MCP_ARGS_CONTAIN_SECRET");
    }

    const taint = assessTaint(request.taintedSources ?? []);
    if (taint.tainted) {
        riskScore = Math.max(riskScore, taint.riskScore, 70);
        categories.push(...taint.labels);
        reasonCodes.push("TAINTED_MCP_INVOCATION");
    }

    const policy = new RuntimePolicyEngine().evaluate({
        actionType: "mcp_tool_call",
        protectionMode: request.protectionMode ?? "standard",
        coverageLevel: "STRONG_ENFORCEMENT",
        riskScore,
        categories,
        parserStatus: "parsed",
        reversible: false,
        rawCredentialExposure: containsRawSecret(serializedArgs),
        containsSecrets: containsRawSecret(serializedArgs),
        taintedByPromptInjection: taint.labels.includes("prompt_injection") || categories.includes("prompt_injection"),
    });

    let action = policy.action;
    if (reasonCodes.includes("UNKNOWN_MCP_SERVER") || reasonCodes.includes("MCP_ARGS_CONTAIN_SECRET") || reasonCodes.includes("MCP_PROMPT_INJECTION")) action = "DENY";

    return {
        action,
        riskScore,
        coverageLevel: "STRONG_ENFORCEMENT",
        server,
        reasonCodes: [...new Set([...reasonCodes, ...policy.reasonCodes])],
        categories: [...new Set(categories)],
        redactedArgsPreview: redactForSharing(serializedArgs).slice(0, 500),
        explanation: [reasonCodes.length ? `MCP gateway reasons: ${reasonCodes.join(", ")}.` : "", policy.explanation].filter(Boolean).join(" "),
        deterministic: true,
    };
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return "[unserializable]";
    }
}
