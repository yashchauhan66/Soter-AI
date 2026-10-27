"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateExtensionIsolation = evaluateExtensionIsolation;
const DANGEROUS_CAPABILITIES = ["workspace", "filesystem", "terminal", "network", "mcp", "debug", "scm"];
function evaluateExtensionIsolation(request) {
    const allowlist = new Set((request.allowlist ?? []).map((id) => id.toLowerCase()));
    const blocklist = new Set((request.blocklist ?? []).map((id) => id.toLowerCase()));
    const trustedPublishers = new Set((request.trustedPublishers ?? []).map((id) => id.toLowerCase()));
    const protectionMode = request.protectionMode ?? "standard";
    const findings = request.extensions.map((extension) => evaluateOne(extension, allowlist, blocklist, trustedPublishers, request.workspaceTrusted !== false, protectionMode));
    const riskScore = findings.reduce((max, finding) => Math.max(max, finding.riskScore), 0);
    const blocks = findings.filter((finding) => finding.action === "BLOCK");
    const isolates = findings.filter((finding) => finding.action === "ISOLATE");
    const action = blocks.length || (protectionMode !== "standard" && isolates.length) ? "DENY" : isolates.length ? "ASK" : "ALLOW";
    return {
        action,
        deterministic: true,
        coverageLevel: "PARTIAL_VISIBILITY",
        riskScore,
        findings,
        allowlist: [...allowlist],
        blocklist: [...new Set([...blocklist, ...blocks.map((finding) => finding.id.toLowerCase())])],
        workspaceRecommendations: buildRecommendations(findings),
        explanation: "VS Code extensions share host authority; SoterAI can recommend isolation/allowlisting but cannot guarantee third-party runtime behavior without enterprise extension controls.",
    };
}
function evaluateOne(extension, allowlist, blocklist, trustedPublishers, workspaceTrusted, protectionMode) {
    const id = extension.id.toLowerCase();
    const categories = [];
    const reasonCodes = [];
    let riskScore = 0;
    const add = (score, category, reason) => {
        riskScore = Math.min(100, riskScore + score);
        if (!categories.includes(category))
            categories.push(category);
        if (!reasonCodes.includes(reason))
            reasonCodes.push(reason);
    };
    if (blocklist.has(id))
        add(100, "explicitly_blocked", "BLOCKLISTED_EXTENSION");
    const capabilityText = `${extension.capabilities?.join(" ") ?? ""} ${extension.activationEvents?.join(" ") ?? ""}`.toLowerCase();
    const aiLike = extension.aiLike ?? /\b(ai|copilot|claude|cursor|codeium|continue|tabnine|agent)\b/i.test(`${extension.id} ${extension.displayName ?? ""}`);
    if (aiLike)
        add(25, "ai_extension", "AI_EXTENSION");
    for (const capability of DANGEROUS_CAPABILITIES) {
        if (capabilityText.includes(capability))
            add(12, `${capability}_authority`, `CAPABILITY_${capability.toUpperCase()}`);
    }
    if (!extension.verifiedPublisher && !trustedPublishers.has((extension.publisher ?? "").toLowerCase()))
        add(25, "unverified_publisher", "UNVERIFIED_PUBLISHER");
    if (!workspaceTrusted)
        add(15, "untrusted_workspace", "UNTRUSTED_WORKSPACE");
    if (!allowlist.has(id) && riskScore >= 45)
        add(20, "not_allowlisted", "NOT_ENTERPRISE_ALLOWLISTED");
    const action = riskScore >= 85 || (protectionMode !== "standard" && riskScore >= 60) ? "BLOCK" : riskScore >= 45 ? "ISOLATE" : "ALLOW";
    return {
        id: extension.id,
        action,
        riskScore,
        categories,
        reasonCodes,
        recommendation: action === "ALLOW"
            ? "Allow in this workspace."
            : action === "ISOLATE"
                ? "Disable for this workspace unless it is explicitly approved and routed through SoterAI controls."
                : "Block or disable this extension for the workspace before using sensitive AI context.",
    };
}
function buildRecommendations(findings) {
    const risky = findings.filter((finding) => finding.action !== "ALLOW");
    if (!risky.length)
        return ["No high-risk third-party extension isolation action required."];
    return [
        "Enable enterprise extension allowlisting for sensitive workspaces.",
        "Disable non-allowlisted AI/agent extensions in workspaces containing secrets or regulated data.",
        "Route AI provider access through the SoterAI broker so requests and responses are scanned.",
    ];
}
//# sourceMappingURL=ExtensionIsolationPolicy.js.map