import type { GuardAction } from "./types";
import { type ProjectPolicy, type PathSensitivity, type PathClassification } from "./ProjectPolicy";
/**
 * SafeContextBuilder — the Phase 3/4 core. Given the raw context a user is about
 * to hand an AI assistant (selection, files, diff, configs) plus the project
 * policy, it decides per item what may be shared and produces a SAFE text
 * bundle with known credentials redacted and configured path rules applied.
 *
 * Rules:
 *   protected  → block (excluded; only a "[protected file omitted]" note)
 *   sensitive  → approval_required (summarized; secrets redacted)
 *   normal     → include, but always run redactForSharing first
 *
 * Unknown private text and unrecognized encodings can remain. It uses `findSurvivingSecrets`
 * to check the assembled text for recognized patterns and redact survivors.
 */
export type ContextKind = "selection" | "active_file" | "open_tab" | "git_diff" | "readme" | "agent_config" | "mcp_config" | "terminal_output" | "other";
export interface ContextItem {
    /** Workspace-relative path (or a synthetic label like "git diff"). */
    path: string;
    kind: ContextKind;
    content: string;
    /** Classification from the originating workspace root, when collected by the IDE. */
    classification?: PathClassification;
}
export interface ContextDecision {
    path: string;
    kind: ContextKind;
    level: PathSensitivity;
    action: GuardAction;
    matchedPattern?: string;
    /** Whether this item's (redacted) content is included in the safe bundle. */
    included: boolean;
    /** Whether any RAW content is included (always false — we only ever redact). */
    rawIncluded: boolean;
    reason: string;
    /** Short, secret-free preview of what will be shared. */
    safePreview: string;
    /**
     * Scenario C: retrieved content that tries to hijack the agent (indirect
     * prompt injection) or exfiltrate data. When set, the item's content is
     * quarantined (fenced as untrusted data, never merged as instructions) and
     * the causal chain explains why.
     */
    untrusted?: boolean;
    injectionQuarantined?: boolean;
    causalChain?: string[];
}
export interface SafeContext {
    decisions: ContextDecision[];
    /** The assembled, policy-filtered text; review unrecognized private data before sharing. */
    safeText: string;
    summary: {
        total: number;
        included: number;
        redacted: number;
        blocked: number;
        approvalRequired: number;
        /** Items quarantined for injection/exfiltration (Scenario C). */
        quarantined: number;
    };
}
/**
 * Scan a single item's content for indirect prompt injection and exfiltration
 * intent. Returns a causal chain (secret-free) when the content is hostile.
 */
export declare function scanUntrustedContent(item: ContextItem): {
    hostile: boolean;
    causalChain: string[];
};
/**
 * Build a safe context bundle from raw items using the project policy.
 */
export declare function buildSafeContext(items: ContextItem[], policy: ProjectPolicy): SafeContext;
export declare function buildDebugPrompt(items: ContextItem[], policy: ProjectPolicy, task?: string): string;
export declare function buildCodeReviewPrompt(items: ContextItem[], policy: ProjectPolicy, task?: string): string;
export declare function buildDeploymentPrompt(items: ContextItem[], policy: ProjectPolicy, task?: string): string;
export declare function buildErrorFixPrompt(items: ContextItem[], policy: ProjectPolicy, task?: string): string;
export declare function buildArchitecturePrompt(items: ContextItem[], policy: ProjectPolicy, task?: string): string;
//# sourceMappingURL=SafeContextBuilder.d.ts.map