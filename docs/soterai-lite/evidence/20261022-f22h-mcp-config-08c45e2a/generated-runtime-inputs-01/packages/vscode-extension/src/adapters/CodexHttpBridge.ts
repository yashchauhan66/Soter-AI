import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Socket } from "node:net";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import { SAFE_READ_DEFINITION, SAFE_READ_TOOL, safeReadPath, safeReadResult } from "../agent/SafeReadProtocol";
import type { AccessResult } from "../project-privacy/ProjectFileAccess";
import type { CodexCliConnection } from "./CodexCliAdapterPolicy";
export interface CodexHttpDependencies { enabled(): boolean; ready(signal: AbortSignal): Promise<boolean>; read(file: string, recipient: string, signal: AbortSignal): Promise<AccessResult> }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
const label = (v: unknown) => typeof v === "string" && !!v && Buffer.byteLength(v) <= 1024 && !/[\x00-\x1f\x7f]/.test(v);
function turnMetadata(value: unknown): boolean {
    const strings = ["session_id", "thread_id", "model", "turn_id", "thread_source", "turn_trigger", "sandbox", "sandbox_mode", "codex_version"];
    const booleans = ["auto_review_enabled", "node_repl_auto_review_required", "node_repl_disabled"];
    return record(value) && exact(value, [...strings, ...booleans, "turn_started_at_unix_ms"])
        && Object.entries(value).every(([key, v]) => strings.includes(key) ? label(v) : booleans.includes(key) ? typeof v === "boolean"
            : typeof v === "number" && Number.isSafeInteger(v) && v >= 0);
}
function metadata(v: unknown): boolean {
    if (v === undefined) return true;
    if (!record(v) || !exact(v, ["progressToken", "callId", "x-codex-turn-metadata", "threadId", "sessionId", "windowId", "itemId"])) return false;
    return Object.entries(v).every(([key, value]) => key === "x-codex-turn-metadata" ? turnMetadata(value) : key === "progressToken" && typeof value === "number"
        ? Number.isSafeInteger(value) && value >= 0
        : label(value));
}
/** One private HTTP MCP role, not an OS or native-provider-egress boundary. */
export class CodexHttpBridge {
    #server: Server | undefined; #starting: Promise<CodexCliConnection> | undefined;
    #token = randomBytes(32).toString("hex"); #session = randomUUID(); #disposed = false;
    #active: AbortController | undefined; #sockets = new Set<Socket>();
    constructor(private readonly deps: CodexHttpDependencies) {}
    private enabled(): boolean { try { return !this.#disposed && this.deps.enabled() === true; } catch { return false; } }
    rotate(): void { this.#token = randomBytes(32).toString("hex"); this.#session = randomUUID(); this.#active?.abort(); }
    private connection(): CodexCliConnection {
        const address = this.#server?.address(); if (!address || typeof address === "string") throw Error("Codex route unavailable.");
        return Object.freeze({ endpoint: "http://127.0.0.1:" + address.port + "/codex/mcp", token: this.#token, session: this.#session });
    }
    async start(): Promise<CodexCliConnection> {
        if (!this.enabled()) throw Error("Codex route unavailable.");
        if (this.#starting) return this.#starting; if (this.#server?.listening) return this.connection();
        const server = createServer((req, res) => { void this.handle(req, res); }); this.#server = server;
        server.headersTimeout = 5000; server.requestTimeout = 8000; server.maxRequestsPerSocket = 1; server.maxConnections = 8;
        server.on("connection", socket => { this.#sockets.add(socket); socket.once("close", () => this.#sockets.delete(socket)); });
        server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"));
        this.#starting = new Promise((resolve, reject) => {
            server.once("error", () => reject(Error("Codex route unavailable.")));
            server.listen(0, "127.0.0.1", () => { if (!this.enabled()) { void this.dispose(); reject(Error("Codex route unavailable.")); } else resolve(this.connection()); });
        });
        try { return await this.#starting; } finally { this.#starting = undefined; }
    }
    async dispose(): Promise<void> {
        this.#disposed = true; this.rotate(); const server = this.#server; this.#server = undefined;
        for (const socket of this.#sockets) socket.destroy();
        if (server) await new Promise<void>(done => server.close(() => done()));
    }
    private async body(req: IncomingMessage): Promise<Readonly<Record<string, unknown>>> {
        const bytes = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = []; let size = 0, settled = false;
            const cleanup = () => { clearTimeout(timer); req.removeListener("data", data); req.removeListener("end", end); req.removeListener("error", fail); req.removeListener("aborted", fail); };
            const fail = () => { if (settled) return; settled = true; cleanup(); req.resume(); reject(Error("Unavailable")); };
            const data = (b: Buffer) => { size += b.length; if (size > 65536) fail(); else chunks.push(Buffer.from(b)); };
            const end = () => { if (settled) return; settled = true; cleanup(); resolve(Buffer.concat(chunks)); };
            const timer = setTimeout(fail, 8000); timer.unref?.();
            req.on("data", data); req.once("end", end); req.once("error", fail); req.once("aborted", fail);
        });
        return decodeBoundedJson(bytes, { maxBytes: 65536, maxDepth: 12, maxNodes: 1024, maxStringBytes: 49152 }).body;
    }
    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const reply = (code: number, body?: unknown) => { if (res.destroyed || res.writableEnded) return;
            res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store", connection: "close" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
        const fail = () => reply(503, { error: "Managed Codex route unavailable." });
        try {
            const expected = "Bearer " + this.#token, auth = req.headers.authorization;
            const duplicate = ["authorization", "host", "content-type"].some(key => req.rawHeaders.filter((_v, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === key).length !== 1);
            if (!this.enabled() || req.method !== "POST" || req.url !== "/codex/mcp" || duplicate || req.headers.origin !== undefined
                || req.headers["content-type"] !== "application/json" || req.headers["content-encoding"] !== undefined
                || req.headers.host !== "127.0.0.1:" + (this.#server?.address() as { port?: number } | null)?.port
                || typeof auth !== "string" || Buffer.byteLength(auth) !== Buffer.byteLength(expected)
                || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) { req.resume(); fail(); return; }
            const session = this.#session, frame = await this.body(req);
            if (session !== this.#session || !this.enabled() || this.#active) { fail(); return; }
            const controller = new AbortController(); this.#active = controller;
            const current = () => this.enabled() && session === this.#session && !controller.signal.aborted;
            const ready = async () => current() && await this.deps.ready(controller.signal) === true && current();
            const closed = () => { if (!res.writableFinished) controller.abort(); }; res.once("close", closed); req.once("aborted", closed);
            let cancel!: () => void;
            const cancellation = new Promise<undefined>(resolve => { cancel = () => resolve(undefined); controller.signal.addEventListener("abort", cancel, { once: true }); });
            const timer = setTimeout(() => controller.abort(), 65000); timer.unref?.();
            try {
                const work = (async () => { if (!await ready()) return; return this.rpc(frame, ready, controller.signal, session); })();
                const result = await Promise.race([work, cancellation]);
                if (!result || !current()) fail(); else reply(result.code, result.body);
            } catch { fail(); }
            finally { clearTimeout(timer); res.removeListener("close", closed); req.removeListener("aborted", closed); controller.signal.removeEventListener("abort", cancel); if (this.#active === controller) this.#active = undefined; }
        } catch { fail(); }
    }
    private async rpc(frame: Readonly<Record<string, unknown>>, ready: () => Promise<boolean>, signal: AbortSignal, session: string): Promise<{ code: number; body?: unknown }> {
        const id = frame.id, error = (code = -32602) => ({ code: 200, body: { jsonrpc: "2.0", id: typeof id === "string" || typeof id === "number" ? id : null, error: { code, message: "Managed MCP request unavailable." } } });
        if (!exact(frame, ["jsonrpc", "id", "method", "params"]) || frame.jsonrpc !== "2.0" || typeof frame.method !== "string"
            || id !== undefined && !(typeof id === "number" && Number.isSafeInteger(id) || typeof id === "string" && !!id && id.length <= 64)
            || !record(frame.params ?? {})) return error();
        const params = (frame.params ?? {}) as Record<string, unknown>, result = (value: unknown) => ({ code: 200, body: { jsonrpc: "2.0", id, result: value } });
        if (frame.method === "notifications/initialized") return id === undefined && !Object.keys(params).length ? { code: 202 } : error();
        if (id === undefined) return error();
        if (frame.method === "initialize") {
            if (!exact(params, ["protocolVersion", "capabilities", "clientInfo"]) || params.protocolVersion !== "2025-06-18" || !record(params.capabilities)
                || !record(params.clientInfo) || typeof params.clientInfo.name !== "string" || !params.clientInfo.name || params.clientInfo.name.length > 256
                || typeof params.clientInfo.version !== "string" || !params.clientInfo.version || params.clientInfo.version.length > 128) return error();
            return result({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "SoterAI approved safe reader", version: "1.0.0" } });
        }
        if (frame.method === "tools/list") return exact(params, ["_meta"]) && metadata(params._meta) ? result({ tools: [SAFE_READ_DEFINITION] }) : error();
        if (frame.method !== "tools/call") return error(-32601);
        const file = safeReadPath(params.arguments);
        if (!exact(params, ["name", "arguments", "_meta"]) || params.name !== SAFE_READ_TOOL || !file || !metadata(params._meta) || !await ready()) return error();
        const released = safeReadResult(await this.deps.read(file, "SoterAI Codex MCP session " + session.slice(0, 8) + " (requester identity unverified)", signal));
        if (signal.aborted || !await ready()) return error();
        return result({ content: [{ type: "text", text: JSON.stringify(released) }], ...(released.status === "ALLOWED_ONCE" ? {} : { isError: true }) });
    }
}
