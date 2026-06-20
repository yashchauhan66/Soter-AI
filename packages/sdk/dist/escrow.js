"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEscrowTransaction = createEscrowTransaction;
exports.approveEscrowTransaction = approveEscrowTransaction;
exports.denyEscrowTransaction = denyEscrowTransaction;
exports.editAndApproveEscrow = editAndApproveEscrow;
exports.executeEscrowTransaction = executeEscrowTransaction;
exports.getEscrowTransaction = getEscrowTransaction;
exports.listPendingEscrowTransactions = listPendingEscrowTransactions;
const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;
function createEscrowTransaction(options, input) {
    return post(options, "/api/escrow/create", input);
}
function approveEscrowTransaction(options, input) {
    return post(options, "/api/escrow/approve", input);
}
function denyEscrowTransaction(options, input) {
    return post(options, "/api/escrow/deny", input);
}
function editAndApproveEscrow(options, input) {
    return post(options, "/api/escrow/edit-and-approve", input);
}
function executeEscrowTransaction(options, input) {
    return post(options, "/api/escrow/execute", input);
}
function getEscrowTransaction(options, escrowTransactionId) {
    return get(options, `/api/escrow/${encodeURIComponent(escrowTransactionId)}`);
}
function listPendingEscrowTransactions(options) {
    return get(options, "/api/escrow/pending");
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
        "User-Agent": "cybersecurityguard-sdk/escrow",
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
