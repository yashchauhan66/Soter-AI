import { type ProjectPolicy } from "./ProjectPolicy";
import { type EnforcementAction, type ProtectionMode, type RuntimeCoverageLevel } from "./RuntimePolicyEngine";
export type FileOperation = "read" | "write" | "delete" | "rename" | "chmod" | "mass_change" | "config_change";
export interface FileOperationRequest {
    operation: FileOperation;
    targetPath: string;
    workspaceRoot: string;
    realPath?: string;
    destinationPath?: string;
    fileCount?: number;
    contentPreview?: string;
    projectPolicy?: ProjectPolicy;
    protectionMode?: ProtectionMode;
    coverageLevel?: RuntimeCoverageLevel;
    actor?: string;
}
export interface FileOperationDecision {
    action: EnforcementAction;
    riskScore: number;
    coverageLevel: RuntimeCoverageLevel;
    reasonCodes: string[];
    categories: string[];
    explanation: string;
    normalizedPath: string;
    workspaceRelativePath?: string;
    reversible: boolean;
    deterministic: true;
}
export declare function evaluateFileOperation(request: FileOperationRequest): FileOperationDecision;
//# sourceMappingURL=FileOperationFirewall.d.ts.map