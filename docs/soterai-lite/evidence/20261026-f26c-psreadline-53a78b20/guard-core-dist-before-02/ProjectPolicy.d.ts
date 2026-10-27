import type { GuardAction } from "./types";
/**
 * ProjectPolicy — the `.soterai/policy.json` schema that governs the AI Context
 * Firewall. This is intentionally SEPARATE from the runtime {@link PolicyConfig}
 * (risk thresholds / detector rules): this policy classifies FILES and PATHS so
 * the firewall can decide what may be shared with a local AI assistant.
 *
 * Honest scope: this policy drives what SoterAI-built context includes/blocks.
 * It cannot prevent another VS Code extension from reading a file it already has
 * OS access to — see docs/ide-guard-limitations.md.
 */
export declare const PROJECT_POLICY_VERSION = 1;
export type ProjectPolicyMode = "standard" | "strict" | "enterprise";
/** Where a path falls in the firewall's sensitivity ladder. */
export type PathSensitivity = "protected" | "sensitive" | "normal";
export interface ProjectPolicyAIContext {
    /** Action for files that match nothing more specific. */
    defaultAction: GuardAction;
    /** Action for files matching `protectedFiles`. */
    protectedFileAction: GuardAction;
    /** Action for files matching `sensitivePaths`. */
    sensitivePathAction: GuardAction;
    /** How long an approved context session stays valid. */
    allowSessionMinutes: number;
}
export interface ProjectPolicyCloud {
    enabled: boolean;
    /** Must stay false by default — raw content never leaves the machine. */
    sendRawContent: boolean;
}
export interface ProjectPolicy {
    version: number;
    mode: ProjectPolicyMode;
    protectedFiles: string[];
    sensitivePaths: string[];
    aiContext: ProjectPolicyAIContext;
    cloud: ProjectPolicyCloud;
}
export interface PathClassification {
    level: PathSensitivity;
    action: GuardAction;
    matchedPattern?: string;
}
/**
 * The default policy shipped by `SoterAI: Create Project AI Security Policy`.
 * Mirrors the mission spec exactly.
 */
export declare const DEFAULT_PROJECT_POLICY: ProjectPolicy;
/**
 * Parse an untrusted `.soterai/policy.json` value into a complete, valid
 * {@link ProjectPolicy}. Partial known-schema input is filled from defaults;
 * an explicitly unsupported version or disabled schema repair is unavailable.
 * Callers must retain accepted denies when parsing fails.
 */
export declare function validateProjectPolicySchema(raw: unknown): void;
export declare function parseProjectPolicy(raw: unknown, options?: {
    schemaValidationEnabled?: boolean;
}): ProjectPolicy;
/** Normalize a path to forward slashes with no leading `./` or `/`. */
export declare function normalizeRelPath(p: string): string;
/**
 * Convert a `.gitignore`/glob-style pattern into an anchored RegExp.
 * Supports:
 *   `**`  → any path segments (including none)
 *   `*`   → any run of non-`/` characters
 *   `?`   → a single non-`/` character
 * A pattern with no `/` matches by BASENAME anywhere in the tree (so `*.pem`
 * and `.env` behave like the user expects), while a pattern containing `/`
 * anchors to the workspace root. This matches how developers read the sample
 * policy (`.env` catches `config/.env`, `src/auth/**` does not catch elsewhere).
 */
export declare function globToRegExp(glob: string): RegExp;
/** True if a path matches any `protectedFiles` pattern. */
export declare function isProtectedPath(relPath: string, policy: ProjectPolicy): boolean;
/** True if a path matches any `sensitivePaths` pattern. */
export declare function isSensitivePath(relPath: string, policy: ProjectPolicy): boolean;
/**
 * Classify a workspace-relative path against the policy. Protected always wins
 * over sensitive (most-restrictive-first), so a file matching both is treated
 * as protected.
 */
export declare function classifyPath(relPath: string, policy: ProjectPolicy): PathClassification;
//# sourceMappingURL=ProjectPolicy.d.ts.map