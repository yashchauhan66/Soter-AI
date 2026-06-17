"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardClient = void 0;
exports.createClient = createClient;
const errors_1 = require("./errors");
const DEFAULT_BASE_URL = "https://api.cyberrakshak.com";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_BACKOFF_MS = 250;
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
        this.maxRetries = options.maxRetries ?? 0;
        this.retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
        this.extraHeaders = options.headers ?? {};
        if (!this.fetchImpl) {
            throw new errors_1.CyberRakshakError("Global fetch is not available. Pass options.fetch explicitly.", { code: "config_error" });
        }
    }
    input(message, options = {}) {
        return this.guardInput({ ...options, message });
    }
    output(aiResponse, options = {}) {
        return this.guardOutput({ ...options, aiResponse });
    }
    guardInput(input) {
        return this.post("/api/guard/input", input, true);
    }
    guardOutput(input) {
        return this.post("/api/guard/output", input, true);
    }
    analyze(textOrInput, direction) {
        const input = typeof textOrInput === "string" ? { text: textOrInput, direction: direction ?? "INPUT" } : textOrInput;
        return this.post("/api/guard/analyze", input, false);
    }
    shouldCallLLM(result) {
        return result.allowed && (result.action === "ALLOW" || result.action === "ALLOW_WITH_REDACTION" || result.action === "REWRITE");
    }
    getSafeInput(result, originalMessage) {
        return result.safeText ?? result.redactedText ?? originalMessage;
    }
    getSafeOutput(result, originalOutput) {
        return result.safeText ?? result.redactedText ?? originalOutput;
    }
    async protectChat(input) {
        const startedAt = Date.now();
        const blockedResponse = input.blockedResponse ?? "This request was blocked for security reasons.";
        const outputBlockedResponse = input.outputBlockedResponse ?? "The assistant response was blocked for security reasons.";
        const inputGuard = await this.guardInput({
            message: input.message,
            userId: input.userId,
            sessionId: input.sessionId,
            metadata: input.metadata,
        });
        if (!this.shouldCallLLM(inputGuard)) {
            return {
                allowed: false,
                blocked: true,
                inputAction: inputGuard.action,
                llmCalled: false,
                safeResponse: inputGuard.safeText ?? blockedResponse,
                inputGuard,
                latencyMs: Date.now() - startedAt,
            };
        }
        const safeMessage = this.getSafeInput(inputGuard, input.message);
        const rawOutput = await input.callLLM(safeMessage, { originalMessage: input.message, inputGuard });
        const outputGuard = await this.guardOutput({
            aiResponse: rawOutput,
            sessionId: input.sessionId,
            metadata: input.metadata,
        });
        const outputAllowed = this.shouldCallLLM(outputGuard);
        return {
            allowed: outputAllowed,
            blocked: !outputAllowed,
            inputAction: inputGuard.action,
            outputAction: outputGuard.action,
            llmCalled: true,
            safeResponse: outputAllowed ? this.getSafeOutput(outputGuard, rawOutput) : outputGuard.safeText ?? outputGuard.redactedText ?? outputBlockedResponse,
            inputGuard,
            outputGuard,
            latencyMs: Date.now() - startedAt,
        };
    }
    async protectRag(input) {
        const startedAt = Date.now();
        const blockedResponse = input.blockedResponse ?? "This request was blocked for security reasons.";
        const outputBlockedResponse = input.outputBlockedResponse ?? "The assistant response was blocked for security reasons.";
        const inputGuard = await this.guardInput({
            message: input.query,
            userId: input.userId,
            sessionId: input.sessionId,
            metadata: input.metadata,
        });
        if (!this.shouldCallLLM(inputGuard)) {
            return {
                allowed: false,
                blocked: true,
                inputAction: inputGuard.action,
                llmCalled: false,
                retrieved: 0,
                usedSources: [],
                excludedSources: [],
                safeResponse: inputGuard.safeText ?? blockedResponse,
                inputGuard,
                latencyMs: Date.now() - startedAt,
            };
        }
        const safeQuery = this.getSafeInput(inputGuard, input.query);
        const sources = await input.retrieve(safeQuery);
        const usedSources = [];
        const excludedSources = [];
        for (const source of sources) {
            const guard = await this.analyze(source.text, "INPUT");
            if (this.shouldCallLLM(guard)) {
                usedSources.push({ ...source, safeText: this.getSafeInput(guard, source.text), guard });
            }
            else {
                excludedSources.push({ source, guard });
            }
        }
        const safeContext = usedSources.map((source) => source.safeText).join("\n\n");
        const rawOutput = await input.callLLM({ safeQuery, safeContext, sources: usedSources });
        const outputGuard = await this.guardOutput({
            aiResponse: rawOutput,
            sessionId: input.sessionId,
            metadata: input.metadata,
        });
        const outputAllowed = this.shouldCallLLM(outputGuard);
        return {
            allowed: outputAllowed,
            blocked: !outputAllowed,
            inputAction: inputGuard.action,
            outputAction: outputGuard.action,
            llmCalled: true,
            retrieved: sources.length,
            usedSources,
            excludedSources,
            safeResponse: outputAllowed ? this.getSafeOutput(outputGuard, rawOutput) : outputGuard.safeText ?? outputGuard.redactedText ?? outputBlockedResponse,
            inputGuard,
            outputGuard,
            latencyMs: Date.now() - startedAt,
        };
    }
    async secureChat(input) {
        const blocked = input.blockedResponse ?? "This request was blocked for security reasons.";
        const result = await this.protectChat({
            message: input.message,
            userId: input.userId,
            sessionId: input.sessionId,
            metadata: input.metadata,
            blockedResponse: blocked,
            callLLM: (safeInput, context) => input.callLLM({
                safeInput,
                original: context.originalMessage,
                inputResult: context.inputGuard,
            }),
        });
        return {
            reply: result.safeResponse,
            blocked: result.blocked,
            inputResult: result.inputGuard,
            outputResult: result.outputGuard,
        };
    }
    createExpressMiddleware(options) {
        return async (req, res, next) => {
            try {
                const message = typeof req.body?.message === "string" ? req.body.message : "";
                if (!message.trim())
                    return res.status(400).json({ error: true, message: "message is required." });
                const result = await this.protectChat({
                    ...options,
                    message,
                    userId: typeof req.body?.userId === "string" ? req.body.userId : undefined,
                    sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined,
                    metadata: asMetadata(req.body?.metadata),
                });
                return res.status(200).json(result);
            }
            catch (caught) {
                if (next)
                    return next(caught);
                const status = caught.status ?? 500;
                return res.status(status).json({ error: true, message: caught instanceof Error ? caught.message : "CyberRakshak request failed." });
            }
        };
    }
    createNextHandler(options) {
        return async (request) => {
            let body;
            try {
                body = await request.json();
            }
            catch {
                return jsonResponse({ error: true, message: "Request body must be valid JSON." }, 400);
            }
            const parsed = body && typeof body === "object" ? body : {};
            const message = typeof parsed.message === "string" ? parsed.message : "";
            if (!message.trim())
                return jsonResponse({ error: true, message: "message is required." }, 400);
            try {
                const result = await this.protectChat({
                    ...options,
                    message,
                    userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
                    sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
                    metadata: asMetadata(parsed.metadata),
                });
                return jsonResponse(result, 200);
            }
            catch (caught) {
                const status = caught.status ?? 500;
                return jsonResponse({ error: true, message: caught instanceof Error ? caught.message : "CyberRakshak request failed." }, status);
            }
        };
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
        const response = await this.fetchWithNetworkRetry(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body ?? {}),
            signal: controller.signal,
        }).finally(() => clearTimeout(timer));
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
    async fetchWithNetworkRetry(url, init) {
        let attempt = 0;
        for (;;) {
            try {
                return await this.fetchImpl(url, init);
            }
            catch (caught) {
                if (attempt >= this.maxRetries) {
                    throw new errors_1.CyberRakshakNetworkError(caught instanceof Error ? caught.message : "Network request failed.", caught);
                }
                attempt += 1;
                await delay(this.retryBackoffMs * attempt);
            }
        }
    }
}
exports.GuardClient = GuardClient;
function asMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const metadata = {};
    for (const [key, raw] of Object.entries(value)) {
        if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" || raw === null)
            metadata[key] = raw;
    }
    return metadata;
}
function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
