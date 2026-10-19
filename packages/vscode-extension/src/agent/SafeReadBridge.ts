import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { TextDecoder } from "node:util";
import type { Socket } from "node:net";
import * as path from "node:path";
import type { AccessResult } from "../project-privacy/ProjectFileAccess";
import { safeReadPath, safeReadResult, validSession, type SafeReadConnection } from "./SafeReadProtocol";

export type NativeClassification = "PUBLIC" | "RESTRICTED" | "UNAVAILABLE";
interface Dependencies {
    enabled(): boolean; read(file: string, recipient: string, signal: AbortSignal): Promise<AccessResult>;
    workspace?: string;
    ready?(signal: AbortSignal): Promise<boolean>;
    /** Adapter-owned bridge only; absent on the ordinary F17 MCP bridge. */
    classify?(file: string, intent: "read" | "write", signal: AbortSignal): Promise<NativeClassification>;
}
/** Private editor-owned cooperative route. Same-user processes are not isolated. */
export class SafeReadBridge {
    private server: Server | undefined;
    private starting: Promise<SafeReadConnection> | undefined;
    private token = randomBytes(32).toString("hex");
    private session = randomUUID();
    private active: AbortController | undefined;
    private disposed = false;
    private readonly sockets = new Set<Socket>();
    constructor(private readonly deps: Dependencies) {}
    private enabled(): boolean { try { return !this.disposed && this.deps.enabled() === true; } catch { return false; } }
    rotate(): void { this.token = randomBytes(32).toString("hex"); this.session = randomUUID(); this.active?.abort(); }
    async start(): Promise<SafeReadConnection> {
        if (!this.enabled()) throw new Error("Safe reader unavailable.");
        if (this.starting) return this.starting;
        if (this.server?.listening) return this.connection();
        const server = createServer((req, res) => { void this.handle(req, res); }); this.server = server;
        server.headersTimeout = 5000; server.requestTimeout = 8000; server.maxRequestsPerSocket = 1; server.maxConnections = 8;
        server.on("connection", socket => { this.sockets.add(socket); socket.on("close", () => this.sockets.delete(socket)); });
        server.on("clientError", (_error, socket) => { socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"); });
        this.starting = new Promise((resolve, reject) => {
            server.once("error", () => reject(new Error("Safe reader unavailable.")));
            server.listen(0, "127.0.0.1", () => {
                if (!this.enabled()) { void this.dispose(); reject(new Error("Safe reader unavailable.")); return; }
                resolve(this.connection());
            });
        });
        try { return await this.starting; } finally { this.starting = undefined; }
    }
    private connection(): SafeReadConnection {
        const address = this.server?.address(); if (!address || typeof address === "string") throw new Error("Safe reader unavailable.");
        return Object.freeze({ endpoint: `http://127.0.0.1:${address.port}/safe-read`, token: this.token, session: this.session });
    }
    async dispose(): Promise<void> {
        this.disposed = true; this.rotate(); const server = this.server; this.server = undefined;
        for (const socket of this.sockets) socket.destroy();
        if (server) await new Promise<void>(done => server.close(() => done()));
    }
    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const reply = (result: AccessResult | { status: NativeClassification; session?: string }) => { if (!res.destroyed && !res.writableEnded) {
            res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", connection: "close" }); res.end(JSON.stringify(result));
        } };
        try {
            const auth = req.headers.authorization, expected = `Bearer ${this.token}`;
            if (!this.enabled() || req.method !== "POST" || req.url !== "/safe-read" || req.headers.origin !== undefined || req.headers["content-type"] !== "application/json"
                || req.headers.host !== `127.0.0.1:${(this.server?.address() as { port?: number } | null)?.port}`
                || typeof auth !== "string" || Buffer.byteLength(auth) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
                req.resume(); reply({ status: "UNAVAILABLE" }); return;
            }
            const session = this.session; const body: Buffer[] = []; let size = 0;
            for await (const chunk of req) { const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length;
                if (size > 8192) { reply({ status: "UNAVAILABLE" }); req.resume(); return; } body.push(part); }
            const envelope: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(body)));
            if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) { reply({ status: "UNAVAILABLE" }); return; }
            const value = envelope as Record<string, unknown>, file = safeReadPath({ path: value.path });
            const ready = value.operation === "classify-ready", classification = ready || value.operation === "classify-read" || value.operation === "classify-write";
            if (Object.keys(value).sort().join(",") !== (classification ? "id,operation,path,session,version,workspace" : "id,path,session,version")
                || classification && (ready ? !this.deps.ready : !this.deps.classify)) { reply({ status: "UNAVAILABLE" }); return; }
            if (classification && (typeof value.workspace !== "string" || value.workspace.length > 1024 || !path.win32.isAbsolute(value.workspace)
                || !this.deps.workspace || path.win32.resolve(value.workspace).toLowerCase() !== path.win32.resolve(this.deps.workspace).toLowerCase())) { reply({ status: "UNAVAILABLE" }); return; }
            if (!file || value.version !== 1 || value.session !== session || !validSession(value.id) || session !== this.session || !this.enabled()) { reply({ status: "UNAVAILABLE" }); return; }
            if (this.active) { reply({ status: "BUSY" }); return; }
            const controller = new AbortController(); this.active = controller;
            const closed = () => controller.abort(); res.once("close", closed);
            let cancel!: () => void;
            const cancellation = new Promise<AccessResult>(resolve => { cancel = () => resolve({ status: "EXPIRED" }); controller.signal.addEventListener("abort", cancel, { once: true }); });
            const timer = setTimeout(closed, 65_000); timer.unref?.();
            try {
                const work = classification
                    ? (ready ? this.deps.ready!(controller.signal).then(decision => decision === true ? "PUBLIC" as const : "UNAVAILABLE" as const)
                        : this.deps.classify!(file, value.operation === "classify-write" ? "write" : "read", controller.signal))
                        .then(decision => ({ status: decision === "PUBLIC" || decision === "RESTRICTED" ? decision : "UNAVAILABLE", session } as { status: NativeClassification; session: string }))
                    : this.deps.read(file, `SoterAI MCP session ${session.slice(0, 8)} (requester identity unverified)`, controller.signal);
                const result = await Promise.race([work, cancellation]);
                reply(controller.signal.aborted || session !== this.session || !this.enabled() ? { status: "EXPIRED" } : classification ? result : safeReadResult(result));
            } catch { reply({ status: "UNAVAILABLE" }); }
            finally { clearTimeout(timer); res.removeListener("close", closed); controller.signal.removeEventListener("abort", cancel); if (this.active === controller) this.active = undefined; }
        } catch { reply({ status: "UNAVAILABLE" }); }
    }
}
