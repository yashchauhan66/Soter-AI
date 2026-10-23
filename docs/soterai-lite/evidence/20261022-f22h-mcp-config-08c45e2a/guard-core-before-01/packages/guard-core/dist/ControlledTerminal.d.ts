import { type EnforcementAction, type ProtectionMode, type ReasonCode } from "./RuntimePolicyEngine";
export interface ControlledTerminalAnalysis {
    action: EnforcementAction;
    executable?: string;
    args: string[];
    riskScore: number;
    categories: string[];
    reasonCodes: Array<ReasonCode | "COMMAND_NOT_ALLOWLISTED" | "SHELL_SYNTAX_UNSUPPORTED" | "COMMAND_PARSE_ERROR">;
    explanation: string;
    coverageLevel: "STRONG_ENFORCEMENT";
    deterministic: true;
}
export interface ControlledTerminalOptions {
    protectionMode?: ProtectionMode;
    productionContext?: boolean;
}
export declare function analyzeControlledTerminalCommand(command: string, options?: ControlledTerminalOptions): ControlledTerminalAnalysis;
//# sourceMappingURL=ControlledTerminal.d.ts.map