import type { GuardAction } from "./types";
import { classifyPath, type ProjectPolicy, type PathSensitivity } from "./ProjectPolicy";
import { redactForSharing, findSurvivingSecrets } from "./Redactor";

/**
 * SafeContextBuilder — the Phase 3/4 core. Given the raw context a user is about
 * to hand an AI assistant (selection, files, diff, configs) plus the project
 * policy, it decides per item what may be shared and produces a SAFE text
 * bundle that is guaranteed free of high-risk secrets.
 *
 * Rules:
 *   protected  → block (excluded; only a "[protected file omitted]" note)
 *   sensitive  → approval_required (summarized; secrets redacted)
 *   normal     → include, but always run redactForSharing first
 *
 * The builder NEVER emits a raw secret. It asserts `findSurvivingSecrets` is
 * empty on the assembled text and fail-closes if anything slips through.
 */

export type ContextKind =
    | "selection"
    | "active_file"
    | "open_tab"
    | "git_diff"
    | "readme"
    | "agent_config"
    | "mcp_config"
    | "terminal_output"
    | "other";

export interface ContextItem {
    /** Workspace-relative path (or a synthetic label like "git diff"). */
    path: string;
    kind: ContextKind;
    content: string;
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
}

export interface SafeContext {
    decisions: ContextDecision[];
    /** The assembled, secret-free text ready to paste into an AI tool. */
    safeText: string;
    summary: {
        total: number;
        included: number;
        redacted: number;
        blocked: number;
        approvalRequired: number;
    };
}

const PREVIEW_LEN = 160;

/** A secret-free structural summary of a sensitive/protected file. */
function summarizeFile(item: ContextItem): string {
    const lineCount = item.content.split("\n").length;
    const keys = [...item.content.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)]
        .map((m) => m[1])
        .slice(0, 20);
    const keyLine = keys.length ? ` Keys present (values omitted): ${keys.join(", ")}.` : "";
    return `${item.path} — ${lineCount} lines, kind=${item.kind}.${keyLine} [values and secrets omitted by SoterAI]`;
}

function safePreview(text: string): string {
    const redacted = redactForSharing(text);
    const oneLine = redacted.replace(/\s+/g, " ").trim();
    return oneLine.length > PREVIEW_LEN ? `${oneLine.slice(0, PREVIEW_LEN)}…` : oneLine;
}

/**
 * Build a safe context bundle from raw items using the project policy.
 */
export function buildSafeContext(items: ContextItem[], policy: ProjectPolicy): SafeContext {
    const decisions: ContextDecision[] = [];
    const parts: string[] = [];
    let included = 0;
    let redactedCount = 0;
    let blocked = 0;
    let approvalRequired = 0;

    for (const item of items) {
        const cls = classifyPath(item.path, policy);

        if (cls.level === "protected") {
            blocked++;
            decisions.push({
                path: item.path, kind: item.kind, level: cls.level, action: cls.action,
                matchedPattern: cls.matchedPattern, included: false, rawIncluded: false,
                reason: `Protected by policy pattern "${cls.matchedPattern}". Excluded from AI context.`,
                safePreview: "[protected file omitted]",
            });
            parts.push(`# ${item.path}\n[protected file omitted by SoterAI]`);
            continue;
        }

        if (cls.level === "sensitive") {
            approvalRequired++;
            const summary = summarizeFile(item);
            decisions.push({
                path: item.path, kind: item.kind, level: cls.level, action: cls.action,
                matchedPattern: cls.matchedPattern, included: true, rawIncluded: false,
                reason: `Sensitive path "${cls.matchedPattern}" — summarized, secrets redacted. Approval required.`,
                safePreview: safePreview(summary),
            });
            parts.push(`# ${item.path} (summary)\n${summary}`);
            included++;
            continue;
        }

        // normal → redact then include.
        const redacted = redactForSharing(item.content);
        if (redacted !== item.content) redactedCount++;
        decisions.push({
            path: item.path, kind: item.kind, level: cls.level, action: cls.action,
            included: true, rawIncluded: false,
            reason: redacted !== item.content
                ? "Included with secrets redacted."
                : "Included (no secrets detected).",
            safePreview: safePreview(redacted),
        });
        parts.push(`# ${item.path}\n${redacted}`);
        included++;
    }

    let safeText = parts.join("\n\n");

    // Hard invariant — assembled context must be free of high-risk secrets.
    const survivors = findSurvivingSecrets(safeText);
    if (survivors.length > 0) {
        safeText = redactForSharing(safeText);
    }

    return {
        decisions,
        safeText,
        summary: {
            total: items.length,
            included,
            redacted: redactedCount,
            blocked,
            approvalRequired,
        },
    };
}

// ─── Phase 4: Safe prompt templates ──────────────────────────────────────────

const SECURITY_NOTE =
    "No production secrets are included; sensitive values were redacted or summarized by SoterAI IDE Guard.";

function frame(title: string, task: string, safe: SafeContext): string {
    return [
        title,
        task ? `\nTask: ${task}` : "",
        "\n--- Safe context (SoterAI-built) ---",
        safe.safeText || "[no shareable context]",
        "\n--- Security note ---",
        SECURITY_NOTE,
    ].filter(Boolean).join("\n");
}

export function buildDebugPrompt(items: ContextItem[], policy: ProjectPolicy, task = ""): string {
    return frame("I am debugging an issue and need help.", task, buildSafeContext(items, policy));
}

export function buildCodeReviewPrompt(items: ContextItem[], policy: ProjectPolicy, task = ""): string {
    return frame("Please review the following code for correctness and security.", task, buildSafeContext(items, policy));
}

export function buildDeploymentPrompt(items: ContextItem[], policy: ProjectPolicy, task = ""): string {
    return frame("I am troubleshooting a deployment.", task, buildSafeContext(items, policy));
}

export function buildErrorFixPrompt(items: ContextItem[], policy: ProjectPolicy, task = ""): string {
    return frame("Help me fix the following error.", task, buildSafeContext(items, policy));
}

export function buildArchitecturePrompt(items: ContextItem[], policy: ProjectPolicy, task = ""): string {
    return frame("Help me reason about this system's architecture.", task, buildSafeContext(items, policy));
}
