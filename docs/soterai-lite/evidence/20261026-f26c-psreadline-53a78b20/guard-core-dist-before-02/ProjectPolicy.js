"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROJECT_POLICY = exports.PROJECT_POLICY_VERSION = void 0;
exports.validateProjectPolicySchema = validateProjectPolicySchema;
exports.parseProjectPolicy = parseProjectPolicy;
exports.normalizeRelPath = normalizeRelPath;
exports.globToRegExp = globToRegExp;
exports.isProtectedPath = isProtectedPath;
exports.isSensitivePath = isSensitivePath;
exports.classifyPath = classifyPath;
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
exports.PROJECT_POLICY_VERSION = 1;
/**
 * The default policy shipped by `SoterAI: Create Project AI Security Policy`.
 * Mirrors the mission spec exactly.
 */
exports.DEFAULT_PROJECT_POLICY = {
    version: exports.PROJECT_POLICY_VERSION,
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
const VALID_ACTIONS = ["allow", "warn", "redact", "block", "approval_required"];
const VALID_MODES = ["standard", "strict", "enterprise"];
function asAction(value, fallback) {
    return typeof value === "string" && VALID_ACTIONS.includes(value)
        ? value
        : fallback;
}
function asStringArray(value, fallback) {
    if (!Array.isArray(value))
        return [...fallback];
    const cleaned = value.filter((v) => typeof v === "string" && v.trim().length > 0);
    return cleaned.length ? cleaned : [...fallback];
}
/**
 * Parse an untrusted `.soterai/policy.json` value into a complete, valid
 * {@link ProjectPolicy}. Partial known-schema input is filled from defaults;
 * an explicitly unsupported version or disabled schema repair is unavailable.
 * Callers must retain accepted denies when parsing fails.
 */
function validateProjectPolicySchema(raw) {
    if (raw && typeof raw === "object" && "version" in raw
        && raw.version !== exports.PROJECT_POLICY_VERSION) {
        throw new Error("Unsupported project policy schema; policy operations are unavailable");
    }
}
function parseProjectPolicy(raw, options = {}) {
    if (options.schemaValidationEnabled === false)
        throw new Error("Project policy operations unavailable while schema validation is disabled");
    validateProjectPolicySchema(raw);
    const obj = (raw && typeof raw === "object" ? raw : {});
    const d = exports.DEFAULT_PROJECT_POLICY;
    const ai = (obj.aiContext && typeof obj.aiContext === "object" ? obj.aiContext : {});
    const cloud = (obj.cloud && typeof obj.cloud === "object" ? obj.cloud : {});
    const allowSessionMinutes = typeof ai.allowSessionMinutes === "number" && ai.allowSessionMinutes > 0 && ai.allowSessionMinutes <= 24 * 60
        ? Math.floor(ai.allowSessionMinutes)
        : d.aiContext.allowSessionMinutes;
    return {
        version: typeof obj.version === "number" ? obj.version : d.version,
        mode: typeof obj.mode === "string" && VALID_MODES.includes(obj.mode)
            ? obj.mode
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
function normalizeRelPath(p) {
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
function globToRegExp(glob) {
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
                }
                else {
                    // Trailing/among-path `**` → anything, including `/`.
                    re += ".*";
                }
            }
            else {
                re += "[^/]*";
            }
        }
        else if (c === "?") {
            re += "[^/]";
        }
        else if ("\\^$.|+()[]{}".includes(c)) {
            re += `\\${c}`;
        }
        else {
            re += c;
        }
    }
    const body = anchoredToRoot ? `^${re}$` : `(?:^|.*/)${re}$`;
    return new RegExp(body);
}
function matchesAny(relPath, patterns) {
    const p = normalizeRelPath(relPath);
    const base = p.split("/").pop() ?? p;
    for (const pattern of patterns) {
        const re = globToRegExp(pattern);
        if (re.test(p) || re.test(base))
            return pattern;
    }
    return undefined;
}
/** True if a path matches any `protectedFiles` pattern. */
function isProtectedPath(relPath, policy) {
    return matchesAny(relPath, policy.protectedFiles) !== undefined;
}
/** True if a path matches any `sensitivePaths` pattern. */
function isSensitivePath(relPath, policy) {
    return matchesAny(relPath, policy.sensitivePaths) !== undefined;
}
/**
 * Classify a workspace-relative path against the policy. Protected always wins
 * over sensitive (most-restrictive-first), so a file matching both is treated
 * as protected.
 */
function classifyPath(relPath, policy) {
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
//# sourceMappingURL=ProjectPolicy.js.map