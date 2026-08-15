import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
    ApprovalStore,
    analyzeControlledTerminalCommand,
    classifyRestoration,
    DecisionEngine,
    discoverRuntimeCapabilities,
    evaluateFileOperation,
    evaluateExtensionIsolation,
    evaluateMCPToolInvocation,
    evaluateNetworkEgress,
    evaluatePolicyChange,
    evaluateProcessLaunch,
    MemoryStore,
    createApprovalGrant,
    generateSafeModePolicy,
    redactForSharing,
    findSurvivingSecrets,
    scanBrokerRequest,
    scanBrokerResponse,
    shouldForward,

    type ApprovalScope,
    type BrokerMessage,
    type Canary,
    type CheckpointSideEffect,
    type FileOperation,
    type GuardAction,
    type GovernanceRole,
    type MemoryEvent,
    type MemoryEventKind,
    type MemorySource,
    type MCPPermission,
    type ProcessFilesystemMode,
    type ProcessNetworkMode,
    type ProcessSandboxStrength,
    type ProtectionMode,
    type SafeModeLevel,
    type TaintedSource,
} from "@soterai/guard-core";
import { tokenMatches } from "./auth";
import {
    CheckpointScopeError,
    FilesystemCheckpointStore,
    type FilesystemCheckpointStoreOptions,
} from "./CheckpointStore";

const execFileAsync = promisify(execFile);

export const BROKER_VERSION = "0.1.0";
export const DEFAULT_BROKER_PORT = 47321;
export const BROKER_HOST = "127.0.0.1" as const;

export interface SafeBrokerEvent {
    eventId: string;
    sessionId?: string;
    timestamp: string;
    source: "broker";
    eventType: string;
    decision: GuardAction;
    riskScore: number;
    categories: string[];
    redactedEvidence?: string;
    contentHash?: string;
    responseHash?: string;
    model?: string;
    provider?: string;
    safeMode: boolean;
    policyVersion: string;
}

export interface BrokerServerOptions {
    token: string;
    port?: number;
    bodyLimitBytes?: number;
    requestTimeoutMs?: number;
    rateLimitPerMinute?: number;
    /** Budget for /health, /version and /v1/safe-mode/status, metered separately. */
    livenessRateLimitPerMinute?: number;
    allowedOrigins?: string[];
    openAIProviderUrl?: string;
    anthropicProviderUrl?: string;
    providerApiKey?: string;
    fetchImpl?: typeof fetch;
    terminalExecutor?: (executable: string, args: string[], options: { timeoutMs: number; maxBufferBytes: number }) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    logger?: (message: string, metadata?: Record<string, unknown>) => void;
    canaries?: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>;
    /**
     * Enables the real reversible checkpoint/rollback resource adapter. Omitted
     * by default: without an operator-configured isolation root there is no
     * resource SoterAI is allowed to snapshot or restore, so the endpoints
     * answer 501 rather than pretending to protect something.
     */
    checkpoint?: FilesystemCheckpointStoreOptions;
}

interface JsonBody { [key: string]: unknown }

class HttpError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message);
    }
}

export class BrokerServer {
    private readonly server: Server;
    private readonly engine = new DecisionEngine();
    private readonly memory = new MemoryStore();
    private readonly approvals = new ApprovalStore();
    private readonly events: SafeBrokerEvent[] = [];
    private readonly rateBuckets = new Map<string, { minute: number; count: number }>();
    private safeMode = { enabled: false, level: "developer" as SafeModeLevel };
    private startedAt?: string;
    private readonly checkpoints?: FilesystemCheckpointStore;

    constructor(private readonly options: BrokerServerOptions) {
        if (!options.token || options.token.length < 32) throw new Error("A broker auth token of at least 32 characters is required");
        this.checkpoints = options.checkpoint ? new FilesystemCheckpointStore(options.checkpoint) : undefined;
        this.server = createServer((req, res) => void this.handle(req, res));
        this.server.requestTimeout = options.requestTimeoutMs ?? 30_000;
        this.server.headersTimeout = Math.min(this.server.requestTimeout, 15_000);
    }

    async start(): Promise<{ host: typeof BROKER_HOST; port: number; url: string }> {
        if (this.server.listening) return this.address();
        const port = this.options.port ?? DEFAULT_BROKER_PORT;
        await new Promise<void>((resolve, reject) => {
            const onError = (error: Error) => { this.server.off("listening", onListening); reject(error); };
            const onListening = () => { this.server.off("error", onError); resolve(); };
            this.server.once("error", onError);
            this.server.once("listening", onListening);
            this.server.listen(port, BROKER_HOST);
        });
        this.startedAt = new Date().toISOString();
        this.safeLog("broker_started", { host: BROKER_HOST, port: this.address().port });
        return this.address();
    }

    async stop(): Promise<void> {
        if (!this.server.listening) return;
        await new Promise<void>((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
    }

    address(): { host: typeof BROKER_HOST; port: number; url: string } {
        const address = this.server.address();
        const port = typeof address === "object" && address ? address.port : (this.options.port ?? DEFAULT_BROKER_PORT);
        return { host: BROKER_HOST, port, url: `http://${BROKER_HOST}:${port}` };
    }

    private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const requestId = randomUUID();
        try {
            this.applySecurityHeaders(res);
            this.enforceOrigin(req);
            const url = new URL(req.url ?? "/", `http://${BROKER_HOST}`);
            if (req.method === "OPTIONS") throw new HttpError(405, "cors_disabled", "Browser cross-origin requests are disabled");

            // Liveness is metered separately, and generously. The shared budget
            // exists to stop a local process from burning provider quota through
            // the proxy; charging liveness probes against it made the client its
            // own attacker. The editor polls these three endpoints on a timer and
            // again on every start attempt, so a single click could spend most of
            // a minute's allowance — and once the limit tripped, /version began
            // answering 429, the editor read that as "the broker is gone", and
            // every protected feature failed while the broker sat there healthy.
            //
            // Still metered, at a ceiling no legitimate client approaches, so a
            // runaway loop cannot spin the CPU on JSON responses.
            const liveness = req.method === "GET" &&
                (url.pathname === "/health" || url.pathname === "/version" || url.pathname === "/v1/safe-mode/status");
            this.enforceRateLimit(req, liveness);

            if (req.method === "GET" && url.pathname === "/health") {
                return this.json(res, 200, { status: "ok", localOnly: true, host: BROKER_HOST, startedAt: this.startedAt });
            }
            if (!tokenMatches(req.headers.authorization, this.options.token)) {
                throw new HttpError(401, "unauthorized", "A valid local broker bearer token is required");
            }

            if (req.method === "GET" && url.pathname === "/version") {
                return this.json(res, 200, { name: "@soterai/local-ai-broker", version: BROKER_VERSION });
            }
            if (req.method === "GET" && url.pathname === "/v1/safe-mode/status") {
                return this.json(res, 200, { ...this.safeMode, rules: generateSafeModePolicy(this.safeMode.level).rules });
            }
            if (req.method === "GET" && url.pathname === "/v1/events/recent") {
                return this.json(res, 200, { events: this.events.slice(-100) });
            }
            if (req.method === "POST" && url.pathname === "/v1/events/export-redacted") {
                return this.json(res, 200, { generatedAt: new Date().toISOString(), events: this.events, memory: this.memory.exportRedacted() });
            }
            if (req.method === "GET" && url.pathname === "/v1/approvals") {
                return this.json(res, 200, { approvals: this.approvals.list() });
            }
            const memoryMatch = url.pathname.match(/^\/v1\/memory\/session\/([^/]+)$/);
            if (req.method === "GET" && memoryMatch) {
                const session = this.memory.getSession(decodeURIComponent(memoryMatch[1]));
                if (!session) throw new HttpError(404, "session_not_found", "Memory session not found");
                return this.json(res, 200, { session });
            }

            const body = await this.readJson(req);
            if (req.method === "POST" && url.pathname === "/v1/scan") return void await this.scanEndpoint(res, body);
            if (req.method === "POST" && url.pathname === "/v1/redact") return this.redactEndpoint(res, body);
            if (req.method === "POST" && url.pathname === "/v1/decision") return void await this.scanEndpoint(res, body);
            if (req.method === "POST" && url.pathname === "/v1/safe-mode/enable") return this.enableSafeMode(res, body);
            if (req.method === "POST" && url.pathname === "/v1/safe-mode/disable") return this.disableSafeMode(res);
            if (req.method === "POST" && url.pathname === "/v1/memory/session/start") return this.startMemory(res, body);
            if (req.method === "POST" && url.pathname === "/v1/memory/session/event") return this.addMemoryEvent(res, body);
            if (req.method === "POST" && url.pathname === "/v1/memory/session/end") return this.endMemory(res, body);
            if (req.method === "POST" && url.pathname === "/v1/memory/session/clear") return this.clearMemory(res, body);
            if (req.method === "POST" && url.pathname === "/v1/approvals") return void await this.createApproval(res, body);
            if (req.method === "POST" && url.pathname === "/v1/approvals/clear") { this.approvals.clear(); return this.json(res, 200, { cleared: true }); }
            if (req.method === "POST" && url.pathname === "/v1/auth/rotate") return this.rotateAuth(res, body);
            if (req.method === "POST" && url.pathname === "/v1/terminal/preview") return this.previewTerminal(res, body);
            if (req.method === "POST" && url.pathname === "/v1/terminal/execute") return void await this.executeTerminal(res, body);
            if (req.method === "POST" && url.pathname === "/v1/preflight/runtime-capabilities") return this.previewRuntimeCapabilities(res, body);
            if (req.method === "POST" && url.pathname === "/v1/preflight/file-operation") return this.previewFileOperation(res, body);
            if (req.method === "POST" && url.pathname === "/v1/preflight/network-egress") return this.previewNetworkEgress(res, body);
            if (req.method === "POST" && url.pathname === "/v1/preflight/mcp-tool") return this.previewMCPTool(res, body);
            if (req.method === "POST" && url.pathname === "/v1/preflight/policy-change") return this.previewPolicyChange(res, body);
            if (req.method === "POST" && url.pathname === "/v1/preflight/process-launch") return this.previewProcessLaunch(res, body);
            if (req.method === "POST" && url.pathname === "/v1/preflight/extension-isolation") return this.previewExtensionIsolation(res, body);
            if (req.method === "POST" && url.pathname === "/v1/checkpoint/create") return void await this.createCheckpoint(res, body, req);
            if (req.method === "POST" && url.pathname === "/v1/checkpoint/rollback") return void await this.rollbackCheckpoint(res, body, req);
            if (req.method === "POST" && url.pathname === "/v1/ai/openai-compatible/chat/completions") {
                return void await this.proxyOpenAI(res, body, req);
            }
            if (req.method === "POST" && url.pathname === "/v1/ai/anthropic-compatible/messages") {
                return void await this.proxyAnthropic(res, body, req);
            }
            throw new HttpError(404, "not_found", "Endpoint not found");
        } catch (error) {
            const status = error instanceof HttpError ? error.status : 500;
            const code = error instanceof HttpError ? error.code : "internal_error";
            const message = error instanceof HttpError ? error.message : "The local broker could not complete the request";
            this.safeLog("request_failed", { requestId, status, code });
            if (!res.headersSent) {
                this.json(res, status, {
                    error: {
                        code,
                        message,
                        requestId,
                        ...(error instanceof HttpError && error.details ? { details: error.details } : {}),
                    },
                });
            }
            else res.end();
        }
    }

    private async scanEndpoint(res: ServerResponse, body: JsonBody): Promise<void> {
        const messages = normalizeMessages(body.messages ?? [{ role: "user", content: body.content }]);
        const result = await scanBrokerRequest(messages, { engine: this.engine, safeMode: this.safeMode, canaries: this.options.canaries });
        this.record({ eventType: "broker_request_scanned", decision: result.decision, riskScore: result.riskScore, categories: result.categories, contentHash: result.contentHash, redactedEvidence: result.evidencePreview });
        this.json(res, 200, safeRequestResult(result));
    }

    private redactEndpoint(res: ServerResponse, body: JsonBody): void {
        if (typeof body.content !== "string") throw new HttpError(400, "invalid_request", "content must be a string");
        this.json(res, 200, { redacted: redactForSharing(body.content), contentHashPending: false });
    }

    private enableSafeMode(res: ServerResponse, body: JsonBody): void {
        const level = parseSafeModeLevel(body.level);
        this.safeMode = { enabled: true, level };
        this.record({ eventType: "safe_mode_enabled", decision: "allow", riskScore: 0, categories: [level] });
        this.json(res, 200, { ...this.safeMode, rules: generateSafeModePolicy(level).rules });
    }

    private disableSafeMode(res: ServerResponse): void {
        this.safeMode = { ...this.safeMode, enabled: false };
        this.record({ eventType: "safe_mode_disabled", decision: "allow", riskScore: 0, categories: [] });
        this.json(res, 200, this.safeMode);
    }

    private startMemory(res: ServerResponse, body: JsonBody): void {
        const sessionId = stringValue(body.sessionId) ?? randomUUID();
        const session = this.memory.startSession({ sessionId, source: "broker", tool: stringValue(body.tool), provider: stringValue(body.provider) });
        this.record({ sessionId, eventType: "memory_session_started", decision: "allow", riskScore: 0, categories: [] });
        this.json(res, 201, { session });
    }

    private addMemoryEvent(res: ServerResponse, body: JsonBody): void {
        const sessionId = requireString(body.sessionId, "sessionId");
        const input = body.event;
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "invalid_request", "event must be an object");
        const event = input as Partial<MemoryEvent>;
        const clean = this.memory.addEvent(sessionId, {
            eventId: stringValue(event.eventId) ?? randomUUID(),
            timestamp: stringValue(event.timestamp) ?? new Date().toISOString(),
            kind: (stringValue(event.kind) ?? "broker_request_scanned") as MemoryEventKind,
            source: parseMemorySource(event.source),
            decision: parseAction(event.decision),
            riskScore: numberValue(event.riskScore),
            categories: stringArray(event.categories),
            redactedEvidence: stringValue(event.redactedEvidence),
            requestHash: stringValue(event.requestHash),
            responseHash: stringValue(event.responseHash),
            filePaths: stringArray(event.filePaths),
            protectedFileAttempt: Boolean(event.protectedFileAttempt),
            canaryExposed: Boolean(event.canaryExposed),
            model: stringValue(event.model),
            provider: stringValue(event.provider),
            contentSize: numberValue(event.contentSize),
        });
        this.json(res, 201, { event: clean });
    }

    private endMemory(res: ServerResponse, body: JsonBody): void {
        const sessionId = requireString(body.sessionId, "sessionId");
        const session = this.memory.endSession(sessionId);
        if (!session) throw new HttpError(404, "session_not_found", "Memory session not found");
        this.record({ sessionId, eventType: "memory_session_ended", decision: "allow", riskScore: 0, categories: [] });
        this.json(res, 200, { session });
    }

    private clearMemory(res: ServerResponse, body: JsonBody): void {
        const sessionId = stringValue(body.sessionId);
        if (sessionId) this.memory.clearSession(sessionId); else this.memory.clearAll();
        this.json(res, 200, { cleared: true });
    }

    private async createApproval(res: ServerResponse, body: JsonBody): Promise<void> {
        const scope = (stringValue(body.scope) ?? "once") as ApprovalScope;
        if (!(["once", "session", "workspace"] as string[]).includes(scope)) throw new HttpError(400, "invalid_scope", "scope must be once, session, or workspace");
        const grant = await createApprovalGrant({
            sessionId: requireString(body.sessionId, "sessionId"),
            contentHash: requireString(body.contentHash, "contentHash"),
            decision: "approval_required",
            outcome: body.outcome === "redact_and_allow" ? "redact_and_allow" : body.outcome === "deny" ? "deny" : "approve",
            scope,
        });
        this.approvals.add(grant);
        this.record({ sessionId: grant.sessionId, eventType: grant.outcome === "deny" ? "approval_denied" : "approval_granted", decision: grant.outcome === "deny" ? "block" : "allow", riskScore: 0, categories: [], contentHash: grant.contentHash });
        this.json(res, 201, { approval: this.approvals.list().find((item) => item.id === grant.id) });
    }

    private rotateAuth(res: ServerResponse, body: JsonBody): void {
        const next = requireString(body.token, "token");
        if (next.length < 32) throw new HttpError(400, "weak_token", "The replacement token must be at least 32 characters");
        this.options.token = next;
        this.json(res, 200, { rotated: true });
    }

    private previewTerminal(res: ServerResponse, body: JsonBody): void {
        const command = requireString(body.command, "command");
        const analysis = analyzeControlledTerminalCommand(command, { protectionMode: brokerProtectionMode(this.safeMode) });
        this.record({
            eventType: "terminal_command_previewed",
            decision: analysis.action === "DENY" ? "block" : analysis.action === "ASK" ? "approval_required" : "allow",
            riskScore: analysis.riskScore,
            categories: analysis.categories,
            redactedEvidence: analysis.reasonCodes.join(","),
        });
        this.json(res, 200, safeTerminalAnalysis(analysis));
    }

    private async executeTerminal(res: ServerResponse, body: JsonBody): Promise<void> {
        const command = requireString(body.command, "command");
        const analysis = analyzeControlledTerminalCommand(command, { protectionMode: brokerProtectionMode(this.safeMode) });
        if (analysis.action !== "ALLOW" || !analysis.executable) {
            this.record({
                eventType: "terminal_command_blocked",
                decision: "block",
                riskScore: analysis.riskScore,
                categories: analysis.categories,
                redactedEvidence: analysis.reasonCodes.join(","),
            });
            throw new HttpError(403, "terminal_command_denied", "The controlled terminal policy denied this command before execution");
        }
        const timeoutMs = boundedNumber(body.timeoutMs, 10_000, 1_000, 30_000);
        const maxBufferBytes = boundedNumber(body.maxBufferBytes, 128 * 1024, 4 * 1024, 1024 * 1024);
        const result = await this.runControlledCommand(analysis.executable, analysis.args, { timeoutMs, maxBufferBytes });
        this.record({
            eventType: "terminal_command_executed",
            decision: "allow",
            riskScore: analysis.riskScore,
            categories: analysis.categories,
            redactedEvidence: `exit=${result.exitCode}`,
        });
        this.json(res, 200, {
            analysis: safeTerminalAnalysis(analysis),
            result: {
                exitCode: result.exitCode,
                stdout: redactForSharing(result.stdout).slice(0, maxBufferBytes),
                stderr: redactForSharing(result.stderr).slice(0, maxBufferBytes),
            },
        });
    }

    private async runControlledCommand(
        executable: string,
        args: string[],
        options: { timeoutMs: number; maxBufferBytes: number },
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        if (this.options.terminalExecutor) return this.options.terminalExecutor(executable, args, options);
        try {
            const result = await execFileAsync(executable, args, {
                shell: false,
                windowsHide: true,
                timeout: options.timeoutMs,
                maxBuffer: options.maxBufferBytes,
                env: minimalTerminalEnv(process.env),
            });
            return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
        } catch (error) {
            const err = error as { stdout?: string; stderr?: string; code?: number | string };
            return {
                stdout: String(err.stdout ?? ""),
                stderr: String(err.stderr ?? "Controlled command failed"),
                exitCode: typeof err.code === "number" ? err.code : 1,
            };
        }
    }

    private previewRuntimeCapabilities(res: ServerResponse, body: JsonBody): void {
        const map = discoverRuntimeCapabilities({
            agentName: stringValue(body.agentName),
            integrationType: stringValue(body.integrationType),
            protectionMode: brokerProtectionMode(this.safeMode),
            workspaceTrusted: typeof body.workspaceTrusted === "boolean" ? body.workspaceTrusted : undefined,
            workspaceRoots: stringArray(body.workspaceRoots),
            terminalEnabled: typeof body.terminalEnabled === "boolean" ? body.terminalEnabled : undefined,
            shell: stringValue(body.shell),
            networkReach: parseNetworkReach(body.networkReach),
            gitRemotePresent: typeof body.gitRemotePresent === "boolean" ? body.gitRemotePresent : undefined,
            gitAuthAvailable: typeof body.gitAuthAvailable === "boolean" ? body.gitAuthAvailable : undefined,
            cloudContexts: stringArray(body.cloudContexts),
            kubernetesContext: stringValue(body.kubernetesContext),
            dockerSocketAvailable: typeof body.dockerSocketAvailable === "boolean" ? body.dockerSocketAvailable : undefined,
            mcpServerCount: numberValue(body.mcpServerCount),
            installedAIExtensions: stringArray(body.installedAIExtensions),
            remoteEnvironment: parseRemoteEnvironment(body.remoteEnvironment),
            sandbox: parseSandbox(body.sandbox),
            productionIndicators: stringArray(body.productionIndicators),
        });
        this.record({ eventType: "runtime_capabilities_previewed", decision: map.effectiveRisk === "critical" ? "approval_required" : "allow", riskScore: map.effectiveRiskScore, categories: map.capabilities.filter((item) => item.present).map((item) => item.id), redactedEvidence: map.unsupportedWarnings.join("; ") });
        this.json(res, 200, map);
    }

    private previewFileOperation(res: ServerResponse, body: JsonBody): void {
        const decision = evaluateFileOperation({
            operation: parseFileOperation(body.operation),
            targetPath: requireString(body.targetPath, "targetPath"),
            workspaceRoot: requireString(body.workspaceRoot, "workspaceRoot"),
            realPath: stringValue(body.realPath),
            destinationPath: stringValue(body.destinationPath),
            fileCount: numberValue(body.fileCount),
            contentPreview: stringValue(body.contentPreview),
            protectionMode: brokerProtectionMode(this.safeMode),
        });
        this.record({ eventType: "file_operation_previewed", decision: actionToGuardAction(decision.action), riskScore: decision.riskScore, categories: decision.categories, redactedEvidence: decision.reasonCodes.join(",") });
        this.json(res, 200, decision);
    }

    private previewNetworkEgress(res: ServerResponse, body: JsonBody): void {
        const decision = evaluateNetworkEgress({
            url: requireString(body.url, "url"),
            method: stringValue(body.method),
            payloadPreview: stringValue(body.payloadPreview),
            allowedHosts: stringArray(body.allowedHosts),
            protectionMode: brokerProtectionMode(this.safeMode),
            redirectChain: stringArray(body.redirectChain),
            sourceClassifications: stringArray(body.sourceClassifications),
        });
        this.record({ eventType: "network_egress_previewed", decision: actionToGuardAction(decision.action), riskScore: decision.riskScore, categories: decision.categories, redactedEvidence: decision.reasonCodes.join(",") });
        this.json(res, 200, decision);
    }

    private previewMCPTool(res: ServerResponse, body: JsonBody): void {
        const decision = evaluateMCPToolInvocation({
            mcpConfig: parseMCPConfig(body.mcpConfig),
            serverName: requireString(body.serverName, "serverName"),
            toolName: requireString(body.toolName, "toolName"),
            args: objectValue(body.args),
            protectionMode: brokerProtectionMode(this.safeMode),
            allowedPermissions: stringArray(body.allowedPermissions) as MCPPermission[],
            taintedSources: arrayObjectValue(body.taintedSources) as unknown as TaintedSource[],
        });
        this.record({ eventType: "mcp_tool_previewed", decision: actionToGuardAction(decision.action), riskScore: decision.riskScore, categories: decision.categories, redactedEvidence: decision.reasonCodes.join(",") });
        this.json(res, 200, decision);
    }

    private previewPolicyChange(res: ServerResponse, body: JsonBody): void {
        const decision = evaluatePolicyChange({
            actorRole: parseGovernanceRole(body.actorRole),
            current: objectValue(body.current) as unknown as Parameters<typeof evaluatePolicyChange>[0]["current"],
            next: objectValue(body.next) as unknown as Parameters<typeof evaluatePolicyChange>[0]["next"],
            now: stringValue(body.now),
        });
        this.record({ eventType: "policy_change_previewed", decision: decision.decision === "DENY" ? "block" : decision.decision === "ASK" ? "approval_required" : "allow", riskScore: decision.decision === "DENY" ? 90 : decision.decision === "ASK" ? 60 : 0, categories: decision.changedControls, redactedEvidence: decision.reasonCodes.join(",") });
        this.json(res, 200, decision);
    }

    private previewProcessLaunch(res: ServerResponse, body: JsonBody): void {
        const decision = evaluateProcessLaunch({
            executable: requireString(body.executable, "executable"),
            args: stringArray(body.args),
            cwd: stringValue(body.cwd),
            workspaceRoot: stringValue(body.workspaceRoot),
            env: stringRecord(body.env),
            requestedNetwork: parseProcessNetworkMode(body.requestedNetwork),
            allowedHosts: stringArray(body.allowedHosts),
            filesystemMode: parseProcessFilesystemMode(body.filesystemMode),
            allowChildProcesses: typeof body.allowChildProcesses === "boolean" ? body.allowChildProcesses : undefined,
            shell: typeof body.shell === "boolean" ? body.shell : undefined,
            productionContext: typeof body.productionContext === "boolean" ? body.productionContext : undefined,
            sandboxStrength: parseProcessSandboxStrength(body.sandboxStrength),
            protectionMode: brokerProtectionMode(this.safeMode),
        });
        this.record({ eventType: "process_launch_previewed", decision: actionToGuardAction(decision.action), riskScore: decision.riskScore, categories: decision.categories, redactedEvidence: decision.reasonCodes.join(",") });
        this.json(res, 200, decision);
    }

    private previewExtensionIsolation(res: ServerResponse, body: JsonBody): void {
        const decision = evaluateExtensionIsolation({
            extensions: arrayObjectValue(body.extensions).map((extension) => ({
                id: requireString(extension.id, "extension.id"),
                publisher: stringValue(extension.publisher),
                displayName: stringValue(extension.displayName),
                verifiedPublisher: typeof extension.verifiedPublisher === "boolean" ? extension.verifiedPublisher : undefined,
                activationEvents: stringArray(extension.activationEvents),
                capabilities: stringArray(extension.capabilities),
                aiLike: typeof extension.aiLike === "boolean" ? extension.aiLike : undefined,
            })),
            allowlist: stringArray(body.allowlist),
            blocklist: stringArray(body.blocklist),
            trustedPublishers: stringArray(body.trustedPublishers),
            workspaceTrusted: typeof body.workspaceTrusted === "boolean" ? body.workspaceTrusted : undefined,
            protectionMode: brokerProtectionMode(this.safeMode),
        });
        this.record({ eventType: "extension_isolation_previewed", decision: actionToGuardAction(decision.action), riskScore: decision.riskScore, categories: decision.findings.flatMap((finding) => finding.categories), redactedEvidence: decision.findings.map((finding) => `${finding.id}:${finding.action}`).join(",") });
        this.json(res, 200, decision);
    }

    private async proxyOpenAI(res: ServerResponse, body: JsonBody, req: IncomingMessage): Promise<void> {
        const messages = normalizeMessages(body.messages);
        const sessionId = stringValue(body.session_id) ?? stringValue(req.headers["x-soterai-session-id"]) ?? randomUUID();
        const model = stringValue(body.model);
        const scan = await scanBrokerRequest(messages, { engine: this.engine, safeMode: this.safeMode, canaries: this.options.canaries });
        const approved = this.approvals.consume(sessionId, scan.contentHash);
        this.recordRequestMemory(sessionId, scan, model, "openai-compatible");
        if (!scan.safe || !shouldForward(scan.decision, approved)) {
            this.record({ sessionId, eventType: "broker_request_blocked", decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, contentHash: scan.contentHash, model, provider: "openai-compatible", redactedEvidence: scan.evidencePreview });
            throw new HttpError(scan.decision === "approval_required" ? 403 : 422, scan.decision, scan.decision === "approval_required" ? "Local approval is required for this content hash" : "The request was blocked by local policy");
        }
        const forward = { ...body, messages: forwardRawMessages(scan.redacted ? "redact" : scan.decision, body.messages) };
        res.setHeader("x-soterai-request-decision", scan.decision);

        if (body.stream === true) {
            await this.proxyStreaming("openai", res, forward, req, sessionId, model, "openai-compatible");
            return;
        }

        const provider = await this.forwardProvider("openai", forward, req);
        const responseText = extractOpenAIResponse(provider.body);
        const responseScan = await scanBrokerResponse(responseText, { canaries: this.options.canaries });
        this.recordResponseMemory(sessionId, responseScan, model, "openai-compatible");
        if (responseScan.decision === "block") throw new HttpError(422, "unsafe_provider_response", "The provider response was blocked by local output protection");
        res.setHeader("x-soterai-response-decision", responseScan.decision);
        this.json(res, provider.status, provider.body);
    }

    private async proxyAnthropic(res: ServerResponse, body: JsonBody, req: IncomingMessage): Promise<void> {
        const system = typeof body.system === "string" ? [{ role: "system", content: body.system }] : [];
        const messages = [...system, ...normalizeMessages(body.messages)];
        const sessionId = stringValue(body.session_id) ?? stringValue(req.headers["x-soterai-session-id"]) ?? randomUUID();
        const model = stringValue(body.model);
        const scan = await scanBrokerRequest(messages, { engine: this.engine, safeMode: this.safeMode, canaries: this.options.canaries });
        const approved = this.approvals.consume(sessionId, scan.contentHash);
        this.recordRequestMemory(sessionId, scan, model, "anthropic-compatible");
        if (!scan.safe || !shouldForward(scan.decision, approved)) {
            throw new HttpError(scan.decision === "approval_required" ? 403 : 422, scan.decision, "The request was blocked by local policy");
        }
        const rawForwarded = forwardRawMessages(scan.redacted ? "redact" : scan.decision, body.messages);
        const rawList = Array.isArray(rawForwarded) ? rawForwarded as Array<Record<string, unknown>> : [];
        const inlineSystem = rawList.find((m) => m?.role === "system");
        const forward = {
            ...body,
            system: typeof body.system === "string" ? body.system : (inlineSystem?.content as string | undefined),
            messages: rawList.filter((m) => m?.role !== "system"),
        };
        res.setHeader("x-soterai-request-decision", scan.decision);

        if (body.stream === true) {
            await this.proxyStreaming("anthropic", res, forward, req, sessionId, model, "anthropic-compatible");
            return;
        }

        const provider = await this.forwardProvider("anthropic", forward, req);
        const responseText = extractAnthropicResponse(provider.body);
        const responseScan = await scanBrokerResponse(responseText, { canaries: this.options.canaries });
        this.recordResponseMemory(sessionId, responseScan, model, "anthropic-compatible");
        if (responseScan.decision === "block") throw new HttpError(422, "unsafe_provider_response", "The provider response was blocked by local output protection");
        res.setHeader("x-soterai-response-decision", responseScan.decision);
        this.json(res, provider.status, provider.body);
    }

    /**
     * Phase 6 — SSE/chunked streaming proxy with fail-closed output scanning.
     * Each chunk is scanned for secrets/canaries before being forwarded. On a
     * block decision the stream is aborted and a terminal error event is sent.
     * Limitation: partial tokens already flushed cannot be recalled (honest).
     */
    private async proxyStreaming(
        kind: "openai" | "anthropic",
        res: ServerResponse,
        body: JsonBody,
        req: IncomingMessage,
        sessionId: string,
        model: string | undefined,
        providerLabel: string,
    ): Promise<void> {
        const target = kind === "openai" ? this.options.openAIProviderUrl : this.options.anthropicProviderUrl;
        if (!target) throw new HttpError(503, "provider_not_configured", `${kind} provider routing is not configured`);
        const apiKey = this.options.providerApiKey ?? stringValue(req.headers["x-soterai-provider-key"]);
        if (!apiKey) throw new HttpError(401, "provider_key_required", "A local provider key is required");

        const headers: Record<string, string> = {
            "content-type": "application/json",
            accept: "text/event-stream",
        };
        if (kind === "openai") headers.authorization = `Bearer ${apiKey}`;
        else {
            headers["x-api-key"] = apiKey;
            headers["anthropic-version"] = stringValue(req.headers["anthropic-version"]) ?? "2023-06-01";
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs ?? 60_000);
        let upstream: Response;
        try {
            upstream = await (this.options.fetchImpl ?? fetch)(target, {
                method: "POST",
                headers,
                body: JSON.stringify({ ...body, stream: true }),
                signal: controller.signal,
            });
        } catch {
            clearTimeout(timeout);
            throw new HttpError(502, "provider_error", "The configured provider could not be reached for streaming");
        }

        if (!upstream.ok || !upstream.body) {
            clearTimeout(timeout);
            const errText = await upstream.text().catch(() => "");
            const parsed = parseProviderJson(errText);
            if (parsed) throw providerSafetyError(kind, upstream.status, parsed);
            throw new HttpError(502, "provider_error", `Provider streaming failed (${upstream.status}): ${errText.slice(0, 200)}`);
        }

        res.statusCode = 200;
        res.setHeader("content-type", "text/event-stream; charset=utf-8");
        res.setHeader("cache-control", "no-cache, no-store");
        res.setHeader("connection", "keep-alive");
        res.setHeader("x-soterai-streaming", "1");
        res.setHeader("x-soterai-response-decision", "pending");

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let blocked = false;
        let buffer = "";
        let wroteBody = false;
        let finalDecision: GuardAction = "allow";

        const writeBlockAndAbort = async (
            responseScan: Awaited<ReturnType<typeof scanBrokerResponse>>,
        ): Promise<void> => {
            blocked = true;
            finalDecision = "block";
            this.recordResponseMemory(sessionId, responseScan, model, providerLabel);
            // Headers may already be sent after the first safe chunk — never call setHeader then.
            if (!wroteBody && !res.headersSent) {
                res.setHeader("x-soterai-response-decision", "block");
            }
            res.write(
                `data: ${JSON.stringify({ error: { code: "unsafe_provider_response", message: "Stream aborted: local output protection blocked secret/canary leak" } })}\n\n`,
            );
            res.write("data: [DONE]\n\n");
            wroteBody = true;
            try { await reader.cancel(); } catch { /* ignore */ }
        };

        /**
         * Fail-closed stream gate: block canaries, explicit block decisions, and any
         * high-risk secret that still survives in the accumulated assistant text.
         * Secrets often score as "warn" in scanAIOutput; for streaming we still refuse
         * to forward raw credentials (scan-before-forward invariant).
         */
        const shouldBlockStream = async (text: string): Promise<Awaited<ReturnType<typeof scanBrokerResponse>> | null> => {
            if (!text) return null;
            const responseScan = await scanBrokerResponse(text, { canaries: this.options.canaries });
            const survivors = findSurvivingSecrets(text);
            if (responseScan.decision === "block" || responseScan.canaryLeaked || survivors.length > 0) {
                return responseScan;
            }
            return null;
        };

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Scan on SSE event boundaries; never forward a part until the
                // accumulated assistant-visible text is clean.
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";
                for (const part of parts) {
                    if (!part.trim()) continue;
                    const content = extractStreamDelta(part);
                    if (content) accumulated += content;

                    const blockScan = await shouldBlockStream(accumulated);
                    if (blockScan) {
                        await writeBlockAndAbort(blockScan);
                        break;
                    }
                    res.write(part + "\n\n");
                    wroteBody = true;
                }
                if (blocked) break;
            }

            if (!blocked && buffer.trim()) {
                const content = extractStreamDelta(buffer);
                if (content) accumulated += content;
                const blockScan = await shouldBlockStream(accumulated || buffer);
                if (blockScan) {
                    await writeBlockAndAbort(blockScan);
                } else {
                    res.write(buffer);
                    wroteBody = true;
                    const responseScan = await scanBrokerResponse(accumulated || buffer, { canaries: this.options.canaries });
                    this.recordResponseMemory(sessionId, responseScan, model, providerLabel);
                    finalDecision = responseScan.decision;
                    if (!res.headersSent) res.setHeader("x-soterai-response-decision", responseScan.decision);
                }
            } else if (!blocked && accumulated) {
                const responseScan = await scanBrokerResponse(accumulated, { canaries: this.options.canaries });
                this.recordResponseMemory(sessionId, responseScan, model, providerLabel);
                finalDecision = responseScan.decision;
            }

            // Best-effort final decision header if nothing was written yet.
            if (!wroteBody && !res.headersSent) {
                res.setHeader("x-soterai-response-decision", blocked ? "block" : finalDecision);
            }

            this.record({
                sessionId,
                eventType: blocked ? "broker_stream_blocked" : "broker_stream_completed",
                decision: blocked ? "block" : finalDecision,
                riskScore: blocked ? 90 : 0,
                categories: blocked ? ["stream_output_block"] : [],
                model,
                provider: providerLabel,
            });
        } finally {
            clearTimeout(timeout);
            try { reader.releaseLock(); } catch { /* ignore */ }
            res.end();
        }
    }


    private async forwardProvider(kind: "openai" | "anthropic", body: JsonBody, req: IncomingMessage): Promise<{ status: number; body: JsonBody }> {
        const target = kind === "openai" ? this.options.openAIProviderUrl : this.options.anthropicProviderUrl;
        if (!target) throw new HttpError(503, "provider_not_configured", `${kind} provider routing is not configured`);
        const apiKey = this.options.providerApiKey ?? stringValue(req.headers["x-soterai-provider-key"]);
        if (!apiKey) throw new HttpError(401, "provider_key_required", "A local provider key is required");
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (kind === "openai") headers.authorization = `Bearer ${apiKey}`;
        else { headers["x-api-key"] = apiKey; headers["anthropic-version"] = stringValue(req.headers["anthropic-version"]) ?? "2023-06-01"; }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs ?? 30_000);
        try {
            const response = await (this.options.fetchImpl ?? fetch)(target, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
            const parsed = await response.json() as JsonBody;
            if (!response.ok) throw providerSafetyError(kind, response.status, parsed);
            return { status: response.status, body: parsed };
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(502, "provider_error", "The configured provider could not be reached or returned invalid JSON");
        } finally { clearTimeout(timeout); }
    }


    private recordRequestMemory(sessionId: string, scan: Awaited<ReturnType<typeof scanBrokerRequest>>, model: string | undefined, provider: string): void {
        if (!this.memory.getSession(sessionId)) this.memory.startSession({ sessionId, source: "broker", provider });
        const kind: MemoryEventKind = scan.decision === "block" ? "broker_request_blocked" : scan.redacted ? "broker_request_redacted" : "broker_request_scanned";
        this.memory.addEvent(sessionId, { eventId: randomUUID(), timestamp: new Date().toISOString(), kind, source: "broker", decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, redactedEvidence: scan.evidencePreview, requestHash: scan.contentHash, model, provider, contentSize: 0 });
        this.record({ sessionId, eventType: kind, decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, contentHash: scan.contentHash, model, provider, redactedEvidence: scan.evidencePreview });
    }

    private recordResponseMemory(sessionId: string, scan: Awaited<ReturnType<typeof scanBrokerResponse>>, model: string | undefined, provider: string): void {
        const kind: MemoryEventKind = scan.canaryLeaked ? "broker_response_leak_detected" : "broker_response_scanned";
        this.memory.addEvent(sessionId, { eventId: randomUUID(), timestamp: new Date().toISOString(), kind, source: "broker", decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, redactedEvidence: scan.evidencePreview, responseHash: scan.contentHash, canaryExposed: scan.canaryLeaked, model, provider, contentSize: 0 });
        this.record({ sessionId, eventType: kind, decision: scan.decision, riskScore: scan.riskScore, categories: scan.categories, responseHash: scan.contentHash, model, provider, redactedEvidence: scan.evidencePreview });
    }

    private record(input: Omit<SafeBrokerEvent, "eventId" | "timestamp" | "source" | "safeMode" | "policyVersion">): void {
        const event: SafeBrokerEvent = { eventId: randomUUID(), timestamp: new Date().toISOString(), source: "broker", safeMode: this.safeMode.enabled, policyVersion: `safe-mode-${this.safeMode.level}`, ...input, redactedEvidence: input.redactedEvidence ? redactForSharing(input.redactedEvidence) : undefined };
        this.events.push(event);
        if (this.events.length > 1000) this.events.splice(0, this.events.length - 1000);
    }

    private enforceOrigin(req: IncomingMessage): void {
        const origin = stringValue(req.headers.origin);
        if (!origin) return;
        if (!(this.options.allowedOrigins ?? []).includes(origin)) throw new HttpError(403, "origin_rejected", "Browser origins are rejected by default");
    }

    /**
     * Per-address request budget, with liveness probes on their own bucket.
     *
     * Two buckets rather than one exemption: an unmetered endpoint is a free
     * spin loop, and a single shared budget let the editor's own health polling
     * lock it out of its own broker.
     */
    private enforceRateLimit(req: IncomingMessage, liveness = false): void {
        const key = `${liveness ? "live:" : ""}${req.socket.remoteAddress ?? "local"}`;
        const minute = Math.floor(Date.now() / 60_000);
        const limit = liveness
            ? (this.options.livenessRateLimitPerMinute ?? 1200)
            : (this.options.rateLimitPerMinute ?? 120);
        const bucket = this.rateBuckets.get(key);
        if (!bucket || bucket.minute !== minute) { this.rateBuckets.set(key, { minute, count: 1 }); return; }
        bucket.count++;
        if (bucket.count > limit) throw new HttpError(429, "rate_limited", "Local broker rate limit exceeded");
    }

    private async readJson(req: IncomingMessage): Promise<JsonBody> {
        const limit = this.options.bodyLimitBytes ?? 1_048_576;
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > limit) throw new HttpError(413, "body_too_large", "Request body exceeds the local broker limit");
            chunks.push(buffer);
        }
        if (chunks.length === 0) return {};
        try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
            return parsed as JsonBody;
        } catch { throw new HttpError(400, "invalid_json", "Request body must be a JSON object"); }
    }

    private requireCheckpointStore(): FilesystemCheckpointStore {
        if (!this.checkpoints) {
            throw new HttpError(501, "checkpoint_disabled", "Checkpoint rollback is not configured on this broker (no isolation root)");
        }
        return this.checkpoints;
    }

    /**
     * Tenant + actor are taken from request headers so the checkpoint is bound to
     * a canonical identity at creation, and any later rollback must present the
     * SAME pair. The bearer token alone is not identity: one authenticated host
     * can carry several tenants/actors, so an authenticated caller must still not
     * be able to roll back another tenant's or actor's checkpoint.
     */
    private checkpointOwner(req: IncomingMessage): { tenantId: string; actorId: string } {
        const tenantId = headerValue(req, "x-soterai-tenant");
        const actorId = headerValue(req, "x-soterai-actor");
        if (!tenantId) throw new HttpError(400, "missing_tenant", "x-soterai-tenant is required for checkpoint operations");
        if (!actorId) throw new HttpError(400, "missing_actor", "x-soterai-actor is required for checkpoint operations");
        return { tenantId, actorId };
    }

    private async createCheckpoint(res: ServerResponse, body: JsonBody, req: IncomingMessage): Promise<void> {
        const store = this.requireCheckpointStore();
        const owner = this.checkpointOwner(req);
        const paths = stringArray(body.paths);
        if (paths.length === 0) throw new HttpError(400, "invalid_request", "paths must be a non-empty array of protected paths");
        if (paths.length > 200) throw new HttpError(413, "too_many_paths", "A checkpoint may protect at most 200 paths");
        try {
            const record = await store.createCheckpoint({ owner, paths, sideEffects: parseSideEffects(body.sideEffects) });
            this.record({
                eventType: "checkpoint_created",
                decision: "allow",
                riskScore: 0,
                categories: ["checkpoint"],
                contentHash: record.integrity.slice(0, 16),
            });
            // Only non-content metadata leaves the broker: no path, no bytes.
            this.json(res, 201, {
                checkpointId: record.id,
                createdAt: record.createdAt,
                expiresAt: record.expiresAt,
                fileCount: record.files.length,
                status: record.status,
                classification: classifyRestoration(record).classification,
            });
        } catch (error) {
            if (error instanceof CheckpointScopeError) throw new HttpError(403, "checkpoint_out_of_scope", error.message);
            throw error;
        }
    }

    private async rollbackCheckpoint(res: ServerResponse, body: JsonBody, req: IncomingMessage): Promise<void> {
        const store = this.requireCheckpointStore();
        const owner = this.checkpointOwner(req);
        const checkpointId = requireString(body.checkpointId, "checkpointId");
        const result = await store.rollback(checkpointId, owner);
        this.record({
            eventType: result.ok ? "checkpoint_rolled_back" : "checkpoint_rollback_denied",
            decision: result.ok ? "allow" : "block",
            riskScore: result.ok ? 0 : 60,
            categories: ["checkpoint", result.evidence.code],
        });
        this.json(res, result.ok ? 200 : statusForRollback(result.evidence.code), { evidence: result.evidence });
    }

    private applySecurityHeaders(res: ServerResponse): void {
        res.setHeader("cache-control", "no-store");
        res.setHeader("x-content-type-options", "nosniff");
        res.setHeader("content-security-policy", "default-src 'none'");
        res.setHeader("referrer-policy", "no-referrer");
    }

    private json(res: ServerResponse, status: number, body: unknown): void {
        res.statusCode = status;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify(body));
    }

    private safeLog(message: string, metadata: Record<string, unknown>): void {
        this.options.logger?.(message, metadata);
    }
}

function normalizeMessages(value: unknown): BrokerMessage[] {
    if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, "invalid_messages", "messages must be a non-empty array");
    return value.map((raw) => {
        if (!raw || typeof raw !== "object") throw new HttpError(400, "invalid_messages", "each message must be an object");
        const item = raw as Record<string, unknown>;
        const role = requireString(item.role, "message.role");
        const parts: string[] = [];
        if (typeof item.content === "string") {
            parts.push(item.content);
        } else if (Array.isArray(item.content)) {
            // Agent messages carry content as BLOCKS: text, tool_use,
            // tool_result, image. Only the text-bearing ones are scannable;
            // the rest are ignored here but PRESERVED verbatim on forward.
            for (const part of item.content) {
                if (!part || typeof part !== "object") continue;
                const p = part as Record<string, unknown>;
                if (typeof p.text === "string") parts.push(p.text);
                else if (typeof p.content === "string") parts.push(p.content); // tool_result content
            }
        } else if (item.content != null) {
            throw new HttpError(400, "invalid_messages", "message.content must be text, text parts, or null");
        }
        // null content is the normal shape for assistant tool_calls (Cline,
        // opencode) — the args are user-authored payloads, so scan them too.
        if (Array.isArray(item.tool_calls)) {
            for (const tc of item.tool_calls) {
                if (!tc || typeof tc !== "object") continue;
                const fn = (tc as Record<string, unknown>).function;
                if (fn && typeof fn === "object" && typeof (fn as Record<string, unknown>).arguments === "string") {
                    parts.push((fn as Record<string, unknown>).arguments as string);
                }
            }
        }
        return { role, content: parts.join("\n"), name: stringValue(item.name) };
    });
}

/**
 * Build the message payload the provider receives.
 *
 * allow/warn: the ORIGINAL raw messages, byte-for-byte. Agent clients
 * (Claude Code, Cline, opencode) encode tool state as content BLOCKS
 * (tool_use / tool_result) or tool_calls fields, not as plain text —
 * flattening those to { role, content } corrupts the conversation and breaks
 * the agent. (This shipped as a regression; agent-toolcalls-e2e covers it.)
 *
 * redact: the same structure, with only detectable text-bearing parts
 * replaced, so a redacted request still carries its tool calls intact.
 */
function forwardRawMessages(decision: GuardAction, raw: unknown): unknown {
    if (decision !== "redact" || !Array.isArray(raw)) return raw;
    return raw.map((rawMsg) => {
        if (!rawMsg || typeof rawMsg !== "object") return rawMsg;
        const item = rawMsg as Record<string, unknown>;
        if (typeof item.content === "string") {
            return { ...item, content: redactForSharing(item.content) };
        }
        if (Array.isArray(item.content)) {
            return {
                ...item,
                content: item.content.map((part) => {
                    if (!part || typeof part !== "object") return part;
                    const p = part as Record<string, unknown>;
                    if (typeof p.text === "string") return { ...p, text: redactForSharing(p.text) };
                    if (typeof p.content === "string") return { ...p, content: redactForSharing(p.content) };
                    return part; // tool_use, image, ... structure untouched
                }),
            };
        }
        return rawMsg; // null content (assistant tool_calls) — untouched
    });
}

function safeRequestResult(result: Awaited<ReturnType<typeof scanBrokerRequest>>): JsonBody {
    return { decision: result.decision, riskScore: result.riskScore, categories: result.categories, redactedMessages: result.redactedMessages, redacted: result.redacted, canaryInRequest: result.canaryInRequest, contentHash: result.contentHash, safe: result.safe, evidencePreview: result.evidencePreview };
}

function extractOpenAIResponse(body: JsonBody): string {
    const choices = body.choices;
    if (!Array.isArray(choices)) return "";
    return choices.map((choice) => choice && typeof choice === "object" ? stringValue((choice as Record<string, unknown>).message && ((choice as Record<string, unknown>).message as Record<string, unknown>).content) ?? "" : "").join("\n");
}

function extractAnthropicResponse(body: JsonBody): string {
    const content = body.content;
    if (!Array.isArray(content)) return "";
    return content.map((part) => part && typeof part === "object" ? stringValue((part as Record<string, unknown>).text) ?? "" : "").join("\n");
}

function parseProviderJson(raw: string): JsonBody | undefined {
    try {
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonBody : undefined;
    } catch {
        return undefined;
    }
}

function providerSafetyError(kind: "openai" | "anthropic", status: number, body: JsonBody): HttpError {
    const error = objectValue(body.error);
    const details = objectValue(body.details);
    const nestedDetails = objectValue(error.details);
    const providerCode = [body.code, error.code, details.code, nestedDetails.code]
        .map(stringValue)
        .find(Boolean);
    const providerMessage = [body.message, error.message, details.message, nestedDetails.message]
        .map(stringValue)
        .find(Boolean);
    const sensitiveWords = providerCode?.toLowerCase() === "sensitive_words_detected" ||
        /\bsensitive[\s_-]+words?\b/i.test(providerMessage ?? "");

    if (sensitiveWords) {
        return new HttpError(
            422,
            "provider_safety_rejected",
            "The provider rejected this request under its content-safety policy. Revise the request or use a provider/model whose policy fits the task; SoterAI will not bypass provider safety controls.",
            {
                provider: `${kind}-compatible`,
                category: "content_policy",
                providerCode: "sensitive_words_detected",
                retryable: false,
            },
        );
    }

    return new HttpError(
        status >= 400 && status < 500 ? status : 502,
        "provider_rejected",
        `The configured ${kind}-compatible provider rejected the request (${status}).`,
        {
            provider: `${kind}-compatible`,
            ...(providerCode ? { providerCode: providerCode.slice(0, 80) } : {}),
            retryable: status === 408 || status === 429 || status >= 500,
        },
    );
}

/**
 * Phase 6 — Extract assistant-visible text deltas from one SSE event block.
 * Supports OpenAI chat.completion.chunk (`choices[].delta.content`) and
 * Anthropic `content_block_delta` (`delta.text`). Tool-call argument fragments
 * are also collected so secret scanning covers function/tool payloads.
 * Returns "" for control frames ([DONE], ping, empty data).
 */
export function extractStreamDelta(ssePart: string): string {
    if (!ssePart || !ssePart.trim()) return "";
    const pieces: string[] = [];
    for (const line of ssePart.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
            const parsed = JSON.parse(payload) as Record<string, unknown>;
            // OpenAI-compatible: choices[].delta.content | choices[].delta.tool_calls[].function.arguments
            const choices = parsed.choices;
            if (Array.isArray(choices)) {
                for (const choice of choices) {
                    if (!choice || typeof choice !== "object") continue;
                    const delta = (choice as Record<string, unknown>).delta;
                    if (!delta || typeof delta !== "object") continue;
                    const d = delta as Record<string, unknown>;
                    if (typeof d.content === "string") pieces.push(d.content);
                    // Tool call argument streaming (OpenAI)
                    if (Array.isArray(d.tool_calls)) {
                        for (const tc of d.tool_calls) {
                            if (!tc || typeof tc !== "object") continue;
                            const fn = (tc as Record<string, unknown>).function;
                            if (fn && typeof fn === "object") {
                                const args = (fn as Record<string, unknown>).arguments;
                                if (typeof args === "string") pieces.push(args);
                            }
                        }
                    }
                }
            }
            // Anthropic-compatible: type content_block_delta → delta.text
            if (parsed.type === "content_block_delta") {
                const delta = parsed.delta;
                if (delta && typeof delta === "object") {
                    const text = (delta as Record<string, unknown>).text;
                    if (typeof text === "string") pieces.push(text);
                    const partialJson = (delta as Record<string, unknown>).partial_json;
                    if (typeof partialJson === "string") pieces.push(partialJson);
                }
            }
            // Anthropic message_delta stop / usage — no text
            // Some providers put content at top-level
            if (typeof parsed.content === "string") pieces.push(parsed.content);
        } catch {
            // Non-JSON data line: treat as raw text only if it looks content-like
            // (never treat control frames as content)
            if (payload.length > 0 && !payload.startsWith(":")) {
                pieces.push(payload);
            }
        }
    }
    return pieces.join("");
}


function parseSafeModeLevel(value: unknown): SafeModeLevel {
    return value === "strict" || value === "enterprise" ? value : "developer";
}

function parseAction(value: unknown): GuardAction {
    return value === "warn" || value === "redact" || value === "block" || value === "approval_required" ? value : "allow";
}

function actionToGuardAction(value: string): GuardAction {
    if (value === "DENY" || value === "QUARANTINE") return "block";
    if (value === "ASK" || value === "ALLOW_ONCE" || value === "ALLOW_IN_SANDBOX") return "approval_required";
    if (value === "ALLOW_WITH_TRANSFORMATION") return "redact";
    return "allow";
}

function parseFileOperation(value: unknown): FileOperation {
    const allowed: FileOperation[] = ["read", "write", "delete", "rename", "chmod", "mass_change", "config_change"];
    return typeof value === "string" && allowed.includes(value as FileOperation) ? value as FileOperation : "read";
}

function parseNetworkReach(value: unknown): "none" | "restricted" | "unrestricted" | "unknown" | undefined {
    return value === "none" || value === "restricted" || value === "unrestricted" || value === "unknown" ? value : undefined;
}

function parseRemoteEnvironment(value: unknown): "local" | "ssh" | "wsl" | "container" | "codespaces" | "unknown" | undefined {
    return value === "local" || value === "ssh" || value === "wsl" || value === "container" || value === "codespaces" || value === "unknown" ? value : undefined;
}

function parseSandbox(value: unknown): "enabled" | "available" | "disabled" | "unknown" | undefined {
    return value === "enabled" || value === "available" || value === "disabled" || value === "unknown" ? value : undefined;
}

function parseGovernanceRole(value: unknown): GovernanceRole {
    return value === "security_reviewer" || value === "org_admin" || value === "platform_admin" ? value : "developer";
}

function parseMCPConfig(value: unknown): string | Record<string, unknown> | undefined {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    return undefined;
}

function parseProcessNetworkMode(value: unknown): ProcessNetworkMode | undefined {
    return value === "none" || value === "allowlist" || value === "unrestricted" ? value : undefined;
}

function parseProcessFilesystemMode(value: unknown): ProcessFilesystemMode | undefined {
    return value === "read_only_workspace" || value === "read_write_workspace" || value === "unrestricted" ? value : undefined;
}

function parseProcessSandboxStrength(value: unknown): ProcessSandboxStrength | undefined {
    return value === "os_enforced" || value === "broker_constrained" || value === "none" ? value : undefined;
}

function parseMemorySource(value: unknown): MemorySource {
    const allowed: MemorySource[] = ["broker", "safe-context-builder", "scan-before-ai-prompt", "manual-output-scan", "git-scan", "terminal-check", "mcp-scan"];
    return typeof value === "string" && allowed.includes(value as MemorySource) ? value as MemorySource : "broker";
}

function brokerProtectionMode(safeMode: { enabled: boolean; level: SafeModeLevel }): ProtectionMode {
    if (!safeMode.enabled) return "standard";
    if (safeMode.level === "enterprise") return "enterprise_locked";
    if (safeMode.level === "strict") return "strict";
    return "standard";
}

function safeTerminalAnalysis(analysis: ReturnType<typeof analyzeControlledTerminalCommand>): JsonBody {
    return {
        action: analysis.action,
        executable: analysis.executable,
        args: analysis.args,
        riskScore: analysis.riskScore,
        categories: analysis.categories,
        reasonCodes: analysis.reasonCodes,
        explanation: analysis.explanation,
        coverageLevel: analysis.coverageLevel,
        deterministic: analysis.deterministic,
    };
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(value)));
}

function minimalTerminalEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const clean: NodeJS.ProcessEnv = {
        NODE_ENV: env.NODE_ENV ?? "production",
        PATH: env.PATH ?? env.Path ?? "",
        Path: env.Path ?? env.PATH ?? "",
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
    };
    if (env.SystemRoot) clean.SystemRoot = env.SystemRoot;
    if (env.windir) clean.windir = env.windir;
    return clean;
}

function stringValue(value: unknown): string | undefined {
    if (Array.isArray(value)) value = value[0];
    return typeof value === "string" ? value : undefined;
}
function headerValue(req: IncomingMessage, name: string): string | undefined {
    const raw = stringValue(req.headers[name]);
    const trimmed = raw?.trim();
    return trimmed && trimmed.length <= 200 ? trimmed : undefined;
}
function parseSideEffects(value: unknown): CheckpointSideEffect[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 50).map((raw, index) => {
        const item = objectValue(raw);
        return {
            id: stringValue(item.id) ?? `effect_${index}`,
            kind: stringValue(item.kind) ?? "unknown",
            reversible: item.reversible === true,
            compensatingAction: stringValue(item.compensatingAction),
        };
    });
}
function statusForRollback(code: string): number {
    if (code === "NOT_FOUND") return 404;
    if (code === "TENANT_MISMATCH" || code === "ACTOR_MISMATCH" || code === "INTEGRITY_FAILED") return 403;
    if (code === "ALREADY_ROLLED_BACK") return 200;
    if (code === "EXPIRED") return 410;
    return 409;
}
function requireString(value: unknown, field: string): string {
    const parsed = stringValue(value);
    if (!parsed) throw new HttpError(400, "invalid_request", `${field} must be a non-empty string`);
    return parsed;
}
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function numberValue(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function objectValue(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}
function stringRecord(value: unknown): Record<string, string | undefined> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const out: Record<string, string | undefined> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (typeof raw === "string" || typeof raw === "undefined") out[key] = raw;
    }
    return out;
}
function arrayObjectValue(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}
