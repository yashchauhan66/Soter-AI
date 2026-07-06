import * as vscode from "vscode";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

const TOKEN_KEY = "soterai.localBrokerToken";
const SESSION_KEY = "soterai.memorySessionId";

export interface BrokerStatus {
    running: boolean;
    url: string;
    safeMode?: { enabled: boolean; level: string };
    memorySessionId?: string;
}

export class BrokerManager implements vscode.Disposable {
    private child?: ChildProcess;

    constructor(private readonly context: vscode.ExtensionContext) {}

    get port(): number {
        return vscode.workspace.getConfiguration("soterai").get<number>("broker.port", 47321);
    }

    get url(): string { return `http://127.0.0.1:${this.port}`; }

    get memorySessionId(): string | undefined { return this.context.globalState.get<string>(SESSION_KEY); }

    async start(): Promise<BrokerStatus> {
        const existing = await this.status();
        if (existing.running) return existing;
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
        this.child = spawn(process.execPath, [script], { env, windowsHide: true, stdio: "ignore" });
        this.child.once("exit", () => { this.child = undefined; });
        for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const status = await this.status();
            if (status.running) return status;
            if (this.child?.exitCode !== null && this.child?.exitCode !== undefined) break;
        }
        throw new Error("Local AI Broker did not become ready on 127.0.0.1");
    }

    async stop(): Promise<void> {
        const child = this.child;
        if (!child) return;
        this.child = undefined;
        if (!child.killed) child.kill();
        await new Promise<void>((resolve) => {
            if (child.exitCode !== null) return resolve();
            const timeout = setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); resolve(); }, 2000);
            child.once("exit", () => { clearTimeout(timeout); resolve(); });
        });
    }

    async restart(): Promise<BrokerStatus> { await this.stop(); return this.start(); }

    async status(): Promise<BrokerStatus> {
        try {
            const version = await this.request<Record<string, unknown>>("/version", { method: "GET" }, 750);
            if (!version.version) return { running: false, url: this.url };
            const safeMode = await this.request<{ enabled: boolean; level: string }>("/v1/safe-mode/status", { method: "GET" }, 750);
            return { running: true, url: this.url, safeMode, memorySessionId: this.memorySessionId };
        } catch { return { running: false, url: this.url, memorySessionId: this.memorySessionId }; }
    }

    async request<T>(path: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
        const token = await this.context.secrets.get(TOKEN_KEY);
        if (!token) throw new Error("Local broker token is not configured");
        const headers = new Headers(init.headers);
        headers.set("authorization", `Bearer ${token}`);
        if (init.body) headers.set("content-type", "application/json");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(`${this.url}${path}`, { ...init, headers, signal: controller.signal });
            const body = await response.json() as T & { error?: { message?: string } };
            if (!response.ok) throw new Error(body.error?.message ?? `Broker request failed (${response.status})`);
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

    private async getOrCreateToken(): Promise<string> {
        let token = await this.context.secrets.get(TOKEN_KEY);
        if (!token) {
            token = randomBytes(32).toString("base64url");
            await this.context.secrets.store(TOKEN_KEY, token);
        }
        return token;
    }
}

let activeManager: BrokerManager | undefined;
export function setBrokerManager(manager: BrokerManager): void { activeManager = manager; }
export function getBrokerManager(): BrokerManager | undefined { return activeManager; }
