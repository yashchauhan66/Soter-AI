/** Explicit data-plane surface. New endpoints require controller auth by default. */
export function isClientRoute(method: string | undefined, pathname: string): boolean {
    if (method === "GET") return ["/version", "/v1/safe-mode/status"].includes(pathname);
    if (method !== "POST") return false;
    return [
        "/v1/scan", "/v1/redact", "/v1/decision",
        "/v1/terminal/preview",
        "/v1/preflight/runtime-capabilities", "/v1/preflight/file-operation",
        "/v1/preflight/network-egress", "/v1/preflight/mcp-tool",
        "/v1/preflight/policy-change", "/v1/preflight/process-launch",
        "/v1/preflight/extension-isolation",
        "/v1/ai/openai-compatible/chat/completions",
        "/v1/ai/anthropic-compatible/messages",
    ].includes(pathname);
}
