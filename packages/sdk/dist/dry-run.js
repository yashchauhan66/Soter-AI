"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateAgentAction = simulateAgentAction;
exports.getDryRun = getDryRun;
exports.getDryRunSession = getDryRunSession;
const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;
function simulateAgentAction(options, input) {
    return post(options, "/api/dry-run/simulate", input);
}
function getDryRun(options, dryRunId) {
    return get(options, `/api/dry-run/${encodeURIComponent(dryRunId)}`);
}
function getDryRunSession(options, sessionId) {
    return get(options, `/api/dry-run/session/${encodeURIComponent(sessionId)}`);
}
async function post(options, path, body) {
    return requestJson(options, path, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
        headers: { "Content-Type": "application/json" },
    });
}
async function get(options, path) {
    return requestJson(options, path, { method: "GET" });
}
async function requestJson(options, path, init) {
    if (!options.apiKey)
        throw new Error("apiKey is required.");
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl)
        throw new Error("Global fetch is not available. Pass options.fetch explicitly.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const headers = {
        ...(init.headers ?? {}),
        ...(options.headers ?? {}),
        "x-api-key": options.apiKey,
        "User-Agent": "cybersecurityguard-sdk/dry-run",
    };
    let response;
    try {
        response = await fetchImpl(`${(options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")}${path}`, {
            ...init,
            headers,
            signal: controller.signal,
        });
    }
    finally {
        clearTimeout(timeout);
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
        const message = data && typeof data === "object" && "message" in data && typeof data.message === "string"
            ? data.message
            : `Request failed with status ${response.status}.`;
        throw new Error(message);
    }
    return data;
}
