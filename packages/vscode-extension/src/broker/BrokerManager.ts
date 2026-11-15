import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { types } from "node:util";
import { LOCKDOWN_STATE_KEY, type LockdownRecord } from "../protection/LockdownState";
import { BrokerStartFailure } from "./autoStart";
import { CanaryManager } from "../firewall/CanaryManager";
import { brokerChildEnvironment } from "../security/childEnvironment";
import { OwnedBrokerLifecycle, type OwnedBrokerOptions, type OwnedBrokerRequest, type OwnedBrokerSnapshot } from "./OwnedBrokerLifecycle";
import { VaultManager } from "../firewall/VaultManager";
import type { GatewayRegistrationLease, GatewayRegistrySource } from "./GatewayRegistryLease";
import { selfHygieneEnabled } from "../self-hygiene/SelfHygieneFlags";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";
import { readBoundedResponseBody } from "../security/boundedResponse";

export const EXPECTED_BROKER_VERSION = "0.2.0";
export { BrokerStartFailure } from "./autoStart";
export type BrokerLifecycleState = "stopped" | "starting" | "healthy" | "degraded" | "incompatible" | "error" | "stopping" | "STOP_UNCONFIRMED";
export interface BrokerStatus {
    running: boolean; url: string; state: BrokerLifecycleState; version?: string; lastError?: string; checkedAt?: string;
    restartCount?: number; safeMode?: { enabled: boolean; level: string }; memorySessionId?: string;
}
interface SavedMode { enabled: boolean; level: "developer" | "strict" | "enterprise" }
interface GatewayAdmission { check(): Promise<boolean>; session: string; failed: boolean }
export interface IsolatedAgentModelRequest { model: string; messages: unknown[]; tools: unknown[] }
function isolatedAgentBody(input: IsolatedAgentModelRequest): string {
    let nodes = 0, bytes = 0;
    const copy = (value: unknown, depth = 0): unknown => {
        if (++nodes > 8192 || depth > 24) throw Error("Isolated model request unavailable");
        if (value === null || typeof value === "boolean") return value;
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
            const size = Buffer.byteLength(value); bytes += size;
            if (size > 65536 || bytes > 1048576) throw Error("Isolated model request unavailable");
            return value;
        }
        if (!value || typeof value !== "object" || types.isProxy(value)
            || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value)) || Object.getOwnPropertySymbols(value).length) throw Error("Isolated model request unavailable");
        const fields = Object.getOwnPropertyDescriptors(value);
        const get = (key: string) => { if (!fields[key] || !("value" in fields[key])) throw Error("Isolated model request unavailable"); return copy(fields[key].value, depth + 1); };
        if (Array.isArray(value)) {
            if (value.length > 256 || Object.keys(fields).length !== value.length + 1) throw Error("Isolated model request unavailable");
            return Array.from({ length: value.length }, (_, index) => get(String(index)));
        }
        if (Object.keys(fields).length > 256) throw Error("Isolated model request unavailable");
        return Object.fromEntries(Object.keys(fields).map(key => [key, get(key)]));
    };
    const body = copy(input) as IsolatedAgentModelRequest;
    if (!body || Object.keys(body).sort().join(",") !== "messages,model,tools" || typeof body.model !== "string" || !body.model.trim() || body.model.length > 256
        || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 128 || !Array.isArray(body.tools) || body.tools.length > 16) throw Error("Isolated model request unavailable");
    return decodeBoundedJson(Buffer.from(JSON.stringify({ ...body, stream: false }))).canonical;
}
function codexAdapterFlags(): boolean[] {
    const config = vscode.workspace.getConfiguration("soterai");
    return ["lite.codexCliAdapter", "lite.codexIdeAdapter"].map(name => {
        const inspected = config.inspect<boolean>(name);
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get(name, true)) === true;
    });
}

/** One window owns one private IPC child. No saved token/PID/port is adopted. */
export class BrokerManager implements vscode.Disposable {
    private readonly canaries: CanaryManager;
    private readonly lifecycle: OwnedBrokerLifecycle;
    private readonly listeners: vscode.Disposable[];
    private memorySession?: string;
    private disposed = false;
    private gatewayLease?: GatewayRegistrationLease;
    private gatewayGeneration = "";
    private gatewayMode?: SavedMode;
    private registryEpoch = 0;
    private readonly admissions = new Map<string, GatewayAdmission>();
    private admissionEpoch = 0;
    private readonly isolatedRequests = new Set<AbortController>();
    private readonly isolatedFetch: typeof fetch;
    constructor(private readonly context: vscode.ExtensionContext,
        transport: Pick<OwnedBrokerOptions, "launch" | "fetchImpl" | "startupMs" | "stopMs"> = {},
        private readonly registrySource: GatewayRegistrySource = new VaultManager(context)) {
        this.isolatedFetch = transport.fetchImpl ?? fetch;
        this.canaries = new CanaryManager(context);
        // User input never controls the executable or argv: only the bundled entry.
        this.lifecycle = new OwnedBrokerLifecycle({ ...transport, script: context.asAbsolutePath("dist/local-ai-broker.js"),
            enabled: () => this.enabled(), fingerprint: () => this.binding(), prepare: () => this.prepare(), initialize: request => this.initialize(request),
            gatewayGuard: generation => this.gatewayAdmissionCurrent(generation),
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
        return JSON.stringify([this.enabled(), vscode.workspace.isTrusted, selfHygieneEnabled(),
            config.get("broker.openAIProviderUrl", ""), config.get("broker.anthropicProviderUrl", ""), this.jsonEnabled(), this.gzipEnabled(), this.brotliEnabled(), this.deflateEnabled(), this.chunkedEnabled(), this.framedEnabled(), this.multipartEnabled(), this.base64Enabled(),
            this.gatewayEnabled(), this.gatewayDependencies(), this.clineSchemasEnabled(), this.claudeSchemasEnabled(), codexAdapterFlags(), this.codexResponsesEnabled(), config.get("broker.codexResponsesProviderUrl", ""), this.geminiEnabled(), this.geminiBase(), this.savedMode(), this.gatewayLease?.available() ?? true]);
    }
    private clineSchemasEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.clineAdapter");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.clineAdapter", true)) === true;
    }
    private claudeSchemasEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.claudeAdapter");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.claudeAdapter", true)) === true;
    }
    private gatewayEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayPolicy");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayPolicy", true)) === true;
    }
    private codexResponsesEnabled(): boolean {
        return codexAdapterFlags().some(Boolean);
    }
    private geminiEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.geminiCliAdapter");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.geminiCliAdapter", true)) === true;
    }
    private geminiBase(): string {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<string>("broker.geminiProviderUrl");
        const value = inspected ? inspected.globalValue ?? inspected.defaultValue ?? "" : config.get("broker.geminiProviderUrl", "");
        if (typeof value !== "string") throw Error("Gemini provider unavailable"); return value;
    }
    private gatewayDependencies(): boolean {
        const config = vscode.workspace.getConfiguration("soterai");
        return ["lite.secretMatching", "lite.outputRedactor", "lite.vaultMode"].every(name => { const inspected = config.inspect<boolean>(name);return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get(name, true)) === true; });
    }
    private gatewayCurrent(generation: string): boolean {
        try { return generation === this.gatewayGeneration && this.gatewayEnabled() && this.gatewayDependencies() && this.enabled()
            && ![...this.admissions.values()].some(entry => entry.failed)
            && this.gatewayLease?.available() === true && JSON.stringify(this.gatewayMode) === JSON.stringify(this.savedMode()); } catch { return false; }
    }
    /** Whole-window admission for an explicitly configured cooperative adapter. */
    registerGatewayAdmissionGuard(id: string, check: () => Promise<boolean>): vscode.Disposable {
        const owner = this.lifecycle.snapshot();
        if (this.disposed || !/^[a-z][a-z0-9.-]{0,63}$/.test(id) || typeof check !== "function" || this.admissions.has(id)
            || owner.state !== "healthy" || !owner.session) throw Error("Managed admission unavailable");
        const entry: GatewayAdmission = { check, session: owner.session, failed: false };
        this.admissions.set(id, entry); this.admissionEpoch++;
        return { dispose: () => {
            if (this.admissions.get(id) !== entry) return;
            // Never turn a running guarded generation into an unguarded one.
            entry.failed = true; this.admissionEpoch++; this.withdraw(); this.admissions.delete(id);
        } };
    }
    private async gatewayAdmissionCurrent(generation: string): Promise<boolean> {
        if (!this.gatewayCurrent(generation)) return false;
        const epoch = this.admissionEpoch, owner = this.lifecycle.snapshot(), entries = [...this.admissions.values()];
        const decisions = await Promise.all(entries.map(async entry => {
            let timer: ReturnType<typeof setTimeout> | undefined, allowed = false;
            try {
                if (!entry.failed && entry.session === owner.session) allowed = await Promise.race([
                    Promise.resolve().then(() => entry.check()),
                    new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 750); timer.unref?.(); }),
                ]) === true;
            } catch { /* Do not expose adapter state or exception text. */ }
            finally { if (timer) clearTimeout(timer); }
            if (!allowed) entry.failed = true;
            return allowed;
        }));
        if (!decisions.every(Boolean) || epoch !== this.admissionEpoch || !this.gatewayCurrent(generation)
            || owner.state !== "healthy" || this.lifecycle.snapshot().session !== owner.session) {
            if (this.lifecycle.snapshot().session === owner.session) this.withdraw();
            return false;
        }
        return true;
    }
    private releaseRegistry(): void { this.registryEpoch++;this.gatewayLease?.dispose();this.gatewayLease = undefined;this.gatewayGeneration = "";this.gatewayMode = undefined; }
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
    private chunkedEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayChunkedBodies");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayChunkedBodies", true)) === true;
    }
    private framedEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayFramedBodies");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayFramedBodies", true)) === true;
    }
    private multipartEnabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayMultipartBodies");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayMultipartBodies", true)) === true;
    }
    private base64Enabled(): boolean {
        const config = vscode.workspace.getConfiguration("soterai"), inspected = config.inspect<boolean>("lite.gatewayBase64Bodies");
        return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : config.get("lite.gatewayBase64Bodies", true)) === true;
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
        if (this.gatewayEnabled()) {
            if (!this.gatewayDependencies()) throw new Error("Gateway dependencies unavailable");
            const epoch = this.registryEpoch, mode = this.savedMode(), lease = await this.registrySource.createGatewayRegistry(() => this.enabled() && this.gatewayEnabled() && this.gatewayDependencies());
            if (epoch !== this.registryEpoch || !lease.available() || JSON.stringify(mode) !== JSON.stringify(this.savedMode())) { lease.dispose();throw new Error("Gateway registry unavailable"); }
            this.gatewayLease?.dispose();this.gatewayLease = lease;this.gatewayGeneration = randomUUID();this.gatewayMode = mode;
        }
        const config = vscode.workspace.getConfiguration("soterai");
        const providerKey = vscode.workspace.isTrusted ? await this.context.secrets.get("soterai.providerApiKey") : undefined;
        if (!this.enabled()) throw new Error("Broker unavailable");
        return { ...brokerChildEnvironment(process.env), SOTERAI_SELF_HYGIENE: selfHygieneEnabled() ? "1" : "0", SOTERAI_OPENAI_PROVIDER_URL: config.get<string>("broker.openAIProviderUrl", ""),
            SOTERAI_GEMINI_GENERATE_CONTENT: this.geminiEnabled() ? "1" : "0", SOTERAI_GEMINI_PROVIDER_URL: this.geminiBase(),
            SOTERAI_CODEX_RESPONSES_PROVIDER_URL: config.get<string>("broker.codexResponsesProviderUrl", ""), SOTERAI_CODEX_RESPONSES: this.codexResponsesEnabled() ? "1" : "0",
            SOTERAI_ANTHROPIC_PROVIDER_URL: config.get<string>("broker.anthropicProviderUrl", ""), SOTERAI_PROVIDER_API_KEY: providerKey, SOTERAI_GATEWAY_JSON_BODIES: this.jsonEnabled() ? "1" : "0", SOTERAI_GATEWAY_GZIP_BODIES: this.gzipEnabled() ? "1" : "0", SOTERAI_GATEWAY_BROTLI_BODIES: this.brotliEnabled() ? "1" : "0", SOTERAI_GATEWAY_DEFLATE_BODIES: this.deflateEnabled() ? "1" : "0", SOTERAI_GATEWAY_CHUNKED_BODIES: this.chunkedEnabled() ? "1" : "0", SOTERAI_GATEWAY_FRAMED_BODIES: this.framedEnabled() ? "1" : "0", SOTERAI_GATEWAY_MULTIPART_BODIES: this.multipartEnabled() ? "1" : "0", SOTERAI_GATEWAY_BASE64_BODIES: this.base64Enabled() ? "1" : "0", SOTERAI_GATEWAY_POLICY: this.gatewayEnabled() ? "1" : "0", SOTERAI_CLINE_TOOL_SCHEMAS: this.clineSchemasEnabled() ? "1" : "0", SOTERAI_CLAUDE_TOOL_SCHEMAS: this.claudeSchemasEnabled() ? "1" : "0", SOTERAI_REQUIRE_GATEWAY_SYNC: "1" };
    }
    private async initialize(request: OwnedBrokerRequest): Promise<void> {
        const mode = this.savedMode(), registry = await this.canaries.loadForScan();
        const sync = await request<{ synchronized: boolean; count: number }>("/v1/canaries/sync", { method: "POST", body: JSON.stringify({ canaries: registry }) });
        if (sync.synchronized !== true || sync.count !== registry.length) throw new Error("Registry unavailable");
        const checkMode = (value: { enabled: boolean; level: string }, expected: SavedMode) => { if (value.enabled !== expected.enabled || value.level !== expected.level) throw new Error("Policy acknowledgment unavailable"); };
        checkMode(await request("/v1/safe-mode/enable", { method: "POST", body: JSON.stringify({ level: mode.level }) }), { enabled: true, level: mode.level });
        if (!mode.enabled) checkMode(await request("/v1/safe-mode/disable", { method: "POST", body: "{}" }), mode);
        checkMode(await request("/v1/safe-mode/status"), mode);
        if (JSON.stringify(mode) !== JSON.stringify(this.savedMode()) || !this.enabled()) throw new Error("Policy changed");
        if (this.gatewayEnabled()) {
            if (!this.gatewayLease || !this.gatewayCurrent(this.gatewayGeneration)) throw new Error("Gateway registry unavailable");
            const generation = this.gatewayGeneration;
            const result = await this.gatewayLease.use(values => request<{ version: number; synchronized: boolean; generation: string }>("/v1/gateway/sync", { method: "POST", body: JSON.stringify({ version: 1, generation, mode, values: [...values, ...registry.map(c => c.token)] }) }));
            if (result.version !== 1 || result.synchronized !== true || result.generation !== generation || !this.gatewayCurrent(generation)) throw new Error("Gateway synchronization unavailable");
        }
    }
    private withdraw(): void { this.memorySession = undefined; this.releaseRegistry(); for (const request of this.isolatedRequests) request.abort(); this.lifecycle.invalidate(); void this.lifecycle.stop(); }
    ownedSnapshot(): OwnedBrokerSnapshot { return this.lifecycle.snapshot(); }
    get port(): number { return this.lifecycle.snapshot().port ?? 0; }
    get url(): string { return this.lifecycle.snapshot().url ?? "http://127.0.0.1:0"; }
    get memorySessionId(): string | undefined { return this.lifecycle.snapshot().state === "healthy" ? this.memorySession : undefined; }
    async getClientToken(): Promise<string> { return this.lifecycle.clientToken(); }
    async start(): Promise<BrokerStatus> {
        if (this.isLockedDown()) throw new BrokerStartFailure("Emergency Lockdown is active; broker start is blocked", false);
        const owner = this.lifecycle.snapshot();
        if ([...this.admissions.values()].some(entry => entry.failed || owner.state !== "healthy" || entry.session !== owner.session))
            throw new BrokerStartFailure("A configured managed session was withdrawn. Restore its reviewed configuration before restarting this window's broker.", false);
        try { await this.lifecycle.start(); const status = await this.status(); if (!status.running || status.state !== "healthy") throw new Error("Health unavailable"); return status; }
        catch { throw new BrokerStartFailure("Owned local broker unavailable; protection for routed requests is unavailable. Review broker status and restart.", false); }
    }
    async stop(): Promise<void> { this.memorySession = undefined;this.releaseRegistry(); for (const request of this.isolatedRequests) request.abort(); await this.lifecycle.stop(); }
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
            if (JSON.stringify({ enabled: safeMode.enabled, level: safeMode.level }) !== JSON.stringify(this.savedMode())) throw new Error("Policy mismatch");
            const gateway = await this.lifecycle.request<{ version: number; enabled: boolean; ready: boolean; generation?: string; clineToolSchemas?: boolean; claudeToolSchemas?: boolean; codexResponses?: boolean; geminiGenerateContent?: boolean }>("/v1/gateway/status");
            if (gateway.version !== 1 || gateway.enabled !== this.gatewayEnabled() || gateway.clineToolSchemas !== this.clineSchemasEnabled() || gateway.claudeToolSchemas !== this.claudeSchemasEnabled() || gateway.codexResponses !== this.codexResponsesEnabled() || gateway.geminiGenerateContent !== this.geminiEnabled() || this.gatewayEnabled() && (!gateway.ready || gateway.generation !== this.gatewayGeneration || !this.gatewayCurrent(this.gatewayGeneration))) throw new Error("Gateway unavailable");
            return { ...base(), running: true, state: "healthy", version: EXPECTED_BROKER_VERSION, safeMode, memorySessionId: this.memorySessionId };
        } catch { this.withdraw(); snapshot = this.lifecycle.snapshot(); return { ...base(), lastError: "Owned broker health unavailable; requests withheld." }; }
    }
    async request<T>(route: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
        if (!this.enabled()) { this.withdraw(); throw new Error("Owned broker unavailable; requests withheld."); }
        return this.lifecycle.request<T>(route, init, timeoutMs);
    }
    /** Guest requests get a fixed guarded data route; the bearer never leaves the host. */
    async requestIsolatedAgentModel(input: IsolatedAgentModelRequest, signal?: AbortSignal): Promise<unknown> {
        const unavailable = () => new Error("Isolated agent model request unavailable; output withheld.");
        let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined;
        const abort = () => controller?.abort();
        try {
            const body = isolatedAgentBody(input), owner = this.lifecycle.snapshot(), generation = this.gatewayGeneration;
            const current = () => !signal?.aborted && !controller?.signal.aborted && this.enabled() && this.gatewayCurrent(generation)
                && this.lifecycle.snapshot().state === "healthy" && this.lifecycle.snapshot().session === owner.session;
            if (!owner.url || owner.state !== "healthy" || !current() || !await this.gatewayAdmissionCurrent(generation) || !current()) throw unavailable();
            controller = new AbortController(); this.isolatedRequests.add(controller);
            signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) controller.abort();
            timer = setTimeout(abort, 30000); timer.unref?.();
            const response = await this.isolatedFetch(owner.url + "/v1/ai/openai-compatible/chat/completions", {
                method: "POST", headers: { authorization: "Bearer " + this.lifecycle.clientToken(), "content-type": "application/json" },
                body, redirect: "error", signal: controller.signal,
            });
            if (!response.ok || !/^application\/json(?:[ \t]*;[ \t]*charset=utf-8)?$/i.test(response.headers.get("content-type") ?? "")) {
                await response.body?.cancel(); throw unavailable();
            }
            const text = await readBoundedResponseBody(response);
            if (!current() || !await this.gatewayAdmissionCurrent(generation) || !current()) throw unavailable();
            return decodeBoundedJson(Buffer.from(text)).body;
        } catch { throw unavailable(); }
        finally { if (timer) clearTimeout(timer); signal?.removeEventListener("abort", abort); if (controller) this.isolatedRequests.delete(controller); }
    }
    async rotateToken(): Promise<void> { await this.restart(); }
    async clearToken(): Promise<void> { await this.stop(); }
    async startMemorySession(): Promise<string> {
        if (!selfHygieneEnabled()) throw new Error("Owned activity recording is disabled.");
        await this.start();
        if (!selfHygieneEnabled()) throw new Error("Owned activity recording is disabled.");
        const response = await this.request<{ session: { sessionId: string } }>("/v1/memory/session/start", { method: "POST", body: "{}" });
        const sessionId = response?.session?.sessionId;
        if (!selfHygieneEnabled() || typeof sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(sessionId)) throw new Error("Owned activity session unavailable.");
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
        if (!selfHygieneEnabled()) return;
        const sessionId = this.memorySessionId ?? await this.startMemorySession();
        await this.request("/v1/memory/session/event", { method: "POST", body: JSON.stringify({ sessionId, event }) });
    }
    dispose(): void { this.disposed = true; this.memorySession = undefined; this.releaseRegistry(); for (const request of this.isolatedRequests) request.abort(); this.listeners.forEach(listener => listener.dispose()); void this.lifecycle.dispose(); }
    private isLockedDown(): boolean { return Boolean(this.context.globalState.get<LockdownRecord>(LOCKDOWN_STATE_KEY)?.active); }
}
let activeManager: BrokerManager | undefined;
export function setBrokerManager(manager: BrokerManager): void { activeManager = manager; }
export function getBrokerManager(): BrokerManager | undefined { return activeManager; }
