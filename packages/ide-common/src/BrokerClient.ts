import {
    DEFAULT_BROKER_URL,
    BrokerRoutes,
    type HealthResponse,
    type VersionResponse,
    type ScanRequest,
    type ScanResponse,
    type RedactResponse,
    type SafeModeStatusResponse,
    type SafeModeLevel,
    type RecentEventsResponse,
    type BrokerMessage,
    type NetworkEgressRequest,
    type NetworkEgressDecisionDto,
} from "@soterai/ide-protocol";

export interface BrokerClientOptions {
    /** Base URL of the loopback broker. Defaults to http://127.0.0.1:47321. */
    baseUrl?: string;
    /** Bearer token. Resolve via resolveBrokerToken() when not supplied. */
    token?: string;
    /** Injected for tests; defaults to global fetch. */
    fetchImpl?: typeof fetch;
    /** Per-request timeout. */
    timeoutMs?: number;
}

export class BrokerHttpError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
        this.name = "BrokerHttpError";
    }
}

/**
 * Minimal, dependency-free client for the Local AI Broker used by Node-based
 * adapters (VS Code, Visual Studio bridge, CLI). It refuses any non-loopback
 * base URL — the broker is local-first by contract and this client will not be
 * pointed at a remote host by accident.
 */
export class BrokerClient {
    private readonly baseUrl: string;
    private readonly token?: string;
    private readonly fetchImpl: typeof fetch;
    private readonly timeoutMs: number;

    constructor(options: BrokerClientOptions = {}) {
        this.baseUrl = (options.baseUrl ?? DEFAULT_BROKER_URL).replace(/\/$/, "");
        assertLoopback(this.baseUrl);
        this.token = options.token;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
        this.timeoutMs = options.timeoutMs ?? 10_000;
        if (!this.fetchImpl) throw new Error("global fetch is unavailable; pass fetchImpl");
    }

    /** GET /health — no auth. Returns true when the broker answers ok. */
    async isHealthy(): Promise<boolean> {
        try {
            const body = await this.call<HealthResponse>(BrokerRoutes.health, undefined, false);
            return body.status === "ok";
        } catch {
            return false;
        }
    }

    version(): Promise<VersionResponse> {
        return this.call<VersionResponse>(BrokerRoutes.version);
    }

    /** POST /v1/scan — send content or messages, get a redacted decision. */
    scan(request: ScanRequest): Promise<ScanResponse> {
        if (!request.content && !(request.messages && request.messages.length)) {
            throw new Error("scan() requires content or a non-empty messages array");
        }
        return this.call<ScanResponse>(BrokerRoutes.scan, request);
    }

    scanText(content: string): Promise<ScanResponse> {
        return this.scan({ content });
    }

    scanMessages(messages: BrokerMessage[]): Promise<ScanResponse> {
        return this.scan({ messages });
    }

    /** POST /v1/redact — returns redacted text safe to hand to AI. */
    async redact(content: string): Promise<string> {
        const body = await this.call<RedactResponse>(BrokerRoutes.redact, { content });
        return body.redacted;
    }

    safeModeStatus(): Promise<SafeModeStatusResponse> {
        return this.call<SafeModeStatusResponse>(BrokerRoutes.safeModeStatus);
    }

    enableSafeMode(level: SafeModeLevel = "developer"): Promise<SafeModeStatusResponse> {
        return this.call<SafeModeStatusResponse>(BrokerRoutes.safeModeEnable, { level });
    }

    disableSafeMode(): Promise<SafeModeStatusResponse> {
        return this.call<SafeModeStatusResponse>(BrokerRoutes.safeModeDisable, {});
    }

    recentEvents(): Promise<RecentEventsResponse> {
        return this.call<RecentEventsResponse>(BrokerRoutes.recentEvents);
    }

    /**
     * POST /v1/preflight/network-egress — decide whether text may be sent to a
     * destination host. This is the pre-send choke point; callers must honour
     * the returned action rather than treating any response as clearance (see
     * `egressAllowsSend`, which excludes ASK on purpose).
     */
    checkEgress(request: NetworkEgressRequest): Promise<NetworkEgressDecisionDto> {
        if (!request.url) throw new Error("checkEgress() requires a url");
        return this.call<NetworkEgressDecisionDto>(BrokerRoutes.networkEgress, request);
    }

    exportRedacted(): Promise<unknown> {
        return this.call<unknown>(BrokerRoutes.exportRedacted, {});
    }

    private async call<T>(
        route: { method: string; path: string; auth?: boolean },
        body?: unknown,
        authOverride?: boolean,
    ): Promise<T> {
        const needsAuth = authOverride ?? route.auth ?? true;
        const headers: Record<string, string> = { accept: "application/json" };
        if (needsAuth) {
            if (!this.token) throw new BrokerHttpError(401, "no_token", "Broker token is not configured");
            headers.authorization = `Bearer ${this.token}`;
        }
        if (body !== undefined) headers["content-type"] = "application/json";

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        let response: Response;
        try {
            response = await this.fetchImpl(this.baseUrl + route.path, {
                method: route.method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (error) {
            throw new BrokerHttpError(
                0,
                "unreachable",
                `Local AI Broker is not reachable at ${this.baseUrl}. Start it with "soterai broker start". (${
                    error instanceof Error ? error.message : "network error"
                })`,
            );
        } finally {
            clearTimeout(timer);
        }

        const text = await response.text();
        const parsed = text ? safeJsonParse(text) : {};
        if (!response.ok) {
            const err = (parsed as { error?: { code?: string; message?: string } }).error;
            throw new BrokerHttpError(
                response.status,
                err?.code ?? "http_error",
                err?.message ?? `Broker returned HTTP ${response.status}`,
            );
        }
        return parsed as T;
    }
}

function assertLoopback(baseUrl: string): void {
    let host: string;
    try {
        host = new URL(baseUrl).hostname;
    } catch {
        throw new Error(`Invalid broker base URL: ${baseUrl}`);
    }
    const loopback = host === "127.0.0.1" || host === "localhost" || host === "::1";
    if (!loopback) {
        throw new Error(
            `Refusing to use a non-loopback broker URL (${host}). The Local AI Broker is local-first by design.`,
        );
    }
}

function safeJsonParse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
}
