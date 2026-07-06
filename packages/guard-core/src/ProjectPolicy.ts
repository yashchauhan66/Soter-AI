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

export const PROJECT_POLICY_VERSION = 1;

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
export const DEFAULT_PROJECT_POLICY: ProjectPolicy = {
    version: PROJECT_POLICY_VERSION,
    mode: "standard",
    protectedFiles: [
        ".env",
        ".env.*",
        "**/*.pem",
        "**/*.key",
        "**/id_rsa",
        "**/credentials",
        "**/secrets.*",
        "**/customer-*.csv",
        "**/production*.json",
    ],
    sensitivePaths: [
        "src/auth/**",
        "src/payments/**",
        "infra/**",
        "prisma/schema.prisma",
    ],
    aiContext: {
        defaultAction: "warn",
        protectedFileAction: "block",
        sensitivePathAction: "approval_required",
        allowSessionMinutes: 30,
    },
    cloud: {
        enabled: false,
        sendRawContent: false,
    },
};

const VALID_ACTIONS: GuardAction[] = ["allow", "warn", "redact", "block", "approval_required"];
const VALID_MODES: ProjectPolicyMode[] = ["standard", "strict", "enterprise"];

function asAction(value: unknown, fallback: GuardAction): GuardAction {
    return typeof value === "string" && (VALID_ACTIONS as string[]).includes(value)
        ? (value as GuardAction)
        : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return [...fallback];
    const cleaned = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return cleaned.length ? cleaned : [...fallback];
}

/**
 * Parse an untrusted `.soterai/policy.json` value into a complete, valid
 * {@link ProjectPolicy}. Never throws — unknown/partial input is filled from
 * {@link DEFAULT_PROJECT_POLICY}. This keeps a hand-edited or corrupt policy
 * file from breaking the firewall (fail-safe toward the stricter default).
 */
export function parseProjectPolicy(raw: unknown): ProjectPolicy {
    const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const d = DEFAULT_PROJECT_POLICY;

    const ai = (obj.aiContext && typeof obj.aiContext === "object" ? obj.aiContext : {}) as Record<string, unknown>;
    const cloud = (obj.cloud && typeof obj.cloud === "object" ? obj.cloud : {}) as Record<string, unknown>;

    const allowSessionMinutes =
        typeof ai.allowSessionMinutes === "number" && ai.allowSessionMinutes > 0 && ai.allowSessionMinutes <= 24 * 60
            ? Math.floor(ai.allowSessionMinutes)
            : d.aiContext.allowSessionMinutes;

    return {
        version: typeof obj.version === "number" ? obj.version : d.version,
        mode:
            typeof obj.mode === "string" && (VALID_MODES as string[]).includes(obj.mode)
                ? (obj.mode as ProjectPolicyMode)
                : d.mode,
        protectedFiles: asStringArray(obj.protectedFiles, d.protectedFiles),
        sensitivePaths: asStringArray(obj.sensitivePaths, d.sensitivePaths),
        aiContext: {
            defaultAction: asAction(ai.defaultAction, d.aiContext.defaultAction),
            protectedFileAction: asAction(ai.protectedFileAction, d.aiContext.protectedFileAction),
            sensitivePathAction: asAction(ai.sensitivePathAction, d.aiContext.sensitivePathAction),
            allowSessionMinutes,
        },
        cloud: {
            enabled: cloud.enabled === true,
            // Hard default: never send raw content unless explicitly opted in.
            sendRawContent: cloud.sendRawContent === true,
        },
    };
}

/** Normalize a path to forward slashes with no leading `./` or `/`. */
export function normalizeRelPath(p: string): string {
    return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

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
export function globToRegExp(glob: string): RegExp {
    const g = normalizeRelPath(glob.trim());
    const anchoredToRoot = g.includes("/");

    let re = "";
    for (let i = 0; i < g.length; i++) {
        const c = g[i];
        if (c === "*") {
            if (g[i + 1] === "*") {
                i++;
                if (g[i + 1] === "/") {
                    // `**/` → zero or more leading path segments.
                    i++;
                    re += "(?:.*/)?";
                } else {
                    // Trailing/among-path `**` → anything, including `/`.
                    re += ".*";
                }
            } else {
                re += "[^/]*";
            }
        } else if (c === "?") {
            re += "[^/]";
        } else if ("\\^$.|+()[]{}".includes(c)) {
            re += `\\${c}`;
        } else {
            re += c;
        }
    }

    const body = anchoredToRoot ? `^${re}$` : `(?:^|.*/)${re}$`;
    return new RegExp(body);
}

function matchesAny(relPath: string, patterns: string[]): string | undefined {
    const p = normalizeRelPath(relPath);
    const base = p.split("/").pop() ?? p;
    for (const pattern of patterns) {
        const re = globToRegExp(pattern);
        if (re.test(p) || re.test(base)) return pattern;
    }
    return undefined;
}

/** True if a path matches any `protectedFiles` pattern. */
export function isProtectedPath(relPath: string, policy: ProjectPolicy): boolean {
    return matchesAny(relPath, policy.protectedFiles) !== undefined;
}

/** True if a path matches any `sensitivePaths` pattern. */
export function isSensitivePath(relPath: string, policy: ProjectPolicy): boolean {
    return matchesAny(relPath, policy.sensitivePaths) !== undefined;
}

/**
 * Classify a workspace-relative path against the policy. Protected always wins
 * over sensitive (most-restrictive-first), so a file matching both is treated
 * as protected.
 */
export function classifyPath(relPath: string, policy: ProjectPolicy): PathClassification {
    const protectedMatch = matchesAny(relPath, policy.protectedFiles);
    if (protectedMatch) {
        return { level: "protected", action: policy.aiContext.protectedFileAction, matchedPattern: protectedMatch };
    }
    const sensitiveMatch = matchesAny(relPath, policy.sensitivePaths);
    if (sensitiveMatch) {
        return { level: "sensitive", action: policy.aiContext.sensitivePathAction, matchedPattern: sensitiveMatch };
    }
    return { level: "normal", action: policy.aiContext.defaultAction };
}
