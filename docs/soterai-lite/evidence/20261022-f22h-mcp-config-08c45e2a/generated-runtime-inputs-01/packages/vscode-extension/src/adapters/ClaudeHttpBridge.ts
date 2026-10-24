import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Socket } from "node:net";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import { SAFE_READ_DEFINITION, SAFE_READ_TOOL, safeReadPath, safeReadResult } from "../agent/SafeReadProtocol";
import type { NativeClassification } from "../agent/SafeReadBridge";
import type { AccessResult } from "../project-privacy/ProjectFileAccess";
import { evaluateClaudeHook } from "./ClaudeHookProtocol";

export interface ClaudeConnection { hookUrl: string; hookToken: string; mcpUrl: string; mcpToken: string; session: string }
export interface ClaudeHttpDependencies {
    enabled(): boolean; workspace: string;
    ready(signal: AbortSignal): Promise<boolean>;
    classify(file: string, intent: "read" | "write", signal: AbortSignal): Promise<NativeClassification>;
    read(file: string, recipient: string, signal: AbortSignal): Promise<AccessResult>;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const empty = (value: unknown) => record(value) && !Object.keys(value).length;
function validCallMetadata(value: unknown): boolean {
    if (value === undefined) return true;
    if (!record(value) || !exact(value, ["progressToken", "claudecode/toolUseId"])) return false;
    const label = (item: unknown) => typeof item === "string" && !!item && Buffer.byteLength(item) <= 256 && !/[\x00-\x1f\x7f]/.test(item);
    return (value.progressToken === undefined || label(value.progressToken) || typeof value.progressToken === "number" && Number.isSafeInteger(value.progressToken) && value.progressToken >= 0)
        && (value["claudecode/toolUseId"] === undefined || label(value["claudecode/toolUseId"]));
}
/** Private stateless HTTP MCP and vendor hooks; not an OS or requester identity boundary. */
export class ClaudeHttpBridge {
    #server: Server | undefined;
    #starting: Promise<ClaudeConnection> | undefined;
    #hook = randomBytes(32).toString("hex");
    #mcp = randomBytes(32).toString("hex");
    #session = randomUUID();
    #active: AbortController | undefined;
    #disposed = false;
    #sockets = new Set<Socket>();
    #deps: ClaudeHttpDependencies;
    constructor(deps: ClaudeHttpDependencies) { this.#deps = deps; }
    private enabled(): boolean { try { return !this.#disposed && this.#deps.enabled() === true; } catch { return false; } }
    rotate(): void { this.#hook = randomBytes(32).toString("hex"); this.#mcp = randomBytes(32).toString("hex"); this.#session = randomUUID(); this.#active?.abort(); }
    private connection(): ClaudeConnection {
        const address = this.#server?.address(); if (!address || typeof address === "string") throw Error("Claude route unavailable.");
        const base = "http://127.0.0.1:" + address.port;
        return Object.freeze({ hookUrl: base + "/claude/hooks", hookToken: this.#hook, mcpUrl: base + "/claude/mcp", mcpToken: this.#mcp, session: this.#session });
    }
    async start(): Promise<ClaudeConnection> {
        if (!this.enabled()) throw Error("Claude route unavailable.");
        if (this.#starting) return this.#starting;
        if (this.#server?.listening) return this.connection();
        const server = createServer((req, res) => { void this.handle(req, res); }); this.#server = server;
        server.headersTimeout = 5000; server.requestTimeout = 8000; server.maxRequestsPerSocket = 1; server.maxConnections = 8;
        server.on("connection", socket => { this.#sockets.add(socket); socket.once("close", () => this.#sockets.delete(socket)); });
        server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"));
        this.#starting = new Promise((resolve, reject) => {
            server.once("error", () => reject(Error("Claude route unavailable.")));
            server.listen(0, "127.0.0.1", () => {
                if (!this.enabled()) { void this.dispose(); reject(Error("Claude route unavailable.")); return; }
                resolve(this.connection());
            });
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
            const fail = () => { if (settled) return; settled = true; cleanup(); req.resume(); reject(Error("Claude input unavailable.")); };
            const data = (part: Buffer) => { size += part.length; if (size > 65536) fail(); else chunks.push(Buffer.from(part)); };
            const end = () => { if (settled) return; settled = true; cleanup(); resolve(Buffer.concat(chunks)); };
            const timer = setTimeout(fail, 8000); timer.unref?.();
            req.on("data", data); req.once("end", end); req.once("error", fail); req.once("aborted", fail);
        });
        return decodeBoundedJson(bytes, { maxBytes: 65536, maxDepth: 12, maxNodes: 1024, maxStringBytes: 49152 }).body;
    }
    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const reply = (code: number, value?: unknown) => {
            if (res.destroyed || res.writableEnded) return;
            res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store", connection: "close" }); res.end(value === undefined ? "" : JSON.stringify(value));
        };
        const failure = () => reply(503, { error: "Managed Claude route unavailable." });
        try {
            const isHook = req.url === "/claude/hooks", isMcp = req.url === "/claude/mcp";
            const auth = req.headers.authorization, expected = "Bearer " + (isHook ? this.#hook : this.#mcp);
            const duplicate = ["authorization", "host", "content-type"].some(key => req.rawHeaders.filter((_v, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === key).length !== 1);
            if (!this.enabled() || req.method !== "POST" || !isHook && !isMcp || duplicate
                || req.headers.origin !== undefined || req.headers["content-type"] !== "application/json" || req.headers["content-encoding"] !== undefined
                || req.headers.host !== "127.0.0.1:" + (this.#server?.address() as { port?: number } | null)?.port
                || typeof auth !== "string" || Buffer.byteLength(auth) !== Buffer.byteLength(expected)
                || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) { req.resume(); failure(); return; }
            const session = this.#session, frame = await this.body(req);
            if (session !== this.#session || !this.enabled() || this.#active) { failure(); return; }
            const controller = new AbortController(); this.#active = controller;
            const current = () => this.enabled() && !controller.signal.aborted && session === this.#session;
            const ready = async () => current() && await this.#deps.ready(controller.signal) === true && current();
            const closed = () => { if (!res.writableFinished) controller.abort(); }; res.once("close", closed); req.once("aborted", closed);
            let cancel!: () => void;
            const cancellation = new Promise<undefined>(resolve => { cancel = () => resolve(undefined); controller.signal.addEventListener("abort", cancel, { once: true }); });
            const timer = setTimeout(() => controller.abort(), 65000); timer.unref?.();
            try {
                const work = isHook ? (async () => {
                    const result = await evaluateClaudeHook(frame, { workspace: this.#deps.workspace, ready,
                        classify: (file, intent) => this.#deps.classify(file, intent, controller.signal) });
                    return { code: result.status === "UNAVAILABLE" ? 503 : 200, body: result.status === "UNAVAILABLE" ? { error: "Managed Claude route unavailable." } : result.body };
                })() : this.rpc(frame, ready, controller.signal, session);
                const result = await Promise.race([work, cancellation]);
                if (!result || !current()) failure(); else reply(result.code, result.body);
            } catch { failure(); }
            finally { clearTimeout(timer); res.removeListener("close", closed); req.removeListener("aborted", closed); controller.signal.removeEventListener("abort", cancel); if (this.#active === controller) this.#active = undefined; }
        } catch { failure(); }
    }
    private async rpc(frame: Readonly<Record<string, unknown>>, ready: () => Promise<boolean>, signal: AbortSignal, session: string): Promise<{ code: number; body?: unknown }> {
        const id = frame.id;
        const error = (code = -32602) => ({ code: 200, body: { jsonrpc: "2.0", id: typeof id === "string" || typeof id === "number" ? id : null, error: { code, message: "Managed MCP request unavailable." } } });
        if (!exact(frame, ["jsonrpc", "id", "method", "params"]) || frame.jsonrpc !== "2.0" || typeof frame.method !== "string"
            || id !== undefined && !(typeof id === "number" && Number.isSafeInteger(id) || typeof id === "string" && id.length > 0 && id.length <= 64)
            || !record(frame.params ?? {}) || !await ready()) return error();
        const params = (frame.params ?? {}) as Record<string, unknown>;
        if (frame.method === "notifications/initialized") return id === undefined && empty(params) ? { code: 202 } : error();
        if (id === undefined) return error();
        const result = (value: unknown) => ({ code: 200, body: { jsonrpc: "2.0", id, result: value } });
        if (frame.method === "initialize") {
            if (!exact(params, ["protocolVersion", "capabilities", "clientInfo"]) || params.protocolVersion !== "2025-11-25" || !record(params.capabilities)
                || !record(params.clientInfo) || typeof params.clientInfo.name !== "string" || params.clientInfo.name.length > 256
                || typeof params.clientInfo.version !== "string" || params.clientInfo.version.length > 128) return error();
            return result({ protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "SoterAI approved safe reader", version: "1.0.0" } });
        }
        if (frame.method === "tools/list") return empty(params) ? result({ tools: [SAFE_READ_DEFINITION] }) : error();
        if (frame.method !== "tools/call") return error(-32601);
        const file = safeReadPath(params.arguments);
        // Native correlation metadata is bounded and ignored. It never reaches
        // the reader or supplies consent, a recipient or a caller identity.
        if (!exact(params, ["name", "arguments", "_meta"]) || params.name !== SAFE_READ_TOOL || !file || !validCallMetadata(params._meta)) return error();
        const released = safeReadResult(await this.#deps.read(file, "SoterAI Claude MCP session " + session.slice(0, 8) + " (requester identity unverified)", signal));
        if (signal.aborted || !await ready()) return error();
        return result({ content: [{ type: "text", text: JSON.stringify(released) }], ...(released.status === "ALLOWED_ONCE" ? {} : { isError: true }) });
    }
}
