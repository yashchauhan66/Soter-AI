"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardClient = exports.CyberRakshakClient = void 0;
exports.normalizeDecision = normalizeDecision;
exports.createClient = createClient;
const errors_1 = require("./errors");
const DEFAULT_BASE_URL = "https://api.cyberrakshak.dev";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_BLOCKED_RESPONSE = "This request was blocked for security reasons.";
/** Maps the server `action` onto the normalized {@link GuardDecision}. */
function normalizeDecision(action) {
    switch (action) {
        case "ALLOW":
            return "ALLOW";
        case "ALLOW_WITH_REDACTION":
        case "REWRITE":
            return "REDACT";
        case "HUMAN_REVIEW":
            return "HUMAN_REVIEW";
        case "BLOCK":
        default:
            return "BLOCK";
    }
}
function createClient(options) {
    return new CyberRakshakClient(options);
}
class CyberRakshakClient {
    constructor(options) {
        if (!options || !options.apiKey) {
            throw new errors_1.CyberRakshakError("apiKey is required.", { code: "config_error" });
        }
        // Defensive: never let a secret reach untrusted browser code.
        if (isBrowserLike()) {
            console.warn("[cyberrakshak] CyberRakshakClient appears to be running in a browser. " +
                "Never embed an API key in client-side code. Call the Guard from a " +
                "server route or proxy instead.");
        }
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.projectId = options.projectId;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.retries = Math.max(0, options.retries ?? 0);
        this.debug = options.debug ?? false;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
        this.extraHeaders = options.headers ?? {};
        if (!this.fetchImpl) {
            throw new errors_1.CyberRakshakError("Global fetch is not available. Pass options.fetch explicitly.", {
                code: "config_error",
            });
        }
    }
    async guardInput(input) {
        const message = input.message ?? input.text;
        if (!message || !message.trim()) {
            throw new errors_1.CyberRakshakValidationError("guardInput requires `text` or `message`.", 400);
        }
        return this.post("/api/guard/input", {
            message,
            userId: input.userId,
            sessionId: input.sessionId,
            metadata: this.withProjectMetadata(input.metadata),
        }, true);
    }
    async guardOutput(input) {
        const aiResponse = input.aiResponse ?? input.text;
        if (!aiResponse || !aiResponse.trim()) {
            throw new errors_1.CyberRakshakValidationError("guardOutput requires `text` or `aiResponse`.", 400);
        }
        return this.post("/api/guard/output", {
            aiResponse,
            sessionId: input.sessionId,
            metadata: this.withProjectMetadata(input.metadata),
        }, true);
    }
    async analyze(input) {
        return this.post("/api/guard/analyze", { text: input.text, direction: input.direction }, false);
    }
    isAllowed(result) {
        return result.allowed === true && this.decisionOf(result) !== "BLOCK";
    }
    shouldBlock(result) {
        const decision = this.decisionOf(result);
        return result.allowed === false || decision === "BLOCK" || decision === "HUMAN_REVIEW";
    }
    getSafeText(result, fallback) {
        return result.safeText ?? result.redactedText ?? fallback;
    }
    async secureChat(input) {
        const blocked = input.blockedResponse ?? DEFAULT_BLOCKED_RESPONSE;
        const inputResult = await this.guardInput({
            message: input.message,
            userId: input.userId,
            sessionId: input.sessionId,
            metadata: input.metadata,
        });
        if (this.shouldBlock(inputResult)) {
            return { reply: inputResult.safeText ?? blocked, blocked: true, inputResult };
        }
        const llmReply = await input.callLLM({
            safeInput: this.getSafeText(inputResult, input.message) ?? input.message,
            original: input.message,
            inputResult,
        });
        const outputResult = await this.guardOutput({
            aiResponse: llmReply,
            sessionId: input.sessionId,
            metadata: input.metadata,
        });
        if (this.shouldBlock(outputResult)) {
            return { reply: outputResult.safeText ?? blocked, blocked: true, inputResult, outputResult };
        }
        return {
            reply: this.getSafeText(outputResult, llmReply) ?? llmReply,
            blocked: false,
            inputResult,
            outputResult,
        };
    }
    /** Ergonomic wrapper around {@link secureChat} matching the docs `guardConversation` shape. */
    guardConversation(input) {
        return this.secureChat({
            message: input.input,
            userId: input.userId,
            sessionId: input.sessionId,
            metadata: input.metadata,
            blockedResponse: input.blockedResponse,
            callLLM: ({ safeInput }) => input.callLLM(safeInput),
        });
    }
    decisionOf(result) {
        return result.decision ?? normalizeDecision(result.action);
    }
    withProjectMetadata(metadata) {
        if (!this.projectId)
            return metadata;
        return { ...(metadata ?? {}), projectId: this.projectId };
    }
    async post(path, body, requireApiKey) {
        const url = `${this.baseUrl}${path}`;
        let attempt = 0;
        // attempt 0 is the first try; retries add additional attempts.
        for (;;) {
            try {
                const result = await this.postOnce(url, path, body, requireApiKey);
                return result;
            }
            catch (caught) {
                const retriable = caught instanceof errors_1.CyberRakshakNetworkError ||
                    (caught instanceof errors_1.CyberRakshakError &&
                        typeof caught.status === "number" &&
                        caught.status >= 500);
                if (attempt < this.retries && retriable) {
                    attempt += 1;
                    this.log(`retrying ${path} (attempt ${attempt + 1}/${this.retries + 1})`);
                    await delay(Math.min(250 * 2 ** (attempt - 1), 2000));
                    continue;
                }
                throw caught;
            }
        }
    }
    async postOnce(url, path, body, requireApiKey) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const headers = {
            "Content-Type": "application/json",
            "User-Agent": "cyberrakshak-guard-sdk/0.1",
            ...this.extraHeaders,
        };
        if (requireApiKey)
            headers["x-api-key"] = this.apiKey;
        this.log(`POST ${path}`);
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
            const aborted = caught instanceof Error && caught.name === "AbortError";
            throw new errors_1.CyberRakshakNetworkError(aborted ? `Request timed out after ${this.timeoutMs}ms.` : "Network request failed.", caught);
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
            const message = extractMessage(data) ?? `Request failed with status ${response.status}.`;
            this.log(`error ${response.status} on ${path}`);
            if (response.status === 401 || response.status === 403) {
                throw new errors_1.CyberRakshakAuthError(message, response.status);
            }
            if (response.status === 429) {
                const retryAfter = Number(response.headers.get("Retry-After") ?? 0) || undefined;
                throw new errors_1.CyberRakshakRateLimitError(message, response.status, retryAfter);
            }
            if (response.status === 400) {
                throw new errors_1.CyberRakshakValidationError(message, response.status, data);
            }
            throw new errors_1.CyberRakshakError(message, { status: response.status, details: data });
        }
        const result = data;
        if (result && typeof result === "object" && typeof result.action === "string" && !result.decision) {
            result.decision = normalizeDecision(result.action);
        }
        return result;
    }
    log(message) {
        if (!this.debug)
            return;
        // Never log the API key or raw text; only safe diagnostics reach here.
        console.debug(`[cyberrakshak] ${message}`);
    }
}
exports.CyberRakshakClient = CyberRakshakClient;
exports.GuardClient = CyberRakshakClient;
function extractMessage(data) {
    if (data && typeof data === "object" && "message" in data) {
        const message = data.message;
        if (typeof message === "string")
            return message;
    }
    return undefined;
}
function isBrowserLike() {
    return (typeof window !== "undefined" &&
        typeof window.document !== "undefined");
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
