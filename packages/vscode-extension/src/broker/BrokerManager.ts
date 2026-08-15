import * as vscode from "vscode";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { LOCKDOWN_STATE_KEY, type LockdownRecord } from "../protection/LockdownState";

const TOKEN_KEY = "soterai.localBrokerToken";
const SESSION_KEY = "soterai.memorySessionId";
export const EXPECTED_BROKER_VERSION = "0.1.0";

export type BrokerLifecycleState =
    | "stopped"
    | "starting"
    | "healthy"
    | "degraded"
    | "incompatible"
    | "error"
    | "stopping";

export interface BrokerStatus {
    running: boolean;
    url: string;
    state: BrokerLifecycleState;
    version?: string;
    lastError?: string;
    checkedAt?: string;
    restartCount?: number;
    safeMode?: { enabled: boolean; level: string };
    memorySessionId?: string;
}

export class BrokerManager implements vscode.Disposable {
    private child?: ChildProcess;
    private startPromise?: Promise<BrokerStatus>;
    private heartbeat?: ReturnType<typeof setInterval>;
    private intentionalStop = false;
    private restartTimer?: ReturnType<typeof setTimeout>;
    private restartCount = 0;
    private lifecycle: BrokerLifecycleState = "stopped";
    private lastError?: string;

    constructor(private readonly context: vscode.ExtensionContext) {}

    get port(): number {
        return vscode.workspace.getConfiguration("soterai").get<number>("broker.port", 47321);
    }

    get url(): string { return `http://127.0.0.1:${this.port}`; }

    get memorySessionId(): string | undefined { return this.context.globalState.get<string>(SESSION_KEY); }

    async start(): Promise<BrokerStatus> {
        if (this.startPromise) return this.startPromise;
        this.startPromise = this.startInternal();
        try { return await this.startPromise; } finally { this.startPromise = undefined; }
    }

    private async startInternal(): Promise<BrokerStatus> {
        if (this.isLockedDown()) throw new Error("Emergency Lockdown is active; broker start is blocked");
        const existing = await this.status();
        if (existing.running && existing.state === "healthy") return existing;
        if (existing.state === "incompatible") {
            this.lifecycle = "incompatible";
            this.intentionalStop = true;
            await this.stop();
            throw this.incompatibleError(existing.version);
        }
        this.clearRestartTimer();

        // Retire the broker we already own before spawning its replacement.
        //
        // `this.child = spawn(...)` below overwrites this reference, so without
        // this the running process is orphaned: it keeps the port, stops being
        // stoppable, and becomes invisible to dispose() — so it outlives the
        // editor. And one slow health check is enough to get here with a
        // perfectly good broker running, because status() reports a busy broker
        // as "not healthy". The old code then spawned a duplicate that could not
        // bind, waited three seconds, and reported failure — after which no
        // restart could ever recover, because the process holding the port was
        // no longer referenced by anything.
        if (this.child) {
            this.intentionalStop = true;
            await this.stop();
        }

        // Whatever still holds the port is not ours, and a second listener
        // cannot bind it. Saying so beats spawning a process that is guaranteed
        // to fail and calling that a timeout. Two editors running SoterAI at
        // once — VS Code and Cursor, say — reach this every time, since each
        // keeps its own broker token and cannot use the other's broker.
        if (await this.isPortServed()) {
            this.lifecycle = "error";
            this.lastError = `port ${this.port} is already in use`;
            throw new Error(
                `${this.url} is already in use, so the local AI broker cannot start there. ` +
                    'If another editor is already running SoterAI, give this one its own port with the "soterai.broker.port" setting.',
            );
        }

        this.intentionalStop = false;
        this.lifecycle = "starting";
        this.lastError = undefined;
        const token = await this.getOrCreateToken();
        const script = this.context.asAbsolutePath("dist/local-ai-broker.js");
        const config = vscode.workspace.getConfiguration("soterai");
        const providerKey = await this.context.secrets.get("soterai.providerApiKey");
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            SOTERAI_BROKER_TOKEN: token,
            SOTERAI_BROKER_PORT: String(this.port),
            SOTERAI_BROKER_STORAGE: this.context.globalStorageUri.fsPath,
            SOTERAI_OPENAI_PROVIDER_URL: config.get<string>("broker.openAIProviderUrl", ""),
            SOTERAI_ANTHROPIC_PROVIDER_URL: config.get<string>("broker.anthropicProviderUrl", ""),
            SOTERAI_PROVIDER_API_KEY: providerKey,
        };
        // Launches only the bundled local broker entry with Electron's Node
        // runtime. User input never controls the executable or argv.
        //
        // stdout and stderr are piped rather than discarded: the bundle prints
        // its reason for refusing to start ("Broker token must be at least 32
        // characters", a bind error) and exits, and with that discarded neither
        // the user nor a developer could ever learn why protection was
        // unavailable — the only symptom was a timeout. Both streams are drained
        // so the child can never block on a full pipe.
        const child = spawn(process.execPath, [script], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        this.child = child;
        let exited = false;
        let output = "";
        const collect = (chunk: unknown): void => {
            if (output.length < 2000) output += String(chunk);
        };
        child.stdout?.on("data", collect);
        child.stderr?.on("data", collect);
        child.once("error", (error) => {
            collect(error.message);
            this.lastError = error.message;
            this.lifecycle = "error";
        });
        child.once("exit", () => {
            // Read by the loop below. `this.child` is cleared here, so a check
            // through `this.child?.exitCode` could never see this exit — which
            // is why every failed start used to burn the full deadline.
            exited = true;
            this.child = undefined;
            this.stopHeartbeat();
            if (!this.intentionalStop) {
                this.lifecycle = "degraded";
                this.scheduleRestart();
            } else {
                this.lifecycle = "stopped";
            }
        });
        for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const status = await this.status();
            if (status.running && status.state === "healthy") {
                this.lifecycle = "healthy";
                this.restartCount = 0;
                this.startHeartbeat();
                return { ...status, restartCount: this.restartCount };
            }
            if (status.state === "incompatible") {
                this.lifecycle = "incompatible";
                this.intentionalStop = true;
                await this.stop();
                throw this.incompatibleError(status.version);
            }
            if (exited) break;
        }
        this.lifecycle = "error";
        const reason = BrokerManager.summarizeSpawnOutput(output, token);
        this.lastError = `Local AI Broker did not become ready before the startup deadline${reason ? `: ${reason}` : ""}`;
        this.intentionalStop = true;
        await this.stop();
        throw new Error(`Local AI Broker did not become ready on 127.0.0.1${reason ? `: ${reason}` : ""}`);
    }

    private incompatibleError(version: string | undefined): Error {
        return new Error(`Local AI Broker version ${version ?? "unknown"} is incompatible; expected ${EXPECTED_BROKER_VERSION}`);
    }

    /**
     * Is anything at all listening on our port?
     *
     * status() collapses "nothing is there" and "it answered, but not the way we
     * wanted" into the same not-healthy verdict, and the difference decides
     * whether spawning is recovery or self-harm. Any HTTP reply — 200, 401, 429,
     * even 404 from an unrelated service — means the port is taken. /health is
     * the broker's unauthenticated endpoint, so a token mismatch cannot make a
     * live broker look absent.
     */
    private async isPortServed(): Promise<boolean> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 750);
        try {
            await fetch(`${this.url}/health`, { signal: controller.signal });
            return true;
        } catch {
            return false;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * The child's own explanation, trimmed to one line for a notification.
     *
     * The token is redacted by exact match: it is in the child's environment, so
     * a crash dump that echoes the environment would otherwise carry it into a
     * notification and the status bar tooltip.
     */
    private static summarizeSpawnOutput(output: string, token: string): string {
        if (!output.trim()) return "";
        return output.split(token).join("[REDACTED]").replace(/\s+/g, " ").trim().slice(0, 300);
    }

    async stop(): Promise<void> {
        this.clearRestartTimer();
        this.intentionalStop = true;
        this.lifecycle = "stopping";
        this.stopHeartbeat();
        const child = this.child;
        if (!child) { this.lifecycle = "stopped"; return; }
        this.child = undefined;
        if (!child.killed) child.kill();
        await new Promise<void>((resolve) => {
            if (child.exitCode !== null) return resolve();
            const timeout = setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); resolve(); }, 2000);
            child.once("exit", () => { clearTimeout(timeout); resolve(); });
        });
        this.lifecycle = "stopped";
    }

    async restart(): Promise<BrokerStatus> { await this.stop(); this.restartCount = 0; return this.start(); }

    async status(): Promise<BrokerStatus> {
        const base = { running: false, url: this.url, state: this.lifecycle, lastError: this.lastError, checkedAt: new Date().toISOString(), restartCount: this.restartCount } as BrokerStatus;
        try {
            const version = await this.request<Record<string, unknown>>("/version", { method: "GET" }, 750);
            const versionText = typeof version.version === "string" ? version.version : undefined;
            if (!versionText) return { ...base, state: "degraded" };
            if (versionText !== EXPECTED_BROKER_VERSION) return { ...base, state: "incompatible", running: true, version: versionText };
            const safeMode = await this.request<{ enabled: boolean; level: string }>("/v1/safe-mode/status", { method: "GET" }, 750);
            return { ...base, running: true, state: "healthy", version: versionText, safeMode, memorySessionId: this.memorySessionId };
        } catch (error) {
            return { ...base, state: this.child ? "degraded" : "stopped", memorySessionId: this.memorySessionId, lastError: error instanceof Error ? error.message : "Broker health check failed" };
        }
    }

    async request<T>(path: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
        if (this.isLockedDown() && path !== "/v1/approvals/clear") throw new Error("Emergency Lockdown is active; broker requests fail closed");
        const token = await this.context.secrets.get(TOKEN_KEY);
        if (!token) throw new Error("Local broker token is not configured");
        const headers = new Headers(init.headers);
        headers.set("authorization", `Bearer ${token}`);
        if (init.body) headers.set("content-type", "application/json");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(`${this.url}${path}`, { ...init, headers, signal: controller.signal });
            const raw = await response.text();
            let body: (T & { error?: { message?: string } }) | undefined;
            try { body = raw ? JSON.parse(raw) as T & { error?: { message?: string } } : undefined; } catch { throw new Error(`Broker returned malformed JSON (${response.status})`); }
            if (!response.ok) throw new Error(body?.error?.message ?? `Broker request failed (${response.status})`);
            if (!body) throw new Error("Broker returned an empty response");
            return body;
        } finally { clearTimeout(timeout); }
    }

    async rotateToken(): Promise<void> {
        const next = randomBytes(32).toString("base64url");
        await this.request("/v1/auth/rotate", { method: "POST", body: JSON.stringify({ token: next }) });
        await this.context.secrets.store(TOKEN_KEY, next);
    }

    async clearToken(): Promise<void> {
        await this.stop();
        await this.context.secrets.delete(TOKEN_KEY);
    }

    async startMemorySession(): Promise<string> {
        await this.start();
        const sessionId = randomUUID();
        await this.request("/v1/memory/session/start", { method: "POST", body: JSON.stringify({ sessionId, tool: "VS Code", provider: "SoterAI" }) });
        await this.context.globalState.update(SESSION_KEY, sessionId);
        return sessionId;
    }

    async endMemorySession(): Promise<void> {
        const sessionId = this.memorySessionId;
        if (!sessionId) return;
        await this.request("/v1/memory/session/end", { method: "POST", body: JSON.stringify({ sessionId }) });
        await this.context.globalState.update(SESSION_KEY, undefined);
    }

    async clearMemorySession(): Promise<void> {
        const sessionId = this.memorySessionId;
        await this.request("/v1/memory/session/clear", { method: "POST", body: JSON.stringify({ sessionId }) });
        await this.context.globalState.update(SESSION_KEY, undefined);
    }

    async recordMemoryEvent(event: Record<string, unknown>): Promise<void> {
        let sessionId = this.memorySessionId;
        if (!sessionId) sessionId = await this.startMemorySession();
        await this.request("/v1/memory/session/event", { method: "POST", body: JSON.stringify({ sessionId, event }) });
    }

    dispose(): void { void this.stop(); }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeat = setInterval(() => {
            void this.status().then((status) => {
                if (!status.running && !this.intentionalStop) this.lifecycle = "degraded";
            });
        }, 5_000);
    }

    private stopHeartbeat(): void {
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = undefined;
    }

    private scheduleRestart(): void {
        if (this.intentionalStop || this.restartTimer || this.restartCount >= 3) return;
        const delay = Math.min(30_000, 500 * 2 ** this.restartCount);
        this.restartCount++;
        this.restartTimer = setTimeout(() => {
            this.restartTimer = undefined;
            void this.start().catch(() => { /* status remains degraded/error; no unbounded retry */ });
        }, delay);
    }

    private clearRestartTimer(): void {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        this.restartTimer = undefined;
    }

    private async getOrCreateToken(): Promise<string> {
        let token = await this.context.secrets.get(TOKEN_KEY);
        if (!token) {
            token = randomBytes(32).toString("base64url");
            await this.context.secrets.store(TOKEN_KEY, token);
        }
        return token;
    }

    private isLockedDown(): boolean {
        return Boolean(this.context.globalState.get<LockdownRecord>(LOCKDOWN_STATE_KEY)?.active);
    }
}

let activeManager: BrokerManager | undefined;
export function setBrokerManager(manager: BrokerManager): void { activeManager = manager; }
export function getBrokerManager(): BrokerManager | undefined { return activeManager; }
