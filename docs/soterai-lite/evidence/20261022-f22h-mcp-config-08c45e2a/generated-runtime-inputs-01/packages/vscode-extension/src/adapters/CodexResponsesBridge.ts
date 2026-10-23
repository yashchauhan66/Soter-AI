import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import { validSession } from "../agent/SafeReadProtocol";
import type { CodexCliConnection } from "./CodexCliAdapterPolicy";
interface Dependencies {
    enabled(): boolean; ready(signal: AbortSignal): Promise<boolean>;
    target: string; credential: string; session: string; fetchImpl?: typeof fetch;
}
/** Revocable native-only role in front of the owned broker's inspected route.
 * Native config never receives its internal shared broker credential. */
export class CodexResponsesBridge {
    #server: Server | undefined; #starting: Promise<CodexCliConnection> | undefined;
    #token = randomBytes(32).toString("hex"); #session = randomUUID(); #disposed = false;
    #active: AbortController | undefined; #sockets = new Set<Socket>();
    constructor(private readonly deps: Dependencies) {}
    private enabled(): boolean { try { return !this.#disposed && this.deps.enabled() === true; } catch { return false; } }
    rotate(): void { this.#token = randomBytes(32).toString("hex"); this.#session = randomUUID(); this.#active?.abort(); }
    private connection(): CodexCliConnection {
        const address = this.#server?.address(); if (!address || typeof address === "string") throw Error("Unavailable");
        return Object.freeze({ endpoint: "http://127.0.0.1:" + address.port + "/codex", token: this.#token, session: this.#session });
    }
    async start(): Promise<CodexCliConnection> {
        const target = new URL(this.deps.target);
        if (!this.enabled() || !validSession(this.deps.session) || typeof this.deps.credential !== "string" || this.deps.credential.length < 32
            || this.deps.credential.length > 256 || /[\x00-\x20\x7f]/.test(this.deps.credential)
            || target.href !== this.deps.target || target.protocol !== "http:" || target.hostname !== "127.0.0.1" || !target.port
            || target.pathname !== "/v1/ai/openai-responses/responses" || target.username || target.password || target.search || target.hash) throw Error("Unavailable");
        if (this.#starting) return this.#starting; if (this.#server?.listening) return this.connection();
        const server = createServer((req, res) => { void this.handle(req, res); }); this.#server = server;
        server.headersTimeout = 5000; server.requestTimeout = 8000; server.maxRequestsPerSocket = 1; server.maxConnections = 8;
        server.on("connection", socket => { this.#sockets.add(socket); socket.once("close", () => this.#sockets.delete(socket)); });
        server.on("clientError", (_e, socket) => socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"));
        this.#starting = new Promise((resolve, reject) => {
            server.once("error", () => reject(Error("Unavailable")));
            server.listen(0, "127.0.0.1", () => { if (!this.enabled()) { void this.dispose(); reject(Error("Unavailable")); } else resolve(this.connection()); });
        });
        try { return await this.#starting; } finally { this.#starting = undefined; }
    }
    async dispose(): Promise<void> {
        this.#disposed = true; this.rotate(); const server = this.#server; this.#server = undefined;
        for (const socket of this.#sockets) socket.destroy();
        if (server) await new Promise<void>(done => server.close(() => done()));
    }
    private body(req: IncomingMessage, signal: AbortSignal): Promise<string> {
        return new Promise((resolve, reject) => {
            let size = 0, settled = false; const chunks: Buffer[] = [];
            const cleanup = () => { clearTimeout(timer); req.off("data", data); req.off("end", end); req.off("error", fail); req.off("aborted", fail); signal.removeEventListener("abort", fail); };
            const fail = () => { if (settled) return; settled = true; cleanup(); req.resume(); reject(Error("Unavailable")); };
            const data = (b: Buffer) => { size += b.length; if (size > 131072 || chunks.length >= 4096) fail(); else chunks.push(Buffer.from(b)); };
            const end = () => { if (settled) return;
                try { if (req.rawTrailers.length || Object.keys(req.trailers).length) throw Error("Unavailable");
                    const canonical = decodeBoundedJson(Buffer.concat(chunks), { maxBytes: 131072 }).canonical;
                    settled = true; cleanup(); resolve(canonical);
                } catch { fail(); }
            };
            const timer = setTimeout(fail, 8000); timer.unref?.();
            req.on("data", data); req.once("end", end); req.once("error", fail); req.once("aborted", fail); signal.addEventListener("abort", fail, { once: true }); if (signal.aborted) fail();
        });
    }
    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const unavailable = () => { req.resume(); if (!res.destroyed && !res.writableEnded) { res.writeHead(503, { "content-type": "application/json", "cache-control": "no-store", connection: "close" }); res.end('{"error":{"code":"codex_route_unavailable"}}'); } };
        try {
            const expected = "Bearer " + this.#token, auth = req.headers.authorization;
            const duplicate = ["authorization", "host", "content-type"].some(key => req.rawHeaders.filter((_v, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === key).length !== 1);
            if (!this.enabled() || this.#active || req.method !== "POST" || req.url !== "/codex/responses" || duplicate || req.headers.origin !== undefined
                || req.headers["content-type"] !== "application/json" || req.headers["content-encoding"] !== undefined
                || req.headers.host !== "127.0.0.1:" + (this.#server?.address() as { port?: number } | null)?.port
                || typeof auth !== "string" || Buffer.byteLength(auth) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) { unavailable(); return; }
            const session = this.#session, controller = new AbortController(); this.#active = controller;
            const current = () => this.enabled() && session === this.#session && !controller.signal.aborted;
            const ready = async () => current() && await this.deps.ready(controller.signal) === true && current();
            const closed = () => { if (!res.writableFinished) controller.abort(); }; res.once("close", closed); req.once("aborted", closed);
            let cancel!: () => void;
            const cancelled = new Promise<undefined>(resolve => { cancel = () => resolve(undefined); controller.signal.addEventListener("abort", cancel, { once: true }); });
            const timer = setTimeout(() => controller.abort(), 35000); timer.unref?.();
            let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
            try {
                const work = (async () => {
                    const body = await this.body(req, controller.signal); if (!await ready()) return;
                    const response = await (this.deps.fetchImpl ?? fetch)(this.deps.target, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + this.deps.credential }, body, redirect: "error", signal: controller.signal });
                    if (!current() || !response.ok || !response.body || !/^text\/event-stream(?:[ \t]*;[ \t]*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? "")) { await response.body?.cancel(); return; }
                    reader = response.body.getReader(); const chunks: Buffer[] = []; let size = 0;
                    while (true) { const next = await reader.read(); if (next.done) break;
                        size += next.value.byteLength; if (!current() || size > 131072 || chunks.length >= 4096) return; chunks.push(Buffer.from(next.value)); }
                    if (!await ready()) return;
                    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
                })();
                const wire = await Promise.race([work, cancelled]);
                if (typeof wire !== "string" || !current()) unavailable();
                else { res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-soterai-stream-buffered": "1", connection: "close" }); res.end(wire); }
            } catch { unavailable(); }
            finally { clearTimeout(timer); res.off("close", closed); req.off("aborted", closed); controller.signal.removeEventListener("abort", cancel); if (this.#active === controller) this.#active = undefined;
                try { await reader?.cancel(); } catch { /* Owned broker already closed/aborted. */ } finally { reader?.releaseLock(); } }
        } catch { unavailable(); }
    }
}
