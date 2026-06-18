"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardClient = void 0;
exports.createClient = createClient;
exports.createAgentFirewallClient = createAgentFirewallClient;
exports.createCybersecurityGuardClient = createCybersecurityGuardClient;
const errors_1 = require("./errors");
const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_BACKOFF_MS = 250;
function createClient(options) {
    return new GuardClient(options);
}
function createAgentFirewallClient(options) {
    return new GuardClient(options);
}
function createCybersecurityGuardClient(options) {
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
                return res.status(status).json({ error: true, message: caught instanceof Error ? caught.message : "cybersecurityguard request failed." });
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
                return jsonResponse({ error: true, message: caught instanceof Error ? caught.message : "cybersecurityguard request failed." }, status);
            }
        };
    }
    startAgentSession(input) {
        return this.post("/api/agent/session/start", input, true);
    }
    checkAgentAction(input) {
        return this.post("/api/agent/action/check", input, true);
    }
    checkToolUse(input) {
        return this.post("/api/agent/tool/check", input, true);
    }
    checkDataLeak(input) {
        return this.post("/api/agent/data/check", input, true);
    }
    checkDataEgress(input) {
        return this.checkDataLeak(input);
    }
    checkAgentOutput(input) {
        return this.post("/api/agent/output/check", input, true);
    }
    resolveAgentApproval(input) {
        return this.post("/api/agent/approval/resolve", input, true);
    }
    scanMcpTools(input) {
        return this.post("/api/agent/mcp/scan", input, true);
    }
    checkBrowserForm(input) {
        return this.post("/api/agent/browser/form/check", input, true);
    }
    checkMemory(input) {
        return this.post("/api/agent/memory/check", input, true);
    }
    scoreRagDocument(input) {
        return this.post("/api/rag/document/trust-score", input, true);
    }
    createCanary(input) {
        return this.post("/api/canary/create", input, true);
    }
    checkCanaryLeak(input) {
        return this.post("/api/canary/check", input, true);
    }
    getAgentReplay(sessionId) {
        return this.get(`/api/agent/replay/${encodeURIComponent(sessionId)}`, true);
    }
    registerContextSource(input) {
        return this.post("/api/lineage/source/register", input, true);
    }
    checkContextFlow(input) {
        return this.post("/api/lineage/flow/check", input, true);
    }
    getLineageSession(sessionId) {
        return this.get(`/api/lineage/session/${encodeURIComponent(sessionId)}`, true);
    }
    listLineageIncidents(status) {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        return this.get(`/api/lineage/incidents${query}`, true);
    }
    simulateBlastRadius(input) {
        return this.post("/api/blast-radius/simulate", input, true);
    }
    runBlastRadiusScenario(input) {
        return this.post("/api/blast-radius/scenario", input, true);
    }
    checkMemoryPoisoning(input) {
        return this.post("/api/memory/check", input, true);
    }
    storeSafeMemory(input) {
        return this.post("/api/memory/store", input, true);
    }
    quarantineMemory(memoryRecordId) {
        return this.post(`/api/memory/${encodeURIComponent(memoryRecordId)}/quarantine`, {}, true);
    }
    registerMcpServer(input) {
        return this.post("/api/mcp/servers/register", input, true);
    }
    snapshotMcpTools(input) {
        return this.post("/api/mcp/tools/snapshot", input, true);
    }
    listMcpDrifts(status) {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        return this.get(`/api/mcp/drifts${query}`, true);
    }
    checkLegalBoundary(input) {
        return this.post("/api/legal-boundary/check", input, true);
    }
    wrapTool(context, executor) {
        return async (args) => {
            const content = context.content ?? JSON.stringify(args);
            const decision = await this.checkAgentAction({
                sessionId: context.sessionId,
                agentName: context.agentName,
                tool: context.tool,
                action: context.action,
                target: context.target,
                content,
                destination: context.destination,
                riskContext: context.riskContext,
                metadata: context.metadata,
            }).catch((caught) => {
                if (caught instanceof errors_1.CyberRakshakRateLimitError) {
                    return failClosedDecision("Agent Firewall rate limit hit. Do not execute the tool.", "HIGH");
                }
                if (caught instanceof errors_1.CyberRakshakNetworkError) {
                    return failClosedDecision("Agent Firewall unavailable. Fail-closed policy prevented tool execution.", "CRITICAL");
                }
                throw caught;
            });
            if (!shouldExecuteAgentDecision(decision)) {
                return { executed: false, decision };
            }
            const result = await executor(args, decision);
            return { executed: true, decision, result };
        };
    }
    wrapMcpTool(toolName, executor, defaults = {}) {
        return this.wrapTool({
            tool: `mcp.${toolName}`,
            action: defaults.action ?? "mcp_tool_call",
            ...defaults,
        }, executor);
    }
    createOpenClawAdapter(options) {
        return {
            beforeToolCall: (input) => this.checkAgentAction({
                ...input,
                sessionId: input.sessionId ?? options.sessionId,
                agentName: input.agentName ?? options.agentName ?? "openclaw",
            }),
        };
    }
    createLangChainToolWrapper(toolName, executor, defaults = {}) {
        return this.wrapTool({
            tool: `langchain.${toolName}`,
            action: defaults.action ?? "tool_call",
            ...defaults,
        }, executor);
    }
    createGenericChatbotWrapper(options) {
        return {
            guardInput: (message) => this.guardInput({ message, userId: undefined }),
            checkAction: (input) => this.checkAgentAction({
                ...input,
                sessionId: input.sessionId ?? options.sessionId,
                agentName: input.agentName ?? options.agentName ?? "chatbot",
            }),
            checkData: (input) => this.checkDataEgress({
                ...input,
                sessionId: input.sessionId ?? options.sessionId,
            }),
            guardOutput: (aiResponse) => this.guardOutput({ aiResponse }),
        };
    }
    createExpressAgentMiddleware() {
        return async (req, res, next) => {
            try {
                const body = req.body;
                const destination = body?.destination;
                const decision = await this.checkAgentAction({
                    sessionId: typeof body?.sessionId === "string" ? body.sessionId : undefined,
                    agentName: typeof body?.agentName === "string" ? body.agentName : undefined,
                    tool: typeof body?.tool === "string" ? body.tool : "unknown",
                    action: typeof body?.action === "string" ? body.action : "tool_call",
                    target: typeof body?.target === "string" ? body.target : undefined,
                    content: typeof body?.content === "string" ? body.content : undefined,
                    destination: isAgentDestination(destination) ? destination : "unknown",
                    metadata: asMetadata(body?.metadata),
                });
                return res.status(200).json(decision);
            }
            catch (caught) {
                if (next)
                    return next(caught);
                const status = caught.status ?? 500;
                return res.status(status).json({ error: true, message: caught instanceof Error ? caught.message : "Agent Firewall request failed." });
            }
        };
    }
    createNextAgentHandler() {
        return async (request) => {
            let body;
            try {
                body = await request.json();
            }
            catch {
                return jsonResponse({ error: true, message: "Request body must be valid JSON." }, 400);
            }
            const parsed = body && typeof body === "object" ? body : {};
            try {
                const decision = await this.checkAgentAction({
                    sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
                    agentName: typeof parsed.agentName === "string" ? parsed.agentName : undefined,
                    tool: typeof parsed.tool === "string" ? parsed.tool : "unknown",
                    action: typeof parsed.action === "string" ? parsed.action : "tool_call",
                    target: typeof parsed.target === "string" ? parsed.target : undefined,
                    content: typeof parsed.content === "string" ? parsed.content : undefined,
                    destination: isAgentDestination(parsed.destination) ? parsed.destination : "unknown",
                    metadata: asMetadata(parsed.metadata),
                });
                return jsonResponse(decision, 200);
            }
            catch (caught) {
                const status = caught.status ?? 500;
                return jsonResponse({ error: true, message: caught instanceof Error ? caught.message : "Agent Firewall request failed." }, status);
            }
        };
    }
    async post(path, body, requireApiKey) {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const headers = {
            "Content-Type": "application/json",
            "User-Agent": "cybersecurityguard-sdk/0.1",
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
        return this.handleResponse(response);
    }
    async get(path, requireApiKey) {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const headers = {
            "User-Agent": "cybersecurityguard-sdk/0.1",
            ...this.extraHeaders,
        };
        if (requireApiKey)
            headers["x-api-key"] = this.apiKey;
        const response = await this.fetchWithNetworkRetry(url, {
            method: "GET",
            headers,
            signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        return this.handleResponse(response);
    }
    async handleResponse(response) {
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
function shouldExecuteAgentDecision(decision) {
    return decision.decision === "ALLOW" || decision.decision === "READ_ONLY" || decision.decision === "REDACT";
}
function failClosedDecision(reason, riskLevel) {
    return {
        decision: "BLOCK",
        riskLevel,
        reason,
        redactions: [],
        policyMatches: [{ id: "sdk.fail_closed", label: reason, severity: riskLevel }],
    };
}
function isAgentDestination(value) {
    return value === "external" || value === "internal" || value === "local" || value === "unknown";
}
