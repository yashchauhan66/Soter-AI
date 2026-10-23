import { type EnforcementAction, type ProtectionMode, type ReasonCode } from "./RuntimePolicyEngine";
export type ProcessNetworkMode = "none" | "allowlist" | "unrestricted";
export type ProcessFilesystemMode = "read_only_workspace" | "read_write_workspace" | "unrestricted";
export type ProcessSandboxStrength = "os_enforced" | "broker_constrained" | "none";
export interface ProcessLaunchRequest {
    executable: string;
    args?: string[];
    cwd?: string;
    workspaceRoot?: string;
    env?: Record<string, string | undefined>;
    requestedNetwork?: ProcessNetworkMode;
    allowedHosts?: string[];
    filesystemMode?: ProcessFilesystemMode;
    allowChildProcesses?: boolean;
    shell?: boolean;
    productionContext?: boolean;
    sandboxStrength?: ProcessSandboxStrength;
    protectionMode?: ProtectionMode;
}
export interface ProcessSandboxProfile {
    shell: false;
    cwd?: string;
    envAllowlist: string[];
    networkMode: ProcessNetworkMode;
    allowedHosts: string[];
    filesystemMode: Exclude<ProcessFilesystemMode, "unrestricted">;
    childProcessPolicy: "deny" | "brokered_only";
    timeoutMs: number;
    maxBufferBytes: number;
}
export interface ProcessLaunchDecision {
    action: EnforcementAction;
    deterministic: true;
    coverageLevel: "FULL_ENFORCEMENT" | "STRONG_ENFORCEMENT" | "PARTIAL_VISIBILITY";
    sandboxStrength: ProcessSandboxStrength;
    riskScore: number;
    categories: string[];
    reasonCodes: Array<ReasonCode | "SHELL_DISABLED" | "NON_ALLOWLISTED_EXECUTABLE" | "ENV_SECRET_PRESENT" | "CWD_OUTSIDE_WORKSPACE" | "NETWORK_REQUIRES_ALLOWLIST" | "UNRESTRICTED_FILESYSTEM" | "CHILD_PROCESS_TREE_REQUIRES_OS_SANDBOX" | "NO_OS_SANDBOX_FOR_HIGH_RISK_PROCESS">;
    profile?: ProcessSandboxProfile;
    explanation: string;
}
export declare function evaluateProcessLaunch(request: ProcessLaunchRequest): ProcessLaunchDecision;
//# sourceMappingURL=ProcessSandboxPolicy.d.ts.map