"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateFileOperation = evaluateFileOperation;
const ProjectPolicy_1 = require("./ProjectPolicy");
const RuntimePolicyEngine_1 = require("./RuntimePolicyEngine");
const Redactor_1 = require("./Redactor");
const SECURITY_SENSITIVE = [
    ".github/workflows/",
    ".git/hooks/",
    ".vscode/tasks.json",
    ".vscode/launch.json",
    ".soterai/",
    "src/auth/",
    "src/security/",
    "infra/",
    "terraform",
    "dockerfile",
    "package.json",
    "package-lock.json",
];
function evaluateFileOperation(request) {
    const policy = request.projectPolicy ?? ProjectPolicy_1.DEFAULT_PROJECT_POLICY;
    const target = normalizeAbsoluteLike(request.targetPath);
    const root = normalizeAbsoluteLike(request.workspaceRoot);
    const real = request.realPath ? normalizeAbsoluteLike(request.realPath) : undefined;
    const rel = relativeInside(root, target);
    const realRel = real ? relativeInside(root, real) : rel;
    const categories = [];
    const reasonCodes = [];
    let riskScore = 0;
    if (!rel) {
        riskScore = Math.max(riskScore, 80);
        categories.push("outside_workspace");
        reasonCodes.push("PATH_OUTSIDE_WORKSPACE");
    }
    if (real && !realRel) {
        riskScore = Math.max(riskScore, 85);
        categories.push("symlink_escape");
        reasonCodes.push("REALPATH_OUTSIDE_WORKSPACE");
    }
    if (rel?.includes("/.git/") || rel === ".git") {
        riskScore = Math.max(riskScore, 65);
        categories.push("git_metadata");
        reasonCodes.push("GIT_METADATA_ACCESS");
    }
    if (rel && isHiddenPath(rel)) {
        riskScore = Math.max(riskScore, 30);
        categories.push("hidden_file");
        reasonCodes.push("HIDDEN_PATH");
    }
    const classification = rel ? (0, ProjectPolicy_1.classifyPath)(rel, policy) : undefined;
    if (classification?.level === "protected") {
        riskScore = Math.max(riskScore, request.operation === "read" ? 90 : 75);
        categories.push("protected_file");
        reasonCodes.push("PROTECTED_PATH");
    }
    else if (classification?.level === "sensitive") {
        riskScore = Math.max(riskScore, 55);
        categories.push("sensitive_file");
        reasonCodes.push("SENSITIVE_PATH");
    }
    if (rel && SECURITY_SENSITIVE.some((prefix) => rel.toLowerCase().includes(prefix))) {
        riskScore = Math.max(riskScore, 60);
        categories.push("security_sensitive_change");
        reasonCodes.push("SECURITY_SENSITIVE_PATH");
    }
    if (request.operation === "delete" || request.operation === "chmod") {
        riskScore = Math.max(riskScore, 70);
        categories.push("destructive_file_operation");
        reasonCodes.push("DESTRUCTIVE_FILE_OPERATION");
    }
    if (request.operation === "mass_change" || (request.fileCount ?? 0) >= 20) {
        riskScore = Math.max(riskScore, (request.fileCount ?? 0) >= 100 ? 90 : 70);
        categories.push("mass_change");
        reasonCodes.push("MASS_CHANGE");
    }
    if (request.contentPreview && (0, Redactor_1.containsRawSecret)(request.contentPreview)) {
        riskScore = Math.max(riskScore, 90);
        categories.push("raw_secret");
        reasonCodes.push("RAW_SECRET_IN_FILE_OPERATION");
    }
    const reversible = request.operation === "read" ? true : request.operation === "write" || request.operation === "rename" || request.operation === "config_change";
    const policyDecision = new RuntimePolicyEngine_1.RuntimePolicyEngine().evaluate({
        actionType: request.operation === "read" ? "file_read" : "file_write",
        protectionMode: request.protectionMode ?? "standard",
        coverageLevel: request.coverageLevel ?? "STRONG_ENFORCEMENT",
        riskScore,
        categories,
        parserStatus: "parsed",
        reversible,
        productionContext: Boolean(rel && /\b(prod|production|deploy|release)\b/i.test(rel)),
    });
    let action = policyDecision.action;
    if (reasonCodes.includes("PATH_OUTSIDE_WORKSPACE") || reasonCodes.includes("REALPATH_OUTSIDE_WORKSPACE") || reasonCodes.includes("RAW_SECRET_IN_FILE_OPERATION"))
        action = "DENY";
    if ((request.operation === "delete" || request.operation === "mass_change") && riskScore >= 85)
        action = "DENY";
    return {
        action,
        riskScore,
        coverageLevel: request.coverageLevel ?? "STRONG_ENFORCEMENT",
        reasonCodes: [...new Set([...reasonCodes, ...policyDecision.reasonCodes])],
        categories: [...new Set(categories)],
        explanation: buildExplanation(request, action, reasonCodes, policyDecision.explanation),
        normalizedPath: target,
        workspaceRelativePath: rel,
        reversible,
        deterministic: true,
    };
}
function normalizeAbsoluteLike(pathValue) {
    return pathValue
        .normalize("NFKC")
        .replace(/\\/g, "/")
        .replace(/\/+/g, "/")
        .replace(/\/$/, "")
        .toLowerCase();
}
function relativeInside(root, target) {
    if (target === root)
        return "";
    const prefix = `${root}/`;
    if (!target.startsWith(prefix))
        return undefined;
    return (0, ProjectPolicy_1.normalizeRelPath)(target.slice(prefix.length));
}
function isHiddenPath(relPath) {
    return relPath.split("/").some((part) => part.startsWith(".") && part !== "." && part !== "..");
}
function buildExplanation(request, action, localReasons, policyExplanation) {
    const base = `File ${request.operation} decision ${action}.`;
    const local = localReasons.length ? ` Reasons: ${localReasons.join(", ")}.` : "";
    return `${base}${local} ${policyExplanation}`.trim();
}
//# sourceMappingURL=FileOperationFirewall.js.map