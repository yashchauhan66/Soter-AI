"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessTaint = assessTaint;
exports.evaluateTaintedAction = evaluateTaintedAction;
const RuntimePolicyEngine_1 = require("./RuntimePolicyEngine");
function assessTaint(sources) {
    const labels = [...new Set(sources.flatMap((source) => source.labels))];
    const sourceIds = sources.filter((source) => source.trust !== "trusted").map((source) => source.id);
    let riskScore = 0;
    for (const source of sources) {
        if (source.trust === "untrusted" || source.trust === "external" || source.trust === "mcp_output" || source.trust === "terminal_output")
            riskScore += 25;
        if (source.labels.includes("prompt_injection"))
            riskScore += 45;
        if (source.labels.includes("secret_source"))
            riskScore += 35;
        if (source.labels.includes("production_source"))
            riskScore += 30;
        if (source.labels.includes("encoded_content"))
            riskScore += 20;
    }
    riskScore = Math.min(100, riskScore);
    return {
        tainted: riskScore >= 25,
        riskScore,
        labels,
        sources: sourceIds,
        explanation: labels.length ? `Action influenced by ${labels.join(", ")} from ${sourceIds.join(", ") || "trusted sources"}.` : "No tainted source influence detected.",
    };
}
function evaluateTaintedAction(request) {
    const assessment = assessTaint(request.sources);
    const highRiskAction = request.actionType === "terminal_command" || request.actionType === "network_request" || request.actionType === "mcp_tool_call";
    const riskScore = Math.max(request.riskScore ?? 0, highRiskAction && assessment.tainted ? Math.max(assessment.riskScore, 65) : assessment.riskScore);
    const policy = new RuntimePolicyEngine_1.RuntimePolicyEngine().evaluate({
        actionType: request.actionType,
        protectionMode: request.protectionMode ?? "standard",
        coverageLevel: request.coverageLevel ?? "STRONG_ENFORCEMENT",
        riskScore,
        categories: assessment.labels,
        parserStatus: "parsed",
        reversible: false,
        taintedByPromptInjection: assessment.labels.includes("prompt_injection") || assessment.labels.includes("untrusted_instruction"),
        productionContext: assessment.labels.includes("production_source"),
    });
    const reasonCodes = [...policy.reasonCodes];
    if (assessment.tainted)
        reasonCodes.unshift("TAINTED_SOURCE_INFLUENCE");
    return {
        action: policy.action,
        riskScore,
        reasonCodes: [...new Set(reasonCodes)],
        coverageLevel: request.coverageLevel ?? "STRONG_ENFORCEMENT",
        assessment,
        deterministic: true,
    };
}
//# sourceMappingURL=TaintEngine.js.map