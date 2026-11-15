/** Owned diagnostic copies only. Never use this for secret-processing protocol payloads. */
export const OWNED_SINK_CODES = Object.freeze([
    "scan", "scan_file", "scan_selection", "scan_prompt", "scan_git", "fixture",
    "broker_started", "request_failed", "request_allowed", "request_blocked",
    "response_allowed", "response_blocked", "provider_error", "manual_scan", "prompt_scan",
    "egress.precheck", "egress.programmatic",
    "file_change", "protected_access", "mcp_config_change", "repo_instruction_change",
    "canary_hit", "extension_change", "config_change", "terminal_command", "broker_event",
    "broker_request_scanned", "broker_request_redacted", "broker_request_blocked", "broker_response_scanned", "broker_response_leak_detected",
    "context_built", "context_blocked", "protected_file_attempted", "output_scanned", "approval_required", "approval_granted", "approval_denied",
    "mcp_tool_blocked", "terminal_command_blocked", "safe_mode_enabled", "safe_mode_disabled", "memory_session_started", "memory_session_ended",
    "terminal_command_previewed", "terminal_command_executed", "runtime_capabilities_previewed", "file_operation_previewed", "network_egress_previewed",
    "mcp_tool_previewed", "policy_change_previewed", "process_launch_previewed", "extension_isolation_previewed",
    "checkpoint_created", "checkpoint_rolled_back", "checkpoint_rollback_denied",
] as const);
const codes = new Set<string>(OWNED_SINK_CODES);
const decisions = new Set(["allow", "block", "warn", "redact", "deny", "approval_required", "unknown", "monitor", "alert",
    "ALLOW", "BLOCK", "WARN", "REDACT", "APPROVAL_REQUIRED", "BLOCK_OVERRIDDEN", "WARN_OVERRIDDEN", "REDACT_OVERRIDDEN"]);

/** No input text, hashes of private text, Error messages, paths or previews survive. */
export function ownedSinkMetadata(code: unknown, decision: unknown, riskScore?: unknown): Readonly<{
    code: string; decision: string; riskScore?: number;
}> {
    return Object.freeze({
        code: typeof code === "string" && codes.has(code) ? code : "event",
        decision: typeof decision === "string" && decisions.has(decision) ? decision : "unknown",
        ...(typeof riskScore === "number" && Number.isInteger(riskScore) && riskScore >= 0 && riskScore <= 100
            ? { riskScore } : {}),
    });
}

export interface OwnedDiagnostic { readonly code: string; readonly port?: number; readonly status?: number }

/** Protocol errors retain a useful category, never caller names or exception text. */
export function ownedFailureMessage(code: unknown): string {
    switch (code) {
        case "unknown_tool": return "Unknown tool";
        case "unknown_method": return "Method not found";
        case "check_failed": return "SoterAI check unavailable";
        default: return "Owned operation unavailable";
    }
}

/** No fallback emission on withdrawal, malformed metadata or a failing sink. */
export function emitOwnedDiagnostic(enabled: unknown, sink: (event: Readonly<OwnedDiagnostic>) => void,
    code: unknown, input?: unknown): boolean {
    if (enabled !== true) return false;
    const field = (name: string, min: number, max: number): number | undefined => {
        try {
            if (!input || typeof input !== "object" || Array.isArray(input)) return;
            const descriptor = Object.getOwnPropertyDescriptor(input, name);
            const value: unknown = descriptor && "value" in descriptor ? descriptor.value : undefined;
            return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
        } catch { return; }
    };
    const port = field("port", 0, 65535), status = field("status", 100, 599);
    const event = Object.freeze({ code: ownedSinkMetadata(code, "unknown").code,
        ...(port === undefined ? {} : { port }), ...(status === undefined ? {} : { status }) });
    try { sink(event); return true; } catch { return false; }
}
