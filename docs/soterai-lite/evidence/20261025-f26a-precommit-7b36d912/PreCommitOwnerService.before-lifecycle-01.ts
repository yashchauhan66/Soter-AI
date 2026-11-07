import { createPublicKey, KeyObject, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { captureHookIndex, isCheckedHookIndex, prepareCheckedHookIndex, type CheckedHookIndex } from "./CheckedHookIndex";
import { PreCommitScan, type PreCommitScanResult } from "./PreCommitScan";
import { parseHookRequest, signHookDecision, signHookDescriptor, type HookRequest } from "./PreCommitWire";

interface ScanOptions { index: CheckedHookIndex; valid: () => boolean; deadline: number }
interface Scan { start(): Promise<PreCommitScanResult>; readonly closed: Promise<void>; readonly busy: boolean; withdraw(): void; canRelease(value: PreCommitScanResult): boolean }
interface Options {
    root: string; generation: string; workerSha256: string; runtimeSha256: string; valid: () => boolean;
    loadKey: () => Promise<KeyObject | undefined>; ambient?: NodeJS.ProcessEnv;
    prepareIndex?: typeof prepareCheckedHookIndex; createScan?: (options: ScanOptions) => Scan;
}
interface Job { revoked: boolean; scan?: Scan; done: Promise<void>; finish(): void; cancelled: Promise<void>; cancel(): void }
const ZERO = "0".repeat(64);
function publicPin(key: KeyObject | undefined): string | undefined {
    try { return key instanceof KeyObject && key.type === "private" && key.asymmetricKeyType === "ed25519"
        ? (createPublicKey(key).export({ format: "der", type: "spki" }) as Buffer).toString("base64") : undefined; }
    catch { return undefined; }
}

/** Separate live owning-editor route. Signatures authenticate responses, not
 * callers. No raw staged bytes/findings/diagnostics leave this bounded service. */
export class PreCommitOwnerService {
    #server?: Server; #started = false; #stopped = false; #ready = false;
    #session = randomUUID(); #pin?: string; #host?: string; #job?: Job; #closing?: Promise<void>;
    #withdrawn: Promise<void>; #withdraw!: () => void;
    constructor(private readonly options: Options) { this.#withdrawn = new Promise(resolve => this.#withdraw = resolve); }
    get busy(): boolean { return this.#job !== undefined; }
    #available(): boolean {
        if (this.#stopped) return false;
        try { if (this.options.valid() === true && !this.#stopped) return true; } catch { /* Fixed refusal. */ }
        this.#stop(); return false;
    }
    #cancel(job: Job): void {
        job.revoked = true; job.cancel();
        try { job.scan?.withdraw(); } catch { /* Actual closure remains required. */ }
    }
    #stop(): void {
        this.#stopped = true; this.#ready = false; this.#withdraw();
        if (this.#job) this.#cancel(this.#job);
    }
    async #key(deadline: number, job?: Job): Promise<KeyObject | undefined> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const timeout = new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), Math.max(1, Math.min(5000, deadline - performance.now()))); });
            return await Promise.race([this.options.loadKey(), timeout, this.#withdrawn.then(() => undefined),
                ...(job ? [job.cancelled.then(() => undefined)] : [])]);
        } catch { return undefined; } finally { clearTimeout(timer); }
    }
    async start(): Promise<Buffer | undefined> {
        if (this.#started || this.#stopped) return undefined; this.#started = true;
        if (!this.#available()) return undefined;
        const key = await this.#key(performance.now() + 5000), pin = publicPin(key);
        if (!pin || !key || !this.#available()) { this.#stop(); return undefined; }
        this.#pin = pin;
        // Schema validation before acquiring a listener.
        const payload = { version: 1, root: this.options.root, generation: this.options.generation, session: this.#session,
            endpoint: "http://127.0.0.1:1/pre-commit", workerSha256: this.options.workerSha256, runtimeSha256: this.options.runtimeSha256 };
        if (!signHookDescriptor(payload, key)) { this.#stop(); return undefined; }
        try {
            const server = createServer({ maxHeaderSize: 4096, headersTimeout: 5000, requestTimeout: 65000, keepAliveTimeout: 1000 },
                (req, res) => this.#request(req, res)); this.#server = server;
            server.maxConnections = 4; server.maxRequestsPerSocket = 1;
            server.on("clientError", (_error, socket) => { if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 11\r\n\r\nUNAVAILABLE"); });
            server.on("checkContinue", (_req, res) => this.#refuse(res));
            await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); }); });
            server.on("error", () => { void this.close(); });
            const address = server.address();
            if (!address || typeof address === "string" || address.address !== "127.0.0.1" || !this.#available()) { await this.close(); return undefined; }
            this.#host = "127.0.0.1:" + address.port;
            const descriptor = signHookDescriptor({ ...payload, endpoint: "http://" + this.#host + "/pre-commit" }, key);
            if (!descriptor || !this.#available()) { await this.close(); return undefined; }
            this.#ready = true; return descriptor;
        } catch { await this.close(); return undefined; }
    }
    #refuse(res: ServerResponse): void {
        if (res.destroyed || res.writableEnded) return;
        res.writeHead(503, { "Content-Type": "text/plain", "Content-Length": "11", "Connection": "close", "Cache-Control": "no-store" }); res.end("UNAVAILABLE");
    }
    #headers(req: IncomingMessage): number | undefined {
        if (!this.#ready || req.method !== "POST" || req.url !== "/pre-commit" || req.httpVersion !== "1.1"
            || req.rawHeaders.length > 64 || req.rawHeaders.reduce((sum, value) => sum + Buffer.byteLength(value), 0) > 4096) return undefined;
        const seen = new Set<string>();
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
            const key = req.rawHeaders[i].toLowerCase(); if (seen.has(key)) return undefined; seen.add(key);
        }
        if (req.headers.host !== this.#host || req.headers["content-type"] !== "application/json" || seen.has("origin")
            || seen.has("transfer-encoding") || seen.has("expect") || typeof req.headers["content-length"] !== "string"
            || !/^[1-9][0-9]{0,3}$/.test(req.headers["content-length"])) return undefined;
        const count = Number(req.headers["content-length"]); return count <= 4096 ? count : undefined;
    }
    #request(req: IncomingMessage, res: ServerResponse): void {
        const count = this.#headers(req);
        if (count === undefined || !this.#available()) { this.#refuse(res); req.resume(); return; }
        const chunks: Buffer[] = []; let total = 0, failed = false;
        const timeout = setTimeout(() => { failed = true; this.#refuse(res); req.destroy(); }, 5000);
        const clear = () => { clearTimeout(timeout); chunks.forEach(chunk => chunk.fill(0)); chunks.length = 0; };
        req.once("error", () => { failed = true; clear(); this.#refuse(res); });
        req.once("aborted", () => { failed = true; clear(); });
        req.on("data", (chunk: Buffer) => {
            total += chunk.length;
            if (total > count || total > 4096) { failed = true; clear(); this.#refuse(res); return; }
            if (!failed) chunks.push(Buffer.from(chunk));
        });
        req.once("end", () => {
            clearTimeout(timeout);
            const bytes = Buffer.concat(chunks), request = !failed && total === count
                ? parseHookRequest(bytes, { generation: this.options.generation, session: this.#session }) : undefined;
            bytes.fill(0); clear();
            if (!request || !this.#available() || res.destroyed) { this.#refuse(res); return; }
            if (this.#job) { void this.#replyBusy(request, res); return; }
            void this.#serve(request, req, res);
        });
    }
    async #replyBusy(request: Readonly<HookRequest>, res: ServerResponse): Promise<void> {
        const key = await this.#key(performance.now() + 5000);
        if (!this.#available() || publicPin(key) !== this.#pin || !key) { this.#refuse(res); return; }
        const signed = signHookDecision({ version: 1, root: this.options.root, generation: this.options.generation,
            session: this.#session, nonce: request.nonce, status: "BUSY", indexSha256: ZERO, indexIdentity: ZERO }, key);
        if (!signed || !this.#available()) { this.#refuse(res); return; } this.#send(res, signed);
    }
    #send(res: ServerResponse, bytes: Buffer): void {
        if (res.destroyed || res.writableEnded) return;
        res.writeHead(200, { "Content-Type": "application/json", "Content-Length": String(bytes.length), "Connection": "close", "Cache-Control": "no-store" }); res.end(bytes);
    }
    async #serve(request: Readonly<HookRequest>, req: IncomingMessage, res: ServerResponse): Promise<void> {
        let finish!: () => void, cancel!: () => void;
        const job: Job = { revoked: false, done: new Promise(resolve => finish = resolve), finish: () => finish(),
            cancelled: new Promise(resolve => cancel = resolve), cancel: () => cancel() };
        this.#job = job;
        const start = performance.now(), deadline = start + 60000; let last = start;
        const valid = () => {
            if (job.revoked || !this.#available()) { this.#cancel(job); return false; }
            const now = performance.now();
            if (job.revoked || this.#stopped || !Number.isFinite(now) || now < last || now >= deadline) { this.#cancel(job); return false; }
            last = now; return true;
        };
        const disconnected = () => { if (!res.writableFinished) this.#cancel(job); };
        req.once("aborted", disconnected); res.once("close", disconnected);
        const timeout = setTimeout(() => { this.#cancel(job); this.#refuse(res); }, 60000);
        try {
            if (!valid()) { this.#refuse(res); return; }
            const index = await (this.options.prepareIndex ?? prepareCheckedHookIndex)(this.options.root, request.indexFile, this.options.ambient ?? process.env, valid);
            if (!valid() || !isCheckedHookIndex(index) || index.root !== this.options.root || !index.available()) { this.#refuse(res); return; }
            const snapshot = captureHookIndex(this.options.root, request.indexFile);
            if (!snapshot || snapshot.indexFile !== index.indexFile || snapshot.indexSha256 !== index.indexSha256 || snapshot.indexIdentity !== index.indexIdentity || !valid()) { this.#refuse(res); return; }
            const scan = (this.options.createScan ?? (input => new PreCommitScan(input)))({ index, valid, deadline }); job.scan = scan;
            if (!valid()) { this.#cancel(job); this.#refuse(res); return; }
            const outcome = await scan.start();
            if (outcome.status === "ALLOW" || outcome.status === "BLOCK") await scan.closed;
            const key = await this.#key(deadline, job);
            if (!key || publicPin(key) !== this.#pin || !valid() || !index.available() || !valid()
                || scan.busy || (outcome.status === "ALLOW" && !scan.canRelease(outcome)) || !valid()) { this.#refuse(res); return; }
            const status = outcome.status === "ALLOW" || outcome.status === "BLOCK" ? outcome.status : "UNAVAILABLE";
            const signed = signHookDecision({ version: 1, root: this.options.root, generation: this.options.generation, session: this.#session,
                nonce: request.nonce, status, indexSha256: index.indexSha256, indexIdentity: index.indexIdentity }, key);
            if (!signed || !valid()) { this.#refuse(res); return; }
            this.#send(res, signed);
        } catch { this.#cancel(job); this.#refuse(res); }
        finally {
            // Releasing transport authority cannot pretend a Git child closed.
            if (job.scan) { try { await job.scan.closed; } catch { /* Never reuse this owner below. */ this.#stop(); } }
            clearTimeout(timeout); req.removeListener("aborted", disconnected); res.removeListener("close", disconnected);
            if (this.#job === job) this.#job = undefined; job.finish();
        }
    }
    close(): Promise<void> {
        if (this.#closing) return this.#closing; this.#stop();
        const job = this.#job, server = this.#server;
        this.#closing = Promise.all([job?.done, server?.listening ? new Promise<void>(resolve => server.close(() => resolve())) : undefined]).then(() => undefined);
        return this.#closing;
    }
}
