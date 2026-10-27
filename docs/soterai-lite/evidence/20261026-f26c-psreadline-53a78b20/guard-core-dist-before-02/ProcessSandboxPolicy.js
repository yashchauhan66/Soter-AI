"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateProcessLaunch = evaluateProcessLaunch;
const detectors_1 = require("./detectors");
const RuntimePolicyEngine_1 = require("./RuntimePolicyEngine");
const SAFE_EXECUTABLES = new Set(["git", "node", "npm", "python", "python3", "pytest", "tsx"]);
const ENV_ALLOWLIST = ["PATH", "Path", "SystemRoot", "windir", "HOME", "USERPROFILE", "TMP", "TEMP", "LC_ALL"];
function evaluateProcessLaunch(request) {
    const protectionMode = request.protectionMode ?? "standard";
    const sandboxStrength = request.sandboxStrength ?? "none";
    const executable = normalizeExecutable(request.executable);
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
    if (request.shell)
        add(90, "shell_execution", "SHELL_DISABLED");
    if (!SAFE_EXECUTABLES.has(executable))
        add(55, "non_allowlisted_executable", "NON_ALLOWLISTED_EXECUTABLE");
    if (envContainsSecrets(request.env))
        add(75, "environment_secret", "ENV_SECRET_PRESENT");
    if (request.cwd && request.workspaceRoot && !isWithin(request.cwd, request.workspaceRoot))
        add(70, "workspace_escape", "CWD_OUTSIDE_WORKSPACE");
    if ((request.requestedNetwork ?? "none") === "unrestricted")
        add(80, "unrestricted_network", "NETWORK_REQUIRES_ALLOWLIST");
    if ((request.requestedNetwork ?? "none") === "allowlist" && !request.allowedHosts?.length)
        add(50, "missing_network_allowlist", "NETWORK_REQUIRES_ALLOWLIST");
    if ((request.filesystemMode ?? "read_only_workspace") === "unrestricted")
        add(85, "unrestricted_filesystem", "UNRESTRICTED_FILESYSTEM");
    if (request.allowChildProcesses && sandboxStrength !== "os_enforced")
        add(65, "child_process_tree", "CHILD_PROCESS_TREE_REQUIRES_OS_SANDBOX");
    if (riskScore >= 70 && sandboxStrength === "none")
        add(20, "missing_os_sandbox", "NO_OS_SANDBOX_FOR_HIGH_RISK_PROCESS");
    const policy = new RuntimePolicyEngine_1.RuntimePolicyEngine().evaluate({
        actionType: "terminal_command",
        protectionMode,
        coverageLevel: sandboxStrength === "os_enforced" ? "FULL_ENFORCEMENT" : sandboxStrength === "broker_constrained" ? "STRONG_ENFORCEMENT" : "PARTIAL_VISIBILITY",
        riskScore,
        categories,
        destinationTrust: request.requestedNetwork === "none" ? "local" : request.allowedHosts?.length ? "approved" : "unknown",
        parserStatus: request.shell ? "failed_suspicious" : "parsed",
        containsSecrets: envContainsSecrets(request.env),
        productionContext: request.productionContext ?? false,
        reversible: false,
    });
    let action = policy.action;
    if (reasonCodes.includes("SHELL_DISABLED") || reasonCodes.includes("ENV_SECRET_PRESENT"))
        action = "DENY";
    if (reasonCodes.includes("NO_OS_SANDBOX_FOR_HIGH_RISK_PROCESS") && action !== "DENY")
        action = protectionMode === "standard" ? "ASK" : "DENY";
    if (action === "ALLOW" && sandboxStrength !== "none")
        action = "ALLOW_IN_SANDBOX";
    const profile = action === "DENY" ? undefined : buildProfile(request);
    return {
        action,
        deterministic: true,
        coverageLevel: sandboxStrength === "os_enforced" ? "FULL_ENFORCEMENT" : sandboxStrength === "broker_constrained" ? "STRONG_ENFORCEMENT" : "PARTIAL_VISIBILITY",
        sandboxStrength,
        riskScore,
        categories,
        reasonCodes: [...reasonCodes, ...policy.reasonCodes.filter((code) => !reasonCodes.includes(code))],
        profile,
        explanation: explain(action, sandboxStrength, reasonCodes),
    };
}
function buildProfile(request) {
    return {
        shell: false,
        cwd: request.cwd,
        envAllowlist: ENV_ALLOWLIST,
        networkMode: request.requestedNetwork === "unrestricted" ? "allowlist" : request.requestedNetwork ?? "none",
        allowedHosts: request.allowedHosts ?? [],
        filesystemMode: request.filesystemMode === "read_write_workspace" ? "read_write_workspace" : "read_only_workspace",
        childProcessPolicy: request.allowChildProcesses ? "brokered_only" : "deny",
        timeoutMs: 30_000,
        maxBufferBytes: 1_048_576,
    };
}
function explain(action, sandboxStrength, reasons) {
    if (action === "DENY")
        return `Process launch denied before execution: ${reasons.join(", ") || "policy"}.`;
    if (action === "ASK")
        return `Process launch requires explicit approval because coverage is ${sandboxStrength}.`;
    return `Process launch may proceed only through the returned sandbox profile.`;
}
function envContainsSecrets(env) {
    if (!env)
        return false;
    return Object.entries(env).some(([key, value]) => {
        if (/TOKEN|SECRET|PASSWORD|API[_-]?KEY|PRIVATE[_-]?KEY/i.test(key))
            return true;
        return Boolean(value && (0, detectors_1.detectSecrets)(`${key}=${value}`).matches.length);
    });
}
function normalizeExecutable(value) {
    const last = value.replace(/\\/g, "/").split("/").pop() ?? value;
    return last.toLowerCase().replace(/\.(exe|cmd|bat)$/i, "");
}
function isWithin(child, root) {
    const normalize = (value) => value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    const c = normalize(child);
    const r = normalize(root);
    return c === r || c.startsWith(`${r}/`);
}
//# sourceMappingURL=ProcessSandboxPolicy.js.map