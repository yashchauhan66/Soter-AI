import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
    ApprovalStore,
    DecisionEngine,
    MemoryStore,
    createApprovalGrant,
    generateSafeModePolicy,
    messagesToForward,
    redactForSharing,
    scanBrokerRequest,
    scanBrokerResponse,
    shouldForward,
    type ApprovalScope,
    type BrokerMessage,
    type Canary,
    type GuardAction,
    type MemoryEvent,
    type MemoryEventKind,
    type MemorySource,
    type SafeModeLevel,
} from "@soterai/guard-core";
import { tokenMatches } from "./auth";

export const BROKER_VERSION = "0.1.0";
export const DEFAULT_BROKER_PORT = 47321;
export const BROKER_HOST = "127.0.0.1" as const;

export interface SafeBrokerEvent {
    eventId: string;
    sessionId?: string;
    timestamp: string;
    source: "broker";
    eventType: string;
    decision: GuardAction;
    riskScore: number;
    categories: string[];
    redactedEvidence?: string;
    contentHash?: string;
    responseHash?: string;
    model?: string;
    provider?: string;
    safeMode: boolean;
    policyVersion: string;
}

export interface BrokerServerOptions {
    token: string;
    port?: number;
    bodyLimitBytes?: number;
    requestTimeoutMs?: number;
    rateLimitPerMinute?: number;
    allowedOrigins?: string[];
    openAIProviderUrl?: string;
    anthropicProviderUrl?: string;
    providerApiKey?: string;
    fetchImpl?: typeof fetch;
    logger?: (message: string, metadata?: Record<string, unknown>) => void;
    canaries?: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>;
}

interface JsonBody { [key: string]: unknown }

class HttpError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
    }
}

export class BrokerServer {
    private readonly server: Server;
    private readonly engine = new DecisionEngine();
    private readonly memory = new MemoryStore();
    private readonly approvals = new ApprovalStore();
    private readonly events: SafeBrokerEvent[] = [];
    private readonly rateBuckets = new Map<string, { minute: number; count: number }>();
    private safeMode = { enabled: false, level: "developer" as SafeModeLevel };
    private startedAt?: string;

    constructor(private readonly options: BrokerServerOptions) {
        if (!options.token || options.token.length < 32) throw new Error("A broker auth token of at least 32 characters is required");
        this.server = createServer((req, res) => void this.handle(req, res));
        this.server.requestTimeout = options.requestTimeoutMs ?? 30_000;
        this.server.headersTimeout = Math.min(this.server.requestTimeout, 15_000);
    }

    async start(): Promise<{ host: typeof BROKER_HOST; port: number; url: string }> {
        if (this.server.listening) return this.address();
        const port = this.options.port ?? DEFAULT_BROKER_PORT;
        await new Promise<void>((resolve, reject) => {
            const onError = (error: Error) => { this.server.off("listening", onListening); reject(error); };
            const onListening = () => { this.server.off("error", onError); resolve(); };
            this.server.once("error", onError);
            this.server.once("listening", onListening);
            this.server.listen(port, BROKER_HOST);
        });
        this.startedAt = new Date().toISOString();
        this.safeLog("broker_started", { host: BROKER_HOST, port: this.address().port });
        return this.address();
    }

    async stop(): Promise<void> {
        if (!this.server.listening) return;
        await new Promise<void>((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
    }

    address(): { host: typeof BROKER_HOST; port: number; url: string } {
        const address = this.server.address();
        const port = typeof address === "object" && address ? address.port : (this.options.port ?? DEFAULT_BROKER_PORT);
        return { host: BROKER_HOST, port, url: `http://${BROKER_HOST}:${port}` };
    }

    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const requestId = randomUUID();
        try {
            this.applySecurityHeaders(res);
            this.enforceOrigin(req);
            this.enforceRateLimit(req);
            const url = new URL(req.url ?? "/", `http://${BROKER_HOST}`);
            if (req.method === "OPTIONS") throw new HttpError(405, "cors_disabled", "Browser cross-origin requests are disabled");

            if (req.method === "GET" && url.pathname === "/health") {
                return this.json(res, 200, { status: "ok", localOnly: true, host: BROKER_HOST, startedAt: this.startedAt });
            }
            if (!tokenMatches(req.headers.authorization, this.options.token)) {
                throw new HttpError(401, "unauthorized", "A valid local broker bearer token is required");
            }

            if (req.method === "GET" && url.pathname === "/version") {
                return this.json(res, 200, { name: "@soterai/local-ai-broker", version: BROKER_VERSION });
            }
            if (req.method === "GET" && url.pathname === "/v1/safe-mode/status") {
                return this.json(res, 200, { ...this.safeMode, rules: generateSafeModePolicy(this.safeMode.level).rules });
            }
            if (req.method === "GET" && url.pathname === "/v1/events/recent") {
                return this.json(res, 200, { events: this.events.slice(-100) });
            }
            if (req.method === "POST" && url.pathname === "/v1/events/export-redacted") {
                return this.json(res, 200, { generatedAt: new Date().toISOString(), events: this.events, memory: this.memory.exportRedacted() });
            }
            if (req.method === "GET" && url.pathname === "/v1/approvals") {
                return this.json(res, 200, { approvals: this.approvals.list() });
            }
            const memoryMatch = url.pathname.match(/^\/v1\/memory\/session\/([^/]+)$/);
            if (req.method === "GET" && memoryMatch) {
                const session = this.memory.getSession(decodeURIComponent(memoryMatch[1]));
                if (!session) throw new HttpError(404, "session_not_found", "Memory session not found");
                return this.json(res, 200, { session });
            }

            const body = await this.readJson(req);
            if (req.method === "POST" && url.pathname === "/v1/scan") return void await this.scanEndpoint(res, body);
            if (req.method === "POST" && url.pathname === "/v1/redact") return this.redactEndpoint(res, body);
            if (req.method === "POST" && url.pathname === "/v1/decision") return void await this.scanEndpoint(res, body);
            if (req.method === "POST" && url.pathname === "/v1/safe-mode/enable") return this.enableSafeMode(res, body);
            if (req.method === "POST" && url.pathname === "/v1/safe-mode/disable") return this.disableSafeMode(res);
            if (req.method === "POST" && url.pathname === "/v1/memory/session/start") return this.startMemory(res, body);
            if (req.method === "POST" && url.pathname === "/v1/memory/session/event") return this.addMemoryEvent(res, body);
            if (req.method === "POST" && url.pathname === "/v1/memory/session/end") return this.endMemory(res, body);
            if (req.method === "POST" && url.pathname === "/v1/memory/session/clear") return this.clearMemory(res, body);
            if (req.method === "POST" && url.pathname === "/v1/approvals") return void await this.createApproval(res, body);
            if (req.method === "POST" && url.pathname === "/v1/approvals/clear") { this.approvals.clear(); return this.json(res, 200, { cleared: true }); }
            if (req.method === "POST" && url.pathname === "/v1/auth/rotate") return this.rotateAuth(res, body);
            if (req.method === "POST" && url.pathname === "/v1/ai/openai-compatible/chat/completions") {
                return void await this.proxyOpenAI(res, body, req);
            }
            if (req.method === "POST" && url.pathname === "/v1/ai/anthropic-compatible/messages") {
                return void await this.proxyAnthropic(res, body, req);
            }
            throw new HttpError(404, "not_found", "Endpoint not found");
        } catch (error) {
            const status = error instanceof HttpError ? error.status : 500;
            const code = error instanceof HttpError ? error.code : "internal_error";
            const message = error instanceof HttpError ? error.message : "The local broker could not complete the request";
            this.safeLog("request_failed", { requestId, status, code });
            if (!res.headersSent) this.json(res, status, { error: { code, message, requestId } });
            else res.end();
        }
    }

    private async scanEndpoint(res: ServerResponse, body: JsonBody): Promise<void> {
        const messages = normalizeMessages(body.messages ?? [{ role: "user", content: body.content }]);
        const result = await scanBrokerRequest(messages, { engine: this.engine, safeMode: this.safeMode, canaries: this.options.canaries });
        this.record({ eventType: "broker_request_scanned", decision: result.decision, riskScore: result.riskScore, categories: result.categories, contentHash: result.contentHash, redactedEvidence: result.evidencePreview });
        this.json(res, 200, safeRequestResult(result));
    }

    private redactEndpoint(res: ServerResponse, body: JsonBody): void {
        if (typeof body.content !== "string") throw new HttpError(400, "invalid_request", "content must be a string");
        this.json(res, 200, { redacted: redactForSharing(body.content), contentHashPending: false });
    }

    private enableSafeMode(res: ServerResponse, body: JsonBody): void {
        const level = parseSafeModeLevel(body.level);
        this.safeMode = { enabled: true, level };
        this.record({ eventType: "safe_mode_enabled", decision: "allow", riskScore: 0, categories: [level] });
        this.json(res, 200, { ...this.safeMode, rules: generateSafeModePolicy(level).rules });
    }

    private disableSafeMode(res: ServerResponse): void {
        this.safeMode = { ...this.safeMode, enabled: false };
        this.record({ eventType: "safe_mode_disabled", decision: "allow", riskScore: 0, categories: [] });
        this.json(res, 200, this.safeMode);
    }

    private startMemory(res: ServerResponse, body: JsonBody): void {
        const sessionId = stringValue(body.sessionId) ?? randomUUID();
        const session = this.memory.startSession({ sessionId, source: "broker", tool: stringValue(body.tool), provider: stringValue(body.provider) });
        this.record({ sessionId, eventType: "memory_session_started", decision: "allow", riskScore: 0, categories: [] });
        this.json(res, 201, { session });
    }

    private addMemoryEvent(res: ServerResponse, body: JsonBody): void {
        const sessionId = requireString(body.sessionId, "sessionId");
        const input = body.event;
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "invalid_request", "event must be an object");
        const event = input as Partial<MemoryEvent>;
        const clean = this.memory.addEvent(sessionId, {
            eventId: stringValue(event.eventId) ?? randomUUID(),
            timestamp: stringValue(event.timestamp) ?? new Date().toISOString(),
            kind: (stringValue(event.kind) ?? "broker_request_scanned") as MemoryEventKind,
            source: parseMemorySource(event.source),
            decision: parseAction(event.decision),
            riskScore: numberValue(event.riskScore),
            categories: stringArray(event.categories),
            redactedEvidence: stringValue(event.redactedEvidence),
            requestHash: stringValue(event.requestHash),
            responseHash: stringValue(event.responseHash),
            filePaths: stringArray(event.filePaths),
            protectedFileAttempt: Boolean(event.protectedFileAttempt),
            canaryExposed: Boolean(event.canaryExposed),
            model: stringValue(event.model),
            provider: stringValue(event.provider),
            contentSize: numberValue(event.contentSize),
        });
        this.json(res, 201, { event: clean });
    }

    private endMemory(res: ServerResponse, body: JsonBody): void {
        const sessionId = requireString(body.sessionId, "sessionId");
        const session = this.memory.endSession(sessionId);
        if (!session) throw new HttpError(404, "session_not_found", "Memory session not found");
        this.record({ sessionId, eventType: "memory_session_ended", decision: "allow", riskScore: 0, categories: [] });
        this.json(res, 200, { session });
    }

    private clearMemory(res: ServerResponse, body: JsonBody): void {
        const sessionId = stringValue(body.sessionId);
        if (sessionId) this.memory.clearSession(sessionId); else this.memory.clearAll();
        this.json(res, 200, { cleared: true });
    }

    private async createApproval(res: ServerResponse, body: JsonBody): Promise<void> {
        const scope = (stringValue(body.scope) ?? "once") as ApprovalScope;
        if (!(["once", "session", "workspace"] as string[]).includes(scope)) throw new HttpError(400, "invalid_scope", "scope must be once, session, or workspace");
        const grant = await createApprovalGrant({
            sessionId: requireString(body.sessionId, "sessionId"),
            contentHash: requireString(body.contentHash, "contentHash"),
            decision: "approval_required",
            outcome: body.outcome === "redact_and_allow" ? "redact_and_allow" : body.outcome === "deny" ? "deny" : "approve",
            scope,
        });
        this.approvals.add(grant);
        this.record({ sessionId: grant.sessionId, eventType: grant.outcome === "deny" ? "approval_denied" : "approval_granted", decision: grant.outcome === "deny" ? "block" : "allow", riskScore: 0, categories: [], contentHash: grant.contentHash });
        this.json(res, 201, { approval: this.approvals.list().find((item) => item.id === grant.id) });
    }

    private rotateAuth(res: ServerResponse, body: JsonBody): void {
        const next = requireString(body.token, "token");
        if (next.length < 32) throw new HttpError(400, "weak_token", "The replacement token must be at least 32 characters");
        this.options.token = next;
        this.json(res, 200, { rotated: true });
    }

    private async proxyOpenAI(res: ServerResponse, body: JsonBody, req: IncomingMessage): Promise<void> {
        if (body.stream === true) throw new HttpError(400, "streaming_not_supported", "Streaming proxy responses are not supported in this MVP");
        const messages = normalizeMessages(body.messages);
        const sessionId = stringValue(body.session_id) ?? stringValue(req.headers["x-soterai-session-id"]) ?? randomUUID();
        const model = stringValue(body.model);
        const scan = await scanBrokerRequest(messages, { engine: this.engine, safeMode: this.safeMode, canaries: this.options.canaries });
        const approved = this.approvals.consume(sessionId, scan.contentHash);
        this.recordRequestMemory(sessionId, scan, model, "openai-compatible");
        if (!scan.safe || !shouldForward(scan.decision, approved)) {
            this.record({ sessionId, eventType: "broker_request_blocked", decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, contentHash: scan.contentHash, model, provider: "openai-compatible", redactedEvidence: scan.evidencePreview });
            throw new HttpError(scan.decision === "approval_required" ? 403 : 422, scan.decision, scan.decision === "approval_required" ? "Local approval is required for this content hash" : "The request was blocked by local policy");
        }
        const forward = { ...body, messages: messagesToForward(scan.redacted ? "redact" : scan.decision, messages, scan.redactedMessages) };
        const provider = await this.forwardProvider("openai", forward, req);
        const responseText = extractOpenAIResponse(provider.body);
        const responseScan = await scanBrokerResponse(responseText, { canaries: this.options.canaries });
        this.recordResponseMemory(sessionId, responseScan, model, "openai-compatible");
        if (responseScan.decision === "block") throw new HttpError(422, "unsafe_provider_response", "The provider response was blocked by local output protection");
        res.setHeader("x-soterai-request-decision", scan.decision);
        res.setHeader("x-soterai-response-decision", responseScan.decision);
        this.json(res, provider.status, provider.body);
    }

    private async proxyAnthropic(res: ServerResponse, body: JsonBody, req: IncomingMessage): Promise<void> {
        if (body.stream === true) throw new HttpError(400, "streaming_not_supported", "Streaming proxy responses are not supported in this MVP");
        const system = typeof body.system === "string" ? [{ role: "system", content: body.system }] : [];
        const messages = [...system, ...normalizeMessages(body.messages)];
        const sessionId = stringValue(body.session_id) ?? stringValue(req.headers["x-soterai-session-id"]) ?? randomUUID();
        const model = stringValue(body.model);
        const scan = await scanBrokerRequest(messages, { engine: this.engine, safeMode: this.safeMode, canaries: this.options.canaries });
        const approved = this.approvals.consume(sessionId, scan.contentHash);
        this.recordRequestMemory(sessionId, scan, model, "anthropic-compatible");
        if (!scan.safe || !shouldForward(scan.decision, approved)) {
            throw new HttpError(scan.decision === "approval_required" ? 403 : 422, scan.decision, "The request was blocked by local policy");
        }
        const forwarded = messagesToForward(scan.redacted ? "redact" : scan.decision, messages, scan.redactedMessages);
        const forward = { ...body, system: forwarded.find((m) => m.role === "system")?.content, messages: forwarded.filter((m) => m.role !== "system") };
        const provider = await this.forwardProvider("anthropic", forward, req);
        const responseText = extractAnthropicResponse(provider.body);
        const responseScan = await scanBrokerResponse(responseText, { canaries: this.options.canaries });
        this.recordResponseMemory(sessionId, responseScan, model, "anthropic-compatible");
        if (responseScan.decision === "block") throw new HttpError(422, "unsafe_provider_response", "The provider response was blocked by local output protection");
        res.setHeader("x-soterai-request-decision", scan.decision);
        res.setHeader("x-soterai-response-decision", responseScan.decision);
        this.json(res, provider.status, provider.body);
    }

    private async forwardProvider(kind: "openai" | "anthropic", body: JsonBody, req: IncomingMessage): Promise<{ status: number; body: JsonBody }> {
        const target = kind === "openai" ? this.options.openAIProviderUrl : this.options.anthropicProviderUrl;
        if (!target) throw new HttpError(503, "provider_not_configured", `${kind} provider routing is not configured`);
        const apiKey = this.options.providerApiKey ?? stringValue(req.headers["x-soterai-provider-key"]);
        if (!apiKey) throw new HttpError(401, "provider_key_required", "A local provider key is required");
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (kind === "openai") headers.authorization = `Bearer ${apiKey}`;
        else { headers["x-api-key"] = apiKey; headers["anthropic-version"] = stringValue(req.headers["anthropic-version"]) ?? "2023-06-01"; }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs ?? 30_000);
        try {
            const response = await (this.options.fetchImpl ?? fetch)(target, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
            const parsed = await response.json() as JsonBody;
            return { status: response.status, body: parsed };
        } catch {
            throw new HttpError(502, "provider_error", "The configured provider could not be reached or returned invalid JSON");
        } finally { clearTimeout(timeout); }
    }

    private recordRequestMemory(sessionId: string, scan: Awaited<ReturnType<typeof scanBrokerRequest>>, model: string | undefined, provider: string): void {
        if (!this.memory.getSession(sessionId)) this.memory.startSession({ sessionId, source: "broker", provider });
        const kind: MemoryEventKind = scan.decision === "block" ? "broker_request_blocked" : scan.redacted ? "broker_request_redacted" : "broker_request_scanned";
        this.memory.addEvent(sessionId, { eventId: randomUUID(), timestamp: new Date().toISOString(), kind, source: "broker", decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, redactedEvidence: scan.evidencePreview, requestHash: scan.contentHash, model, provider, contentSize: 0 });
        this.record({ sessionId, eventType: kind, decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, contentHash: scan.contentHash, model, provider, redactedEvidence: scan.evidencePreview });
    }

    private recordResponseMemory(sessionId: string, scan: Awaited<ReturnType<typeof scanBrokerResponse>>, model: string | undefined, provider: string): void {
        const kind: MemoryEventKind = scan.canaryLeaked ? "broker_response_leak_detected" : "broker_response_scanned";
        this.memory.addEvent(sessionId, { eventId: randomUUID(), timestamp: new Date().toISOString(), kind, source: "broker", decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, redactedEvidence: scan.evidencePreview, responseHash: scan.contentHash, canaryExposed: scan.canaryLeaked, model, provider, contentSize: 0 });
        this.record({ sessionId, eventType: kind, decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, responseHash: scan.contentHash, model, provider, redactedEvidence: scan.evidencePreview });
    }

    private record(input: Omit<SafeBrokerEvent, "eventId" | "timestamp" | "source" | "safeMode" | "policyVersion">): void {
        const event: SafeBrokerEvent = { eventId: randomUUID(), timestamp: new Date().toISOString(), source: "broker", safeMode: this.safeMode.enabled, policyVersion: `safe-mode-${this.safeMode.level}`, ...input, redactedEvidence: input.redactedEvidence ? redactForSharing(input.redactedEvidence) : undefined };
        this.events.push(event);
        if (this.events.length > 1000) this.events.shift();
    }

    private enforceOrigin(req: IncomingMessage): void {
        const origin = stringValue(req.headers.origin);
        if (!origin) return;
        if (!(this.options.allowedOrigins ?? []).includes(origin)) throw new HttpError(403, "origin_rejected", "Browser origins are rejected by default");
    }

    private enforceRateLimit(req: IncomingMessage): void {
        const key = req.socket.remoteAddress ?? "local";
        const minute = Math.floor(Date.now() / 60_000);
        const bucket = this.rateBuckets.get(key);
        if (!bucket || bucket.minute !== minute) { this.rateBuckets.set(key, { minute, count: 1 }); return; }
        bucket.count++;
        if (bucket.count > (this.options.rateLimitPerMinute ?? 120)) throw new HttpError(429, "rate_limited", "Local broker rate limit exceeded");
    }

    private async readJson(req: IncomingMessage): Promise<JsonBody> {
        const limit = this.options.bodyLimitBytes ?? 1_048_576;
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > limit) throw new HttpError(413, "body_too_large", "Request body exceeds the local broker limit");
            chunks.push(buffer);
        }
        if (chunks.length === 0) return {};
        try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
            return parsed as JsonBody;
        } catch { throw new HttpError(400, "invalid_json", "Request body must be a JSON object"); }
    }

    private applySecurityHeaders(res: ServerResponse): void {
        res.setHeader("cache-control", "no-store");
        res.setHeader("x-content-type-options", "nosniff");
        res.setHeader("content-security-policy", "default-src 'none'");
        res.setHeader("referrer-policy", "no-referrer");
    }

    private json(res: ServerResponse, status: number, body: unknown): void {
        res.statusCode = status;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify(body));
    }

    private safeLog(message: string, metadata: Record<string, unknown>): void {
        this.options.logger?.(message, metadata);
    }
}

function normalizeMessages(value: unknown): BrokerMessage[] {
    if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, "invalid_messages", "messages must be a non-empty array");
    return value.map((raw) => {
        if (!raw || typeof raw !== "object") throw new HttpError(400, "invalid_messages", "each message must be an object");
        const item = raw as Record<string, unknown>;
        const role = requireString(item.role, "message.role");
        let content: string;
        if (typeof item.content === "string") content = item.content;
        else if (Array.isArray(item.content)) content = item.content.map((part) => typeof part === "object" && part && typeof (part as Record<string, unknown>).text === "string" ? (part as Record<string, unknown>).text : "").join("\n");
        else throw new HttpError(400, "invalid_messages", "message.content must be text or text parts");
        return { role, content, name: stringValue(item.name) };
    });
}

function safeRequestResult(result: Awaited<ReturnType<typeof scanBrokerRequest>>): JsonBody {
    return { decision: result.decision, riskScore: result.riskScore, categories: result.categories, redactedMessages: result.redactedMessages, redacted: result.redacted, canaryInRequest: result.canaryInRequest, contentHash: result.contentHash, safe: result.safe, evidencePreview: result.evidencePreview };
}

function extractOpenAIResponse(body: JsonBody): string {
    const choices = body.choices;
    if (!Array.isArray(choices)) return "";
    return choices.map((choice) => choice && typeof choice === "object" ? stringValue((choice as Record<string, unknown>).message && ((choice as Record<string, unknown>).message as Record<string, unknown>).content) ?? "" : "").join("\n");
}

function extractAnthropicResponse(body: JsonBody): string {
    const content = body.content;
    if (!Array.isArray(content)) return "";
    return content.map((part) => part && typeof part === "object" ? stringValue((part as Record<string, unknown>).text) ?? "" : "").join("\n");
}

function parseSafeModeLevel(value: unknown): SafeModeLevel {
    return value === "strict" || value === "enterprise" ? value : "developer";
}

function parseAction(value: unknown): GuardAction {
    return value === "warn" || value === "redact" || value === "block" || value === "approval_required" ? value : "allow";
}

function parseMemorySource(value: unknown): MemorySource {
    const allowed: MemorySource[] = ["broker", "safe-context-builder", "scan-before-ai-prompt", "manual-output-scan", "git-scan", "terminal-check", "mcp-scan"];
    return typeof value === "string" && allowed.includes(value as MemorySource) ? value as MemorySource : "broker";
}

function stringValue(value: unknown): string | undefined {
    if (Array.isArray(value)) value = value[0];
    return typeof value === "string" ? value : undefined;
}
function requireString(value: unknown, field: string): string {
    const parsed = stringValue(value);
    if (!parsed) throw new HttpError(400, "invalid_request", `${field} must be a non-empty string`);
    return parsed;
}
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function numberValue(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
