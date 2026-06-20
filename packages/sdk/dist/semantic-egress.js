"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fingerprintSemanticSource = fingerprintSemanticSource;
exports.checkSemanticEgress = checkSemanticEgress;
exports.listSemanticEgressChecks = listSemanticEgressChecks;
const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;
function fingerprintSemanticSource(options, input) {
    return post(options, "/api/semantic-egress/source/fingerprint", input);
}
function checkSemanticEgress(options, input) {
    return post(options, "/api/semantic-egress/check", input);
}
function listSemanticEgressChecks(options) {
    return get(options, "/api/semantic-egress/checks");
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
        "User-Agent": "cybersecurityguard-sdk/semantic-egress",
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
