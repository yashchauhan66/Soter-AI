import * as path from "node:path";
import { safeReadPath } from "../agent/SafeReadProtocol";
import type { NativeClassification } from "../agent/SafeReadBridge";

export interface ClaudeHookDependencies {
    workspace: string;
    ready(): Promise<boolean>;
    classify(file: string, intent: "read" | "write"): Promise<NativeClassification>;
}
export interface ClaudeHookResult {
    status: "CONTINUE" | "DENY" | "UNAVAILABLE";
    body: { hookSpecificOutput?: { hookEventName: "PreToolUse"; permissionDecision: "deny"; permissionDecisionReason: string } };
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const text = (value: unknown, maximum: number): value is string => {
    if (typeof value !== "string" || Buffer.byteLength(value) > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) return false;
    for (let i = 0; i < value.length; i++) {
        const unit = value.charCodeAt(i);
        if (unit >= 0xd800 && unit <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) return false; }
        else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    }
    return true;
};
const unavailable = (): ClaudeHookResult => ({ status: "UNAVAILABLE", body: {} });
const deny = (): ClaudeHookResult => ({ status: "DENY", body: { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny",
    permissionDecisionReason: "Native operation withheld. Use the approved SoterAI safe reader for protected saved files or a SoterAI checked terminal." } } });
const neutral = (): ClaudeHookResult => ({ status: "CONTINUE", body: {} });
function canonicalRoot(value: unknown): string | undefined {
    if (!text(value, 2048) || !/^[A-Za-z]:[\\/]/.test(value) || /[\x00-\x1f\x7f<>|?*:]/.test(value.slice(2))) return;
    const rest = value.slice(3).replaceAll("\\", "/").replace(/\/$/, "");
    if (rest && rest.split("/").some(part => !part || part === "." || part === ".." || /[. ]$/.test(part))) return;
    return path.win32.resolve(value).toLowerCase();
}
/** Only the observed absolute local-path grammar; no shell/MSYS/URI interpretation. */
export function claudeNativeFile(value: unknown, workspace: string): string | undefined {
    if (!canonicalRoot(workspace) || typeof value !== "string" || !canonicalRoot(value)) return;
    const file = safeReadPath({ path: path.win32.relative(workspace, value).replaceAll("\\", "/") });
    if (!file || file.split("/").some(part => [".claude", ".mcp.json"].includes(part.toLowerCase()))
        || file.toLowerCase().startsWith(".clinerules/hooks/")) return;
    return file;
}
const integer = (value: unknown, minimum: number, maximum = 1_000_000): boolean => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const validEffort = (value: unknown): boolean => {
    const level = record(value) && Object.keys(value).join(",") === "level" ? value.level : value;
    return typeof level === "string" && ["low", "medium", "high", "max"].includes(level);
};
/** Metadata-only permission decision. Neither transcript nor source files are read here. */
export async function evaluateClaudeHook(frame: unknown, deps: ClaudeHookDependencies): Promise<ClaudeHookResult> {
    try {
        if (!record(frame) || !canonicalRoot(frame.cwd) || canonicalRoot(frame.cwd) !== canonicalRoot(deps.workspace)
            || frame.permission_mode !== "default" || !text(frame.session_id, 256) || !frame.session_id
            || !text(frame.transcript_path, 2048) || !text(frame.prompt_id, 256) || !frame.prompt_id) return unavailable();
        if (frame.hook_event_name === "UserPromptSubmit") {
            if (!keys(frame, ["cwd", "hook_event_name", "permission_mode", "prompt", "prompt_id", "session_id", "transcript_path"])
                || !text(frame.prompt, 48 * 1024)) return unavailable();
            return await deps.ready() === true ? neutral() : unavailable();
        }
        if (frame.hook_event_name !== "PreToolUse"
            || !keys(frame, ["cwd", "effort", "hook_event_name", "mcp_server", "permission_mode", "prompt_id", "session_id", "tool_input", "tool_name", "tool_use_id", "transcript_path"])
            || !text(frame.tool_name, 256) || !text(frame.tool_use_id, 256) || !frame.tool_use_id || !record(frame.tool_input)
            || frame.effort !== undefined && !validEffort(frame.effort)) return unavailable();
        if (frame.mcp_server !== undefined && (frame.tool_name !== "mcp__soterai_safe_read__soterai_read_project_file_safely"
            || !record(frame.mcp_server) || Object.keys(frame.mcp_server).sort().join(",") !== "name,source" || frame.mcp_server.name !== "soterai_safe_read"
            || !text(frame.mcp_server.source, 256) || !frame.mcp_server.source || /[\x00-\x1f\x7f]/.test(frame.mcp_server.source))) return unavailable();
        if (await deps.ready() !== true) return unavailable();
        const args = frame.tool_input;
        if (frame.tool_name === "mcp__soterai_safe_read__soterai_read_project_file_safely") {
            return safeReadPath(args) && await deps.ready() === true ? neutral() : deny();
        }
        let file: string | undefined, intent: "read" | "write" = "read";
        if (frame.tool_name === "Read") {
            if (!keys(args, ["file_path", "offset", "limit", "allow_large"])
                || args.offset !== undefined && !integer(args.offset, 0) || args.limit !== undefined && !integer(args.limit, 1)
                || args.allow_large !== undefined && args.allow_large !== false) return deny();
            file = claudeNativeFile(args.file_path, deps.workspace);
            if (file && /\.(?:pdf|ipynb|png|jpe?g|gif|webp|bmp|ico|svg)$/i.test(file)) return deny();
        } else if (frame.tool_name === "Edit") {
            if (!keys(args, ["file_path", "old_string", "new_string", "replace_all"]) || !text(args.old_string, 16384) || !text(args.new_string, 16384)
                || args.replace_all !== undefined && typeof args.replace_all !== "boolean") return deny();
            file = claudeNativeFile(args.file_path, deps.workspace); intent = "write";
        } else if (frame.tool_name === "Write") {
            if (!keys(args, ["file_path", "content"]) || !text(args.content, 16384)) return deny();
            file = claudeNativeFile(args.file_path, deps.workspace); intent = "write";
        } else if (frame.tool_name === "Grep") {
            if (!keys(args, ["path", "pattern", "output_mode", "-B", "-A", "-C", "context", "-n", "-i", "head_limit", "offset", "multiline"])
                || !text(args.pattern, 2048) || !args.pattern
                || args.output_mode !== undefined && !["content", "files_with_matches", "count"].includes(args.output_mode as string)) return deny();
            for (const key of ["-B", "-A", "-C", "context", "head_limit", "offset"]) if (args[key] !== undefined && !integer(args[key], 0, 2000)) return deny();
            for (const key of ["-n", "-i", "multiline"]) if (args[key] !== undefined && typeof args[key] !== "boolean") return deny();
            file = claudeNativeFile(args.path, deps.workspace);
        } else return deny();
        if (!file) return deny();
        const verdict = await deps.classify(file, intent);
        if (await deps.ready() !== true) return unavailable();
        return verdict === "PUBLIC" ? neutral() : verdict === "RESTRICTED" ? deny() : unavailable();
    } catch { return unavailable(); }
}
