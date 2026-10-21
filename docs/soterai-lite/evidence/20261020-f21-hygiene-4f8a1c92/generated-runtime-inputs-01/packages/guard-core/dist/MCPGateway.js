"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateMCPToolInvocation = evaluateMCPToolInvocation;
const MCPPolicyAnalyzer_1 = require("./MCPPolicyAnalyzer");
const RuntimePolicyEngine_1 = require("./RuntimePolicyEngine");
const Redactor_1 = require("./Redactor");
const ContextRedactor_1 = require("./ContextRedactor");
const EncodedSecretDetector_1 = require("./detectors/EncodedSecretDetector");
const TaintEngine_1 = require("./TaintEngine");
/** Stateless: `RuntimePolicyEngine` holds no per-request state, so one shared instance is safe. */
const POLICY_ENGINE = new RuntimePolicyEngine_1.RuntimePolicyEngine();
function evaluateMCPToolInvocation(request) {
    const coverageLevel = request.callerEnforcesPreExecution ? "STRONG_ENFORCEMENT" : "DETECTION_ONLY";
    const analysis = request.mcpConfig ? (0, MCPPolicyAnalyzer_1.analyzeMCPConfig)(request.mcpConfig) : undefined;
    const server = analysis?.servers.find((item) => item.name === request.serverName);
    const categories = [];
    const reasonCodes = [];
    let riskScore = server?.riskScore ?? 50;
    if (!server) {
        riskScore = Math.max(riskScore, 70);
        categories.push("unknown_mcp_server");
        reasonCodes.push("UNKNOWN_MCP_SERVER");
    }
    else {
        categories.push(...server.permissions);
        if (server.level === "critical" || server.level === "high")
            reasonCodes.push("HIGH_RISK_MCP_SERVER");
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
    // `containsRawSecret` walks ~29 high-risk secret patterns over the whole
    // serialized argument blob. The patterns are stateless (no /g), so the scan
    // is evaluated exactly once and the boolean is reused by every consumer
    // below — previously the identical scan ran three times per invocation.
    const hasRawSecret = (0, Redactor_1.containsRawSecret)(serializedArgs) || (0, EncodedSecretDetector_1.detectEncodedSecrets)(serializedArgs).matches.length > 0;
    if (hasRawSecret) {
        riskScore = Math.max(riskScore, 95);
        categories.push("secret_egress");
        reasonCodes.push("MCP_ARGS_CONTAIN_SECRET");
    }
    const taint = (0, TaintEngine_1.assessTaint)(request.taintedSources ?? []);
    if (taint.tainted) {
        riskScore = Math.max(riskScore, taint.riskScore, 70);
        categories.push(...taint.labels);
        reasonCodes.push("TAINTED_MCP_INVOCATION");
    }
    const policy = POLICY_ENGINE.evaluate({
        actionType: "mcp_tool_call",
        protectionMode: request.protectionMode ?? "standard",
        coverageLevel,
        riskScore,
        categories,
        parserStatus: "parsed",
        reversible: false,
        rawCredentialExposure: hasRawSecret,
        containsSecrets: hasRawSecret,
        taintedByPromptInjection: taint.labels.includes("prompt_injection") || categories.includes("prompt_injection"),
    });
    let action = policy.action;
    if (reasonCodes.includes("UNKNOWN_MCP_SERVER") || reasonCodes.includes("MCP_ARGS_CONTAIN_SECRET") || reasonCodes.includes("MCP_PROMPT_INJECTION"))
        action = "DENY";
    // The preview is a lazy memoized getter: `redactForSharing` applies ~45
    // ordered redaction rules plus a surviving-secret sweep over the full
    // argument blob, which is pure waste on the common ALLOW path where no
    // consumer ever reads it. Every consumer that DOES read it (approval
    // records, persisted evidence, the VS Code preview) receives a bit-for-bit
    // identical string, computed at most once per decision.
    let previewCache;
    return {
        action,
        riskScore,
        coverageLevel,
        server,
        reasonCodes: [...new Set([...reasonCodes, ...policy.reasonCodes])],
        categories: [...new Set(categories)],
        get redactedArgsPreview() {
            if (previewCache === undefined)
                previewCache = (0, ContextRedactor_1.redactAIContext)(serializedArgs).slice(0, 500);
            return previewCache;
        },
        explanation: [reasonCodes.length ? `MCP gateway reasons: ${reasonCodes.join(", ")}.` : "", policy.explanation].filter(Boolean).join(" "),
        deterministic: true,
    };
}
function safeStringify(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return "[unserializable]";
    }
}
//# sourceMappingURL=MCPGateway.js.map