"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardClient = void 0;
exports.createClient = createClient;
const errors_1 = require("./errors");
const DEFAULT_BASE_URL = "https://api.cyberrakshak.dev";
const DEFAULT_TIMEOUT_MS = 8000;
function createClient(options) {
    return new GuardClient(options);
}
class GuardClient {
    constructor(options) {
        if (!options.apiKey)
            throw new errors_1.CyberRakshakError("apiKey is required.", { code: "config_error" });
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
        this.extraHeaders = options.headers ?? {};
        if (!this.fetchImpl) {
            throw new errors_1.CyberRakshakError("Global fetch is not available. Pass options.fetch explicitly.", { code: "config_error" });
        }
    }
    guardInput(input) {
        return this.post("/api/guard/input", input, true);
    }
    guardOutput(input) {
        return this.post("/api/guard/output", input, true);
    }
    analyze(input) {
        return this.post("/api/guard/analyze", input, false);
    }
    async secureChat(input) {
        const blocked = input.blockedResponse ?? "This request was blocked for security reasons.";
        const inputResult = await this.guardInput({
            message: input.message,
            userId: input.userId,
            sessionId: input.sessionId,
            metadata: input.metadata,
        });
        if (!inputResult.allowed) {
            return { reply: inputResult.safeText ?? blocked, blocked: true, inputResult };
        }
        const llmReply = await input.callLLM({
            safeInput: inputResult.safeText ?? input.message,
            original: input.message,
            inputResult,
        });
        const outputResult = await this.guardOutput({
            aiResponse: llmReply,
            sessionId: input.sessionId,
            metadata: input.metadata,
        });
        if (!outputResult.allowed) {
            return { reply: outputResult.safeText ?? blocked, blocked: true, inputResult, outputResult };
        }
        return { reply: outputResult.safeText ?? llmReply, blocked: false, inputResult, outputResult };
    }
    async post(path, body, requireApiKey) {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const headers = {
            "Content-Type": "application/json",
            "User-Agent": "cyberrakshak-guard-sdk/0.1",
            ...this.extraHeaders,
        };
        if (requireApiKey)
            headers["x-api-key"] = this.apiKey;
        let response;
        try {
            response = await this.fetchImpl(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body ?? {}),
                signal: controller.signal,
            });
        }
        catch (caught) {
            throw new errors_1.CyberRakshakNetworkError(caught instanceof Error ? caught.message : "Network request failed.", caught);
        }
        finally {
            clearTimeout(timer);
        }
        const text = await response.text();
        let data = undefined;
        if (text) {
            try {
                data = JSON.parse(text);
            }
            catch {
                throw new errors_1.CyberRakshakError("Server returned non-JSON response.", { status: response.status });
            }
        }
        if (!response.ok) {
            const message = (data && typeof data === "object" && "message" in data && typeof data.message === "string")
                ? data.message
                : `Request failed with status ${response.status}.`;
            if (response.status === 401 || response.status === 403)
                throw new errors_1.CyberRakshakAuthError(message, response.status);
            if (response.status === 429) {
                const retryAfter = Number(response.headers.get("Retry-After") ?? 0) || undefined;
                throw new errors_1.CyberRakshakRateLimitError(message, response.status, retryAfter);
            }
            if (response.status === 400)
                throw new errors_1.CyberRakshakValidationError(message, response.status, data);
            throw new errors_1.CyberRakshakError(message, { status: response.status, details: data });
        }
        return data;
    }
}
exports.GuardClient = GuardClient;
