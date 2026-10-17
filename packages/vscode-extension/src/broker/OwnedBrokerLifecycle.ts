import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readBoundedResponseBody } from "../security/boundedResponse";

export interface OwnedBrokerSnapshot { state: "stopped" | "starting" | "healthy" | "error" | "stopping" | "STOP_UNCONFIRMED"; port?: number; url?: string; session?: string }
export type OwnedBrokerRequest = <T>(path: string, init?: RequestInit, timeoutMs?: number) => Promise<T>;
export interface OwnedBrokerOptions {
    script: string;
    enabled(): boolean;
    fingerprint(): string;
    prepare(): Promise<NodeJS.ProcessEnv>;
    initialize(request: OwnedBrokerRequest): Promise<void>;
    launch?: typeof spawn;
    fetchImpl?: typeof fetch;
    startupMs?: number;
    stopMs?: number;
}
interface Generation {
    child: ChildProcess; epoch: number; session: string; token: string; control: string; binding: string; port?: number;
    closed: boolean; outEnd: boolean; errEnd: boolean; stopSent: boolean; done: Promise<void>; resolveDone(): void;
    rejectReady(error: Error): void;
}
const unavailable = () => new Error("Owned local broker unavailable; requests withheld. Restart after reviewing broker status.");
async function bounded<T>(operation: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([operation, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(unavailable()), ms); })]); }
    finally { clearTimeout(timer); }
}

/** Private child IPC establishes ownership; an answering TCP listener never does. */
export class OwnedBrokerLifecycle {
    private generation?: Generation;
    private state: OwnedBrokerSnapshot["state"] = "stopped";
    private epoch = 0;
    private disposed = false;
    private startPromise?: Promise<OwnedBrokerSnapshot>;
    private readonly requests = new Set<AbortController>();
    constructor(private readonly options: OwnedBrokerOptions) {}

    private available(): boolean { try { return !this.disposed && this.options.enabled() === true; } catch { return false; } }
    private current(g: Generation): boolean {
        try { return this.available() && this.generation === g && this.epoch === g.epoch && !g.stopSent && !g.closed && this.options.fingerprint() === g.binding; }
        catch { return false; }
    }
    snapshot(): OwnedBrokerSnapshot {
        const g = this.generation;
        const state = this.state === "healthy" && (!g || !this.current(g)) ? "error" : this.state;
        return Object.freeze({ state, ...(g?.port ? { port: g.port, url: `http://127.0.0.1:${g.port}`, session: g.session } : {}) });
    }
    clientToken(): string {
        const g = this.generation;
        if (!g || this.state !== "healthy") throw unavailable();
        if (!this.current(g)) { this.invalidate(); throw unavailable(); }
        return g.token;
    }
    async start(): Promise<OwnedBrokerSnapshot> {
        if (!this.available()) throw unavailable();
        if (this.startPromise) return this.startPromise;
        if (this.generation) {
            if (this.state !== "healthy" || !this.current(this.generation)) throw unavailable();
            await this.request("/v1/lifecycle/status"); return this.snapshot();
        }
        const epoch = ++this.epoch; this.state = "starting";
        const operation = bounded(this.begin(epoch), this.options.startupMs ?? 6000).catch(async () => {
            if (this.epoch === epoch) { this.invalidate(); await this.stop(); }
            throw unavailable();
        });
        this.startPromise = operation;
        try { return await operation; } finally { if (this.startPromise === operation) this.startPromise = undefined; }
    }
    private async begin(epoch: number): Promise<OwnedBrokerSnapshot> {
        const binding = this.options.fingerprint(), prepared = await this.options.prepare();
        if (!this.available() || this.epoch !== epoch || this.options.fingerprint() !== binding) throw unavailable();
        const session = randomUUID(), token = randomBytes(32).toString("base64url"), control = randomBytes(32).toString("base64url");
        let resolveReady!: () => void, rejectReady!: (error: Error) => void, resolveDone!: () => void;
        const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
        const done = new Promise<void>(resolve => { resolveDone = resolve; });
        const child = (this.options.launch ?? spawn)(process.execPath, [this.options.script], {
            env: { ...prepared, ELECTRON_RUN_AS_NODE: "1", SOTERAI_BROKER_PORT: "0", SOTERAI_BROKER_SESSION: session,
                SOTERAI_BROKER_TOKEN: token, SOTERAI_BROKER_CONTROL_TOKEN: control, SOTERAI_REQUIRE_CANARY_SYNC: "1" },
            windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
        });
        const g: Generation = { child, epoch, session, token, control, binding, closed: false, outEnd: !child.stdout, errEnd: !child.stderr,
            stopSent: false, done, resolveDone, rejectReady };
        this.generation = g;
        const complete = () => {
            if (!g.closed || !g.outEnd || !g.errEnd) return;
            g.token = ""; g.control = ""; g.resolveDone();
            if (this.generation === g) { this.generation = undefined; this.state = "stopped"; }
        };
        // Drain and discard every byte. No untrusted crash text is published.
        child.stdout?.on("data", () => undefined); child.stderr?.on("data", () => undefined);
        child.stdout?.once("end", () => { g.outEnd = true; complete(); });
        child.stderr?.once("end", () => { g.errEnd = true; complete(); });
        child.stdout?.once("error", () => { rejectReady(unavailable()); this.invalidateGeneration(g); });
        child.stderr?.once("error", () => { rejectReady(unavailable()); this.invalidateGeneration(g); });
        child.once("error", () => { rejectReady(unavailable()); this.invalidateGeneration(g); });
        child.once("exit", () => { rejectReady(unavailable()); this.invalidateGeneration(g); });
        child.once("close", () => { g.closed = true; rejectReady(unavailable()); if (this.generation === g) this.invalidateGeneration(g); complete(); });
        let readySeen = false;
        child.on("message", (message: unknown) => {
            if (readySeen || !message || typeof message !== "object" || Array.isArray(message)) { rejectReady(unavailable()); this.invalidateGeneration(g); return; }
            const row = message as Record<string, unknown>;
            if (Object.keys(row).sort().join(",") !== "port,session,type,version" || row.type !== "SOTERAI_BROKER_READY" || row.version !== 1 || row.session !== session
                || !Number.isInteger(row.port) || Number(row.port) < 1 || Number(row.port) > 65535 || !this.current(g)) {
                rejectReady(unavailable()); this.invalidateGeneration(g); return;
            }
            readySeen = true; g.port = Number(row.port); resolveReady();
        });
        if (!child.stdout || !child.stderr || !child.connected) { rejectReady(unavailable()); this.invalidateGeneration(g); }
        await ready;
        const request: OwnedBrokerRequest = (route, init, ms) => this.requestAt(g, route, init, ms);
        const identity = await request<{ session: string; version: string; ready: boolean }>("/v1/lifecycle/status");
        if (identity.session !== session || identity.version !== "0.2.0" || identity.ready !== true) throw unavailable();
        await this.options.initialize(request);
        if (!this.current(g)) throw unavailable();
        this.state = "healthy"; return this.snapshot();
    }
    private invalidateGeneration(g: Generation): void { if (this.generation === g) this.invalidate(); }
    invalidate(): void {
        ++this.epoch; this.state = this.generation ? "stopping" : "stopped";
        for (const controller of this.requests) controller.abort();
        const g = this.generation;
        if (!g || g.stopSent) return;
        g.stopSent = true; g.rejectReady(unavailable());
        if (g.child.connected) {
            try { g.child.send({ type: "SOTERAI_BROKER_STOP", version: 1, session: g.session }, () => undefined); } catch { /* retain ownership */ }
        }
    }
    async stop(): Promise<OwnedBrokerSnapshot> {
        this.invalidate(); const g = this.generation;
        if (!g) { this.state = "stopped"; return this.snapshot(); }
        await bounded(g.done, this.options.stopMs ?? 2000).catch(() => undefined);
        if (this.generation === g) this.state = "STOP_UNCONFIRMED";
        return this.snapshot();
    }
    async dispose(): Promise<void> { this.disposed = true; await this.stop(); }
    async request<T>(route: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
        if (!/^\/[A-Za-z0-9/_-]+$/.test(route) || route.startsWith("//")) throw unavailable();
        const g = this.generation;
        if (!g || this.state !== "healthy" || !this.current(g)) { this.invalidate(); throw unavailable(); }
        try { return await this.requestAt<T>(g, route, init, timeoutMs); }
        catch { this.invalidateGeneration(g); throw unavailable(); }
    }
    private async requestAt<T>(g: Generation, route: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
        if (!/^\/[A-Za-z0-9/_-]+$/.test(route) || route.startsWith("//") || !this.current(g) || !g.port
            || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw unavailable();
        const controller = new AbortController(); this.requests.add(controller);
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const abort = () => controller.abort(); init.signal?.addEventListener("abort", abort, { once: true });
        if (init.signal?.aborted) controller.abort();
        try {
            const headers = new Headers(init.headers); headers.set("authorization", `Bearer ${g.control}`); headers.set("x-soterai-session", g.session);
            if (init.body) headers.set("content-type", "application/json");
            const response = await (this.options.fetchImpl ?? fetch)(`http://127.0.0.1:${g.port}${route}`, { ...init, headers, redirect: "error", signal: controller.signal });
            const raw = await readBoundedResponseBody(response, 1024 * 1024);
            if (!response.ok || !raw || !this.current(g) || controller.signal.aborted) throw unavailable();
            const body: unknown = JSON.parse(raw);
            if (!body || typeof body !== "object" || !this.current(g)) throw unavailable();
            return body as T;
        } catch { throw unavailable(); }
        finally { clearTimeout(timer); init.signal?.removeEventListener("abort", abort); this.requests.delete(controller); }
    }
}
