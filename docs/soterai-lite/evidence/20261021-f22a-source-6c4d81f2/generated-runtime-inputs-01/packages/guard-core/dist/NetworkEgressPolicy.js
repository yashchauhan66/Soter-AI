"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateNetworkEgress = evaluateNetworkEgress;
const RuntimePolicyEngine_1 = require("./RuntimePolicyEngine");
const Redactor_1 = require("./Redactor");
function evaluateNetworkEgress(request) {
    const parsed = parseUrl(request.url);
    const method = (request.method ?? "GET").toUpperCase();
    const categories = [];
    const reasonCodes = [];
    let riskScore = method === "GET" ? 10 : 35;
    let destinationTrust = "unknown";
    if (!parsed) {
        riskScore = 80;
        categories.push("invalid_url");
        reasonCodes.push("INVALID_URL");
        destinationTrust = "untrusted";
    }
    else {
        destinationTrust = classifyDestination(parsed.hostname, request.allowedHosts ?? []);
        if (destinationTrust === "approved")
            riskScore = Math.max(riskScore, 5);
        if (destinationTrust === "unknown")
            reasonCodes.push("UNKNOWN_DESTINATION");
        if (destinationTrust === "private_network") {
            riskScore = Math.max(riskScore, 85);
            categories.push("private_network");
            reasonCodes.push("PRIVATE_NETWORK_DESTINATION");
        }
        if (destinationTrust === "cloud_metadata") {
            riskScore = Math.max(riskScore, 95);
            categories.push("cloud_metadata");
            reasonCodes.push("CLOUD_METADATA_DESTINATION");
        }
        if (parsed.protocol !== "https:") {
            riskScore = Math.max(riskScore, 55);
            categories.push("plaintext_network");
            reasonCodes.push("NON_HTTPS_DESTINATION");
        }
    }
    const redirectDecision = analyzeRedirects(request.redirectChain ?? [], request.allowedHosts ?? []);
    if (redirectDecision.reasonCodes.length) {
        riskScore = Math.max(riskScore, redirectDecision.riskScore);
        categories.push(...redirectDecision.categories);
        reasonCodes.push(...redirectDecision.reasonCodes);
        if (redirectDecision.destinationTrust === "private_network" || redirectDecision.destinationTrust === "cloud_metadata")
            destinationTrust = redirectDecision.destinationTrust;
    }
    if (request.payloadPreview && (0, Redactor_1.containsRawSecret)(request.payloadPreview)) {
        riskScore = Math.max(riskScore, 95);
        categories.push("secret_egress");
        reasonCodes.push("SECRET_PAYLOAD_EGRESS");
    }
    if (request.sourceClassifications?.some((item) => /confidential|customer|production|secret|pii/i.test(item))) {
        riskScore = Math.max(riskScore, method === "GET" ? 45 : 75);
        categories.push("sensitive_source");
        reasonCodes.push("SENSITIVE_SOURCE_EGRESS");
    }
    if (method !== "GET" && method !== "HEAD" && destinationTrust !== "approved") {
        riskScore = Math.max(riskScore, 70);
        categories.push("external_write");
        reasonCodes.push("UNKNOWN_EXTERNAL_WRITE");
    }
    const policy = new RuntimePolicyEngine_1.RuntimePolicyEngine().evaluate({
        actionType: "network_request",
        protectionMode: request.protectionMode ?? "standard",
        coverageLevel: request.coverageLevel ?? "STRONG_ENFORCEMENT",
        destinationTrust,
        riskScore,
        categories,
        parserStatus: parsed ? "parsed" : "failed_suspicious",
        reversible: false,
        rawCredentialExposure: Boolean(request.payloadPreview && (0, Redactor_1.containsRawSecret)(request.payloadPreview)),
        containsSecrets: Boolean(request.payloadPreview && (0, Redactor_1.containsRawSecret)(request.payloadPreview)),
    });
    let action = policy.action;
    if (destinationTrust === "private_network" || destinationTrust === "cloud_metadata" || reasonCodes.includes("SECRET_PAYLOAD_EGRESS"))
        action = "DENY";
    return {
        action,
        riskScore,
        coverageLevel: request.coverageLevel ?? "STRONG_ENFORCEMENT",
        destinationTrust,
        normalizedUrl: parsed ? safeUrl(parsed) : undefined,
        host: parsed?.hostname,
        reasonCodes: [...new Set([...reasonCodes, ...policy.reasonCodes])],
        categories: [...new Set(categories)],
        redactedPayloadPreview: request.payloadPreview ? (0, Redactor_1.redactForSharing)(request.payloadPreview).slice(0, 200) : undefined,
        explanation: [reasonCodes.length ? `Network reasons: ${reasonCodes.join(", ")}.` : "", policy.explanation].filter(Boolean).join(" "),
        deterministic: true,
    };
}
function parseUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function classifyDestination(hostname, allowedHosts) {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "169.254.169.254" || host === "metadata.google.internal" || host === "metadata.azure.internal")
        return "cloud_metadata";
    if (isPrivateOrLocal(host))
        return "private_network";
    if (allowedHosts.some((allowed) => host === allowed.toLowerCase() || host.endsWith(`.${allowed.toLowerCase()}`)))
        return "approved";
    return "unknown";
}
function isPrivateOrLocal(host) {
    if (host === "localhost" || host.endsWith(".localhost"))
        return true;
    if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd"))
        return true;
    const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!m)
        return false;
    const [a, b] = m.slice(1).map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
function safeUrl(parsed) {
    parsed.username = parsed.username ? "[redacted]" : "";
    parsed.password = parsed.password ? "[redacted]" : "";
    for (const key of [...parsed.searchParams.keys()]) {
        if (/key|token|secret|password|credential/i.test(key))
            parsed.searchParams.set(key, "[redacted]");
    }
    return parsed.toString();
}
function analyzeRedirects(chain, allowedHosts) {
    const result = { riskScore: 0, categories: [], reasonCodes: [], destinationTrust: undefined };
    for (const url of chain) {
        const parsed = parseUrl(url);
        if (!parsed) {
            result.riskScore = Math.max(result.riskScore, 80);
            result.categories.push("invalid_redirect");
            result.reasonCodes.push("INVALID_REDIRECT_URL");
            continue;
        }
        const trust = classifyDestination(parsed.hostname, allowedHosts);
        if (trust === "private_network" || trust === "cloud_metadata") {
            result.riskScore = Math.max(result.riskScore, 90);
            result.categories.push("dangerous_redirect");
            result.reasonCodes.push(trust === "cloud_metadata" ? "REDIRECT_TO_CLOUD_METADATA" : "REDIRECT_TO_PRIVATE_NETWORK");
            result.destinationTrust = trust;
        }
    }
    return result;
}
//# sourceMappingURL=NetworkEgressPolicy.js.map