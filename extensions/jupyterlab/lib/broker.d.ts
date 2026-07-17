/**
 * Fetch-based client for the SoterAI Local AI Broker.
 *
 * PLANNED / UNBUILT. Thin transport only: it maps 1:1 onto the broker HTTP
 * contract and performs NO detection, scoring, or redaction of its own. All of
 * that lives in the broker. The bearer token is never logged.
 *
 * Token/topology caveat (see docs/jupyterlab-extension-plan.md): a browser is
 * not a safe place to hold a long-lived broker token, and a remote Jupyter
 * server cannot reach a developer's `127.0.0.1` broker. The recommended real
 * build routes broker calls through a same-host Jupyter *server extension* that
 * reads `~/.soterai/broker/auth-token` and proxies to the loopback broker, so
 * the token never enters the browser. This client is written against that
 * proxy-or-local abstraction: you inject how the base URL and Authorization
 * header are resolved.
 */
export type BrokerDecision = 'allow' | 'warn' | 'redact' | 'block' | 'approval_required';
export interface ScanResult {
    decision: BrokerDecision | string;
    riskScore: number;
    categories: string[];
    redacted?: string;
    contentHash?: string;
    safe: boolean;
    /** Redacted, display-safe evidence. Never the raw scanned content. */
    evidencePreview?: string;
}
export interface RedactResult {
    redacted: string;
}
export interface SafeModeStatus {
    enabled: boolean;
    level?: string;
}
export interface BrokerHealth {
    healthy: boolean;
}
/**
 * Resolves transport details for each request. In the local-only variant this
 * returns the loopback URL and a bearer header. In the recommended server-proxy
 * variant it returns the JupyterLab server route and relies on the server
 * extension to attach the real broker token (kept out of the browser).
 */
export interface BrokerTransport {
    /** Base URL, e.g. `http://127.0.0.1:47321` or `/soterai/broker`. */
    baseUrl(): string;
    /**
     * Authorization header value for authenticated calls, or `null` when the
     * server proxy injects it. Reading it may be async (secret lookup).
     */
    authorization(): Promise<string | null>;
}
export declare class BrokerError extends Error {
    constructor(message: string);
}
export declare class BrokerClient {
    private readonly transport;
    constructor(transport: BrokerTransport);
    /** GET /health — the only unauthenticated endpoint. */
    health(): Promise<BrokerHealth>;
    /** GET /v1/safe-mode/status */
    safeModeStatus(): Promise<SafeModeStatus>;
    /** POST /v1/scan { content } */
    scan(content: string): Promise<ScanResult>;
    /**
     * POST /v1/scan { messages } — for prompt-shaped payloads (safe prompt check).
     */
    scanMessages(messages: Array<{
        role: string;
        content: string;
    }>): Promise<ScanResult>;
    /** POST /v1/redact { content } -> { redacted } */
    redact(content: string): Promise<RedactResult>;
    private json;
    private raw;
}
/**
 * Local-only transport. Suitable when JupyterLab runs on the same machine as
 * the broker (classic desktop `jupyter lab`). NOT suitable for remote/hosted
 * Jupyter — use the server-extension proxy transport there instead.
 *
 * The token getter is injected; in the scaffold it reads a settings value the
 * user pastes in, which the plan flags as the weaker option versus the proxy.
 */
export declare class LocalLoopbackTransport implements BrokerTransport {
    private readonly port;
    private readonly tokenGetter;
    constructor(port: () => number, tokenGetter: () => Promise<string | null>);
    baseUrl(): string;
    authorization(): Promise<string | null>;
}
/**
 * Server-proxy transport (recommended). Points at a same-host Jupyter server
 * extension route which attaches the real broker token server-side. The browser
 * holds no long-lived secret.
 */
export declare class ServerProxyTransport implements BrokerTransport {
    private readonly baseRoute;
    constructor(baseRoute?: string);
    baseUrl(): string;
    authorization(): Promise<string | null>;
}
