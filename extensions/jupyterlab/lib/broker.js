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
export class BrokerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BrokerError';
    }
}
const REQUEST_TIMEOUT_MS = 10000;
export class BrokerClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    /** GET /health — the only unauthenticated endpoint. */
    async health() {
        try {
            const response = await this.raw('GET', '/health', undefined, false);
            return { healthy: response.ok };
        }
        catch {
            return { healthy: false };
        }
    }
    /** GET /v1/safe-mode/status */
    async safeModeStatus() {
        return this.json('GET', '/v1/safe-mode/status');
    }
    /** POST /v1/scan { content } */
    async scan(content) {
        return this.json('POST', '/v1/scan', { content });
    }
    /**
     * POST /v1/scan { messages } — for prompt-shaped payloads (safe prompt check).
     */
    async scanMessages(messages) {
        return this.json('POST', '/v1/scan', { messages });
    }
    /** POST /v1/redact { content } -> { redacted } */
    async redact(content) {
        return this.json('POST', '/v1/redact', { content });
    }
    async json(method, path, body) {
        const response = await this.raw(method, path, body, true);
        const text = await response.text();
        const parsed = text ? JSON.parse(text) : {};
        if (!response.ok) {
            const message = parsed.error?.message ??
                `Local broker request failed (${response.status})`;
            throw new BrokerError(message);
        }
        return parsed;
    }
    async raw(method, path, body, authenticated) {
        const headers = { Accept: 'application/json' };
        if (authenticated) {
            const auth = await this.transport.authorization();
            if (auth) {
                headers['Authorization'] = auth;
            }
            // When `auth` is null, a same-host server-extension proxy is expected to
            // attach the real broker token; the browser never sees it.
        }
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            return await fetch(`${this.transport.baseUrl()}${path}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller.signal
            });
        }
        catch (err) {
            throw new BrokerError(`Cannot reach the Local AI Broker at ${this.transport.baseUrl()} ` +
                `(is it running on this host?)`);
        }
        finally {
            clearTimeout(timer);
        }
    }
}
/**
 * Local-only transport. Suitable when JupyterLab runs on the same machine as
 * the broker (classic desktop `jupyter lab`). NOT suitable for remote/hosted
 * Jupyter — use the server-extension proxy transport there instead.
 *
 * The token getter is injected; in the scaffold it reads a settings value the
 * user pastes in, which the plan flags as the weaker option versus the proxy.
 */
export class LocalLoopbackTransport {
    port;
    tokenGetter;
    constructor(port, tokenGetter) {
        this.port = port;
        this.tokenGetter = tokenGetter;
    }
    baseUrl() {
        return `http://127.0.0.1:${this.port()}`;
    }
    async authorization() {
        const token = await this.tokenGetter();
        return token ? `Bearer ${token}` : null;
    }
}
/**
 * Server-proxy transport (recommended). Points at a same-host Jupyter server
 * extension route which attaches the real broker token server-side. The browser
 * holds no long-lived secret.
 */
export class ServerProxyTransport {
    baseRoute;
    constructor(baseRoute = '/soterai/broker') {
        this.baseRoute = baseRoute;
    }
    baseUrl() {
        return this.baseRoute;
    }
    async authorization() {
        return null; // server extension injects the broker token
    }
}
//# sourceMappingURL=broker.js.map