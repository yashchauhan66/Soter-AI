import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { LOCKDOWN_STATE_KEY, type LockdownRecord } from "../protection/LockdownState";
import { BrokerStartFailure } from "./autoStart";
import { CanaryManager } from "../firewall/CanaryManager";
import { brokerChildEnvironment } from "../security/childEnvironment";
import { OwnedBrokerLifecycle, type OwnedBrokerOptions, type OwnedBrokerRequest, type OwnedBrokerSnapshot } from "./OwnedBrokerLifecycle";

export const EXPECTED_BROKER_VERSION = "0.2.0";
export { BrokerStartFailure } from "./autoStart";
export type BrokerLifecycleState = "stopped" | "starting" | "healthy" | "degraded" | "incompatible" | "error" | "stopping" | "STOP_UNCONFIRMED";
export interface BrokerStatus {
    running: boolean; url: string; state: BrokerLifecycleState; version?: string; lastError?: string; checkedAt?: string;
    restartCount?: number; safeMode?: { enabled: boolean; level: string }; memorySessionId?: string;
}
interface SavedMode { enabled: boolean; level: "developer" | "strict" | "enterprise" }

/** One window owns one private IPC child. No saved token/PID/port is adopted. */
export class BrokerManager implements vscode.Disposable {
    private readonly canaries: CanaryManager;
    private readonly lifecycle: OwnedBrokerLifecycle;
    private readonly listeners: vscode.Disposable[];
    private memorySession?: string;
    private disposed = false;
    constructor(private readonly context: vscode.ExtensionContext,
        transport: Pick<OwnedBrokerOptions, "launch" | "fetchImpl" | "startupMs" | "stopMs"> = {}) {
        this.canaries = new CanaryManager(context);
        // User input never controls the executable or argv: only the bundled entry.
        this.lifecycle = new OwnedBrokerLifecycle({ ...transport, script: context.asAbsolutePath("dist/local-ai-broker.js"),
            enabled: () => this.enabled(), fingerprint: () => this.binding(), prepare: () => this.prepare(), initialize: request => this.initialize(request),
        });
        this.listeners = [this.canaries.onDidChange(() => this.withdraw()),
            vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) this.withdraw(); }),
            this.context.secrets.onDidChange(event => { if (["soterai.providerApiKey", "soterai.canaryTokens"].includes(event.key)) this.withdraw(); }),
        ];
    }
    private enabled(): boolean {
        if (this.disposed || !vscode.workspace.isTrusted || this.isLockedDown()) return false;
        try {
            const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayLifecycle");
            return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayLifecycle", true)) === true;
        } catch { return false; }
    }
    private binding(): string {
        const config = vscode.workspace.getConfiguration("soterai");
        // Compare public routing configuration; never serialize auth material.
        return JSON.stringify([this.enabled(), vscode.workspace.isTrusted,
            config.get("broker.openAIProviderUrl", ""), config.get("broker.anthropicProviderUrl", ""), this.jsonEnabled(), this.gzipEnabled(), this.brotliEnabled(), this.deflateEnabled()]);
    }
    private jsonEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayJsonBodies");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayJsonBodies", true)) === true;
    }
    private gzipEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayGzipBodies");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayGzipBodies", true)) === true;
    }
    private brotliEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayBrotliBodies");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayBrotliBodies", true)) === true;
    }
    private deflateEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayDeflateBodies");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayDeflateBodies", true)) === true;
    }
    private savedMode(): SavedMode {
        const value = this.context.globalState.get<unknown>("soterai.safeMode");
        if (value === undefined) return { enabled: true, level: "strict" };
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Stored broker policy unavailable");
        const row = value as Record<string, unknown>, level = row.level ?? (row.enabled === false ? "strict" : undefined);
        if (typeof row.enabled !== "boolean" || !["developer", "strict", "enterprise"].includes(String(level))) throw new Error("Stored broker policy unavailable");
        return { enabled: row.enabled, level: level as SavedMode["level"] };
    }
    private async prepare(): Promise<NodeJS.ProcessEnv> {
        this.savedMode(); if (!this.enabled()) throw new Error("Broker unavailable");
        const config = vscode.workspace.getConfiguration("soterai");
        const providerKey = vscode.workspace.isTrusted ? await this.context.secrets.get("soterai.providerApiKey") : undefined;
        if (!this.enabled()) throw new Error("Broker unavailable");
        return { ...brokerChildEnvironment(process.env), SOTERAI_OPENAI_PROVIDER_URL: config.get<string>("broker.openAIProviderUrl", ""),
            SOTERAI_ANTHROPIC_PROVIDER_URL: config.get<string>("broker.anthropicProviderUrl", ""), SOTERAI_PROVIDER_API_KEY: providerKey, SOTERAI_GATEWAY_JSON_BODIES: this.jsonEnabled() ? "1" : "0", SOTERAI_GATEWAY_GZIP_BODIES: this.gzipEnabled() ? "1" : "0", SOTERAI_GATEWAY_BROTLI_BODIES: this.brotliEnabled() ? "1" : "0", SOTERAI_GATEWAY_DEFLATE_BODIES: this.deflateEnabled() ? "1" : "0" };
    }
    private async initialize(request: OwnedBrokerRequest): Promise<void> {
        const mode = this.savedMode(), registry = await this.canaries.loadForScan();
        const sync = await request<{ synchronized: boolean; count: number }>("/v1/canaries/sync", { method: "POST", body: JSON.stringify({ canaries: registry }) });
        if (sync.synchronized !== true || sync.count !== registry.length) throw new Error("Registry unavailable");
        if (mode.enabled) await request("/v1/safe-mode/enable", { method: "POST", body: JSON.stringify({ level: mode.level }) });
        if (JSON.stringify(mode) !== JSON.stringify(this.savedMode()) || !this.enabled()) throw new Error("Policy changed");
    }
    private withdraw(): void { this.memorySession = undefined; this.lifecycle.invalidate(); void this.lifecycle.stop(); }
    ownedSnapshot(): OwnedBrokerSnapshot { return this.lifecycle.snapshot(); }
    get port(): number { return this.lifecycle.snapshot().port ?? 0; }
    get url(): string { return this.lifecycle.snapshot().url ?? "http://127.0.0.1:0"; }
    get memorySessionId(): string | undefined { return this.lifecycle.snapshot().state === "healthy" ? this.memorySession : undefined; }
    async getClientToken(): Promise<string> { return this.lifecycle.clientToken(); }
    async start(): Promise<BrokerStatus> {
        if (this.isLockedDown()) throw new BrokerStartFailure("Emergency Lockdown is active; broker start is blocked", false);
        try { await this.lifecycle.start(); const status = await this.status(); if (!status.running || status.state !== "healthy") throw new Error("Health unavailable"); return status; }
        catch { throw new BrokerStartFailure("Owned local broker unavailable; protection for routed requests is unavailable. Review broker status and restart.", false); }
    }
    async stop(): Promise<void> { this.memorySession = undefined; await this.lifecycle.stop(); }
    async restart(): Promise<BrokerStatus> {
        await this.stop();
        if (this.lifecycle.snapshot().state === "STOP_UNCONFIRMED") throw new BrokerStartFailure("Owned broker shutdown is unconfirmed; replacement withheld.", false);
        return this.start();
    }
    async status(): Promise<BrokerStatus> {
        let snapshot = this.lifecycle.snapshot();
        const base = (): BrokerStatus => ({ running: false, url: this.url, state: snapshot.state, checkedAt: new Date().toISOString(), restartCount: 0 });
        if (snapshot.state !== "healthy") return base();
        try {
            const identity = await this.lifecycle.request<{ session: string; version: string; ready: boolean }>("/v1/lifecycle/status");
            if (identity.session !== snapshot.session || identity.version !== EXPECTED_BROKER_VERSION || identity.ready !== true) throw new Error("Identity unavailable");
            const safeMode = await this.lifecycle.request<{ enabled: boolean; level: string }>("/v1/safe-mode/status");
            if (typeof safeMode.enabled !== "boolean" || !["developer", "strict", "enterprise"].includes(safeMode.level)) throw new Error("Policy unavailable");
            return { ...base(), running: true, state: "healthy", version: EXPECTED_BROKER_VERSION, safeMode, memorySessionId: this.memorySessionId };
        } catch { this.withdraw(); snapshot = this.lifecycle.snapshot(); return { ...base(), lastError: "Owned broker health unavailable; requests withheld." }; }
    }
    async request<T>(route: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
        if (!this.enabled()) { this.withdraw(); throw new Error("Owned broker unavailable; requests withheld."); }
        return this.lifecycle.request<T>(route, init, timeoutMs);
    }
    async rotateToken(): Promise<void> { await this.restart(); }
    async clearToken(): Promise<void> { await this.stop(); }
    async startMemorySession(): Promise<string> {
        await this.start(); const sessionId = randomUUID();
        await this.request("/v1/memory/session/start", { method: "POST", body: JSON.stringify({ sessionId, tool: "VS Code", provider: "SoterAI" }) });
        this.memorySession = sessionId; return sessionId;
    }
    async endMemorySession(): Promise<void> {
        const sessionId = this.memorySessionId; if (!sessionId) return;
        await this.request("/v1/memory/session/end", { method: "POST", body: JSON.stringify({ sessionId }) }); this.memorySession = undefined;
    }
    async clearMemorySession(): Promise<void> {
        const sessionId = this.memorySessionId;
        await this.request("/v1/memory/session/clear", { method: "POST", body: JSON.stringify({ sessionId }) }); this.memorySession = undefined;
    }
    async recordMemoryEvent(event: Record<string, unknown>): Promise<void> {
        const sessionId = this.memorySessionId ?? await this.startMemorySession();
        await this.request("/v1/memory/session/event", { method: "POST", body: JSON.stringify({ sessionId, event }) });
    }
    dispose(): void { this.disposed = true; this.memorySession = undefined; this.listeners.forEach(listener => listener.dispose()); void this.lifecycle.dispose(); }
    private isLockedDown(): boolean { return Boolean(this.context.globalState.get<LockdownRecord>(LOCKDOWN_STATE_KEY)?.active); }
}
let activeManager: BrokerManager | undefined;
export function setBrokerManager(manager: BrokerManager): void { activeManager = manager; }
export function getBrokerManager(): BrokerManager | undefined { return activeManager; }
