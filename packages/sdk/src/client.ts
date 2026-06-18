import {
  CyberRakshakAuthError,
  CyberRakshakError,
  CyberRakshakNetworkError,
  CyberRakshakRateLimitError,
  CyberRakshakValidationError,
} from "./errors";
import type {
  AnalyzeRequest,
  AgentActionCheckRequest,
  AgentActionCheckResponse,
  AgentApprovalResolveRequest,
  AgentApprovalResolveResponse,
  AgentDataCheckRequest,
  AgentOutputCheckRequest,
  AgentReplayResponse,
  BrowserFormCheckRequest,
  BrowserFormCheckResponse,
  CanaryCheckRequest,
  CanaryCheckResponse,
  CheckContextFlowRequest,
  CheckContextFlowResponse,
  CheckLegalBoundaryRequest,
  CheckLegalBoundaryResponse,
  CheckMemoryPoisoningRequest,
  CheckMemoryPoisoningResponse,
  CreateCanaryRequest,
  CreateCanaryResponse,
  ClientOptions,
  ExpressLikeNext,
  ExpressLikeRequest,
  ExpressLikeResponse,
  GuardInputRequest,
  GuardOutputRequest,
  GuardResult,
  LineageIncidentsResponse,
  LineageSessionResponse,
  McpDriftsResponse,
  MemoryCheckRequest,
  MemoryCheckResponse,
  ProtectChatOptions,
  ProtectChatResult,
  ProtectRagOptions,
  ProtectRagResult,
  RagSource,
  RagTrustScoreRequest,
  RagTrustScoreResponse,
  RegisterContextSourceRequest,
  RegisterContextSourceResponse,
  RegisterMcpServerRequest,
  RegisterMcpServerResponse,
  RunBlastRadiusScenarioRequest,
  RunBlastRadiusScenarioResponse,
  ScanMcpToolsRequest,
  ScanMcpToolsResponse,
  SecureChatOptions,
  SecureChatResult,
  SimulateBlastRadiusRequest,
  SimulateBlastRadiusResponse,
  SnapshotMcpToolsRequest,
  SnapshotMcpToolsResponse,
  StoreSafeMemoryRequest,
  StoreSafeMemoryResponse,
  StartAgentSessionRequest,
  StartAgentSessionResponse,
  ToolExecutionContext,
  ToolExecutor,
  WrappedToolResult,
} from "./types";

const DEFAULT_BASE_URL = "https://api.cybersecurityguard.com";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_BACKOFF_MS = 250;

export interface CyberRakshakGuard {
  input(message: string, options?: Omit<GuardInputRequest, "message">): Promise<GuardResult>;
  output(aiResponse: string, options?: Omit<GuardOutputRequest, "aiResponse">): Promise<GuardResult>;
  analyze(text: string, direction: AnalyzeRequest["direction"]): Promise<GuardResult>;
  analyze(input: AnalyzeRequest): Promise<GuardResult>;
  guardInput(input: GuardInputRequest): Promise<GuardResult>;
  guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
  protectChat(input: ProtectChatOptions): Promise<ProtectChatResult>;
  protectRag(input: ProtectRagOptions): Promise<ProtectRagResult>;
  secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
  shouldCallLLM(result: GuardResult): boolean;
  getSafeInput(result: GuardResult, originalMessage: string): string;
  getSafeOutput(result: GuardResult, originalOutput: string): string;
  createExpressMiddleware(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">): (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => Promise<unknown>;
  createNextHandler(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">): (request: Request) => Promise<Response>;
  startAgentSession(input: StartAgentSessionRequest): Promise<StartAgentSessionResponse>;
  checkAgentAction(input: AgentActionCheckRequest): Promise<AgentActionCheckResponse>;
  checkToolUse(input: AgentActionCheckRequest): Promise<AgentActionCheckResponse>;
  checkDataEgress(input: AgentDataCheckRequest): Promise<AgentActionCheckResponse>;
  checkDataLeak(input: AgentDataCheckRequest): Promise<AgentActionCheckResponse>;
  checkAgentOutput(input: AgentOutputCheckRequest): Promise<AgentActionCheckResponse>;
  resolveAgentApproval(input: AgentApprovalResolveRequest): Promise<AgentApprovalResolveResponse>;
  scanMcpTools(input: ScanMcpToolsRequest): Promise<ScanMcpToolsResponse>;
  checkBrowserForm(input: BrowserFormCheckRequest): Promise<BrowserFormCheckResponse>;
  checkMemory(input: MemoryCheckRequest): Promise<MemoryCheckResponse>;
  scoreRagDocument(input: RagTrustScoreRequest): Promise<RagTrustScoreResponse>;
  createCanary(input: CreateCanaryRequest): Promise<CreateCanaryResponse>;
  checkCanaryLeak(input: CanaryCheckRequest): Promise<CanaryCheckResponse>;
  getAgentReplay(sessionId: string): Promise<AgentReplayResponse>;
  registerContextSource(input: RegisterContextSourceRequest): Promise<RegisterContextSourceResponse>;
  checkContextFlow(input: CheckContextFlowRequest): Promise<CheckContextFlowResponse>;
  getLineageSession(sessionId: string): Promise<LineageSessionResponse>;
  listLineageIncidents(status?: string): Promise<LineageIncidentsResponse>;
  simulateBlastRadius(input: SimulateBlastRadiusRequest): Promise<SimulateBlastRadiusResponse>;
  runBlastRadiusScenario(input: RunBlastRadiusScenarioRequest): Promise<RunBlastRadiusScenarioResponse>;
  checkMemoryPoisoning(input: CheckMemoryPoisoningRequest): Promise<CheckMemoryPoisoningResponse>;
  storeSafeMemory(input: StoreSafeMemoryRequest): Promise<StoreSafeMemoryResponse>;
  quarantineMemory(memoryRecordId: string): Promise<{ id: string; status: string }>;
  registerMcpServer(input: RegisterMcpServerRequest): Promise<RegisterMcpServerResponse>;
  snapshotMcpTools(input: SnapshotMcpToolsRequest): Promise<SnapshotMcpToolsResponse>;
  listMcpDrifts(status?: string): Promise<McpDriftsResponse>;
  checkLegalBoundary(input: CheckLegalBoundaryRequest): Promise<CheckLegalBoundaryResponse>;
  wrapTool<TArgs, TResult>(context: Omit<ToolExecutionContext<TArgs>, "args">, executor: ToolExecutor<TArgs, TResult>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
  wrapMcpTool<TArgs, TResult>(toolName: string, executor: ToolExecutor<TArgs, TResult>, defaults?: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
  createOpenClawAdapter(options: { sessionId: string; agentName?: string }): { beforeToolCall: (input: AgentActionCheckRequest) => Promise<AgentActionCheckResponse> };
  createLangChainToolWrapper<TArgs, TResult>(toolName: string, executor: ToolExecutor<TArgs, TResult>, defaults?: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
  createGenericChatbotWrapper(options: { sessionId?: string; agentName?: string }): {
    guardInput: (message: string) => Promise<GuardResult>;
    checkAction: (input: AgentActionCheckRequest) => Promise<AgentActionCheckResponse>;
    checkData: (input: AgentDataCheckRequest) => Promise<AgentActionCheckResponse>;
    guardOutput: (aiResponse: string) => Promise<GuardResult>;
  };
  createExpressAgentMiddleware(): (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => Promise<unknown>;
  createNextAgentHandler(): (request: Request) => Promise<Response>;
}


export function createClient(options: ClientOptions): CyberRakshakGuard {
  return new GuardClient(options);
}

export function createAgentFirewallClient(options: ClientOptions): CyberRakshakGuard {
  return new GuardClient(options);
}

export function createCybersecurityGuardClient(options: ClientOptions): CyberRakshakGuard {
  return new GuardClient(options);
}

export class GuardClient implements CyberRakshakGuard {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: ClientOptions) {
    if (!options.apiKey) throw new CyberRakshakError("apiKey is required.", { code: "config_error" });
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? 0;
    this.retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.extraHeaders = options.headers ?? {};
    if (!this.fetchImpl) {
      throw new CyberRakshakError("Global fetch is not available. Pass options.fetch explicitly.", { code: "config_error" });
    }
  }

  input(message: string, options: Omit<GuardInputRequest, "message"> = {}): Promise<GuardResult> {
    return this.guardInput({ ...options, message });
  }

  output(aiResponse: string, options: Omit<GuardOutputRequest, "aiResponse"> = {}): Promise<GuardResult> {
    return this.guardOutput({ ...options, aiResponse });
  }

  guardInput(input: GuardInputRequest): Promise<GuardResult> {
    return this.post<GuardResult>("/api/guard/input", input, true);
  }

  guardOutput(input: GuardOutputRequest): Promise<GuardResult> {
    return this.post<GuardResult>("/api/guard/output", input, true);
  }

  analyze(textOrInput: string | AnalyzeRequest, direction?: AnalyzeRequest["direction"]): Promise<GuardResult> {
    const input = typeof textOrInput === "string" ? { text: textOrInput, direction: direction ?? "INPUT" } : textOrInput;
    return this.post<GuardResult>("/api/guard/analyze", input, false);
  }

  shouldCallLLM(result: GuardResult): boolean {
    return result.allowed && (result.action === "ALLOW" || result.action === "ALLOW_WITH_REDACTION" || result.action === "REWRITE");
  }

  getSafeInput(result: GuardResult, originalMessage: string): string {
    return result.safeText ?? result.redactedText ?? originalMessage;
  }

  getSafeOutput(result: GuardResult, originalOutput: string): string {
    return result.safeText ?? result.redactedText ?? originalOutput;
  }

  async protectChat(input: ProtectChatOptions): Promise<ProtectChatResult> {
    const startedAt = Date.now();
    const blockedResponse = input.blockedResponse ?? "This request was blocked for security reasons.";
    const outputBlockedResponse = input.outputBlockedResponse ?? "The assistant response was blocked for security reasons.";
    const inputGuard = await this.guardInput({
      message: input.message,
      userId: input.userId,
      sessionId: input.sessionId,
      metadata: input.metadata,
    });

    if (!this.shouldCallLLM(inputGuard)) {
      return {
        allowed: false,
        blocked: true,
        inputAction: inputGuard.action,
        llmCalled: false,
        safeResponse: inputGuard.safeText ?? blockedResponse,
        inputGuard,
        latencyMs: Date.now() - startedAt,
      };
    }

    const safeMessage = this.getSafeInput(inputGuard, input.message);
    const rawOutput = await input.callLLM(safeMessage, { originalMessage: input.message, inputGuard });
    const outputGuard = await this.guardOutput({
      aiResponse: rawOutput,
      sessionId: input.sessionId,
      metadata: input.metadata,
    });
    const outputAllowed = this.shouldCallLLM(outputGuard);
    return {
      allowed: outputAllowed,
      blocked: !outputAllowed,
      inputAction: inputGuard.action,
      outputAction: outputGuard.action,
      llmCalled: true,
      safeResponse: outputAllowed ? this.getSafeOutput(outputGuard, rawOutput) : outputGuard.safeText ?? outputGuard.redactedText ?? outputBlockedResponse,
      inputGuard,
      outputGuard,
      latencyMs: Date.now() - startedAt,
    };
  }

  async protectRag<TSource extends RagSource = RagSource>(input: ProtectRagOptions<TSource>): Promise<ProtectRagResult> {
    const startedAt = Date.now();
    const blockedResponse = input.blockedResponse ?? "This request was blocked for security reasons.";
    const outputBlockedResponse = input.outputBlockedResponse ?? "The assistant response was blocked for security reasons.";
    const inputGuard = await this.guardInput({
      message: input.query,
      userId: input.userId,
      sessionId: input.sessionId,
      metadata: input.metadata,
    });
    if (!this.shouldCallLLM(inputGuard)) {
      return {
        allowed: false,
        blocked: true,
        inputAction: inputGuard.action,
        llmCalled: false,
        retrieved: 0,
        usedSources: [],
        excludedSources: [],
        safeResponse: inputGuard.safeText ?? blockedResponse,
        inputGuard,
        latencyMs: Date.now() - startedAt,
      };
    }

    const safeQuery = this.getSafeInput(inputGuard, input.query);
    const sources = await input.retrieve(safeQuery);
    const usedSources = [];
    const excludedSources = [];
    for (const source of sources) {
      const guard = await this.analyze(source.text, "INPUT");
      if (this.shouldCallLLM(guard)) {
        usedSources.push({ ...source, safeText: this.getSafeInput(guard, source.text), guard });
      } else {
        excludedSources.push({ source, guard });
      }
    }

    const safeContext = usedSources.map((source) => source.safeText).join("\n\n");
    const rawOutput = await input.callLLM({ safeQuery, safeContext, sources: usedSources });
    const outputGuard = await this.guardOutput({
      aiResponse: rawOutput,
      sessionId: input.sessionId,
      metadata: input.metadata,
    });
    const outputAllowed = this.shouldCallLLM(outputGuard);
    return {
      allowed: outputAllowed,
      blocked: !outputAllowed,
      inputAction: inputGuard.action,
      outputAction: outputGuard.action,
      llmCalled: true,
      retrieved: sources.length,
      usedSources,
      excludedSources,
      safeResponse: outputAllowed ? this.getSafeOutput(outputGuard, rawOutput) : outputGuard.safeText ?? outputGuard.redactedText ?? outputBlockedResponse,
      inputGuard,
      outputGuard,
      latencyMs: Date.now() - startedAt,
    };
  }

  async secureChat(input: SecureChatOptions): Promise<SecureChatResult> {
    const blocked = input.blockedResponse ?? "This request was blocked for security reasons.";
    const result = await this.protectChat({
      message: input.message,
      userId: input.userId,
      sessionId: input.sessionId,
      metadata: input.metadata,
      blockedResponse: blocked,
      callLLM: (safeInput, context) => input.callLLM({
        safeInput,
        original: context.originalMessage,
        inputResult: context.inputGuard,
      }),
    });
    return {
      reply: result.safeResponse,
      blocked: result.blocked,
      inputResult: result.inputGuard,
      outputResult: result.outputGuard,
    };
  }

  createExpressMiddleware(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">) {
    return async (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => {
      try {
        const message = typeof req.body?.message === "string" ? req.body.message : "";
        if (!message.trim()) return res.status(400).json({ error: true, message: "message is required." });
        const result = await this.protectChat({
          ...options,
          message,
          userId: typeof req.body?.userId === "string" ? req.body.userId : undefined,
          sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined,
          metadata: asMetadata(req.body?.metadata),
        });
        return res.status(200).json(result);
      } catch (caught) {
        if (next) return next(caught);
        const status = (caught as { status?: number }).status ?? 500;
        return res.status(status).json({ error: true, message: caught instanceof Error ? caught.message : "cybersecurityguard request failed." });
      }
    };
  }

  createNextHandler(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">) {
    return async (request: Request) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: true, message: "Request body must be valid JSON." }, 400);
      }
      const parsed = body && typeof body === "object" ? body as Record<string, unknown> : {};
      const message = typeof parsed.message === "string" ? parsed.message : "";
      if (!message.trim()) return jsonResponse({ error: true, message: "message is required." }, 400);
      try {
        const result = await this.protectChat({
          ...options,
          message,
          userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
          sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
          metadata: asMetadata(parsed.metadata),
        });
        return jsonResponse(result, 200);
      } catch (caught) {
        const status = (caught as { status?: number }).status ?? 500;
        return jsonResponse({ error: true, message: caught instanceof Error ? caught.message : "cybersecurityguard request failed." }, status);
      }
    };
  }

  startAgentSession(input: StartAgentSessionRequest): Promise<StartAgentSessionResponse> {
    return this.post<StartAgentSessionResponse>("/api/agent/session/start", input, true);
  }

  checkAgentAction(input: AgentActionCheckRequest): Promise<AgentActionCheckResponse> {
    return this.post<AgentActionCheckResponse>("/api/agent/action/check", input, true);
  }

  checkToolUse(input: AgentActionCheckRequest): Promise<AgentActionCheckResponse> {
    return this.post<AgentActionCheckResponse>("/api/agent/tool/check", input, true);
  }

  checkDataLeak(input: AgentDataCheckRequest): Promise<AgentActionCheckResponse> {
    return this.post<AgentActionCheckResponse>("/api/agent/data/check", input, true);
  }

  checkDataEgress(input: AgentDataCheckRequest): Promise<AgentActionCheckResponse> {
    return this.checkDataLeak(input);
  }

  checkAgentOutput(input: AgentOutputCheckRequest): Promise<AgentActionCheckResponse> {
    return this.post<AgentActionCheckResponse>("/api/agent/output/check", input, true);
  }

  resolveAgentApproval(input: AgentApprovalResolveRequest): Promise<AgentApprovalResolveResponse> {
    return this.post<AgentApprovalResolveResponse>("/api/agent/approval/resolve", input, true);
  }

  scanMcpTools(input: ScanMcpToolsRequest): Promise<ScanMcpToolsResponse> {
    return this.post<ScanMcpToolsResponse>("/api/agent/mcp/scan", input, true);
  }

  checkBrowserForm(input: BrowserFormCheckRequest): Promise<BrowserFormCheckResponse> {
    return this.post<BrowserFormCheckResponse>("/api/agent/browser/form/check", input, true);
  }

  checkMemory(input: MemoryCheckRequest): Promise<MemoryCheckResponse> {
    return this.post<MemoryCheckResponse>("/api/agent/memory/check", input, true);
  }

  scoreRagDocument(input: RagTrustScoreRequest): Promise<RagTrustScoreResponse> {
    return this.post<RagTrustScoreResponse>("/api/rag/document/trust-score", input, true);
  }

  createCanary(input: CreateCanaryRequest): Promise<CreateCanaryResponse> {
    return this.post<CreateCanaryResponse>("/api/canary/create", input, true);
  }

  checkCanaryLeak(input: CanaryCheckRequest): Promise<CanaryCheckResponse> {
    return this.post<CanaryCheckResponse>("/api/canary/check", input, true);
  }

  getAgentReplay(sessionId: string): Promise<AgentReplayResponse> {
    return this.get<AgentReplayResponse>(`/api/agent/replay/${encodeURIComponent(sessionId)}`, true);
  }

  registerContextSource(input: RegisterContextSourceRequest): Promise<RegisterContextSourceResponse> {
    return this.post<RegisterContextSourceResponse>("/api/lineage/source/register", input, true);
  }

  checkContextFlow(input: CheckContextFlowRequest): Promise<CheckContextFlowResponse> {
    return this.post<CheckContextFlowResponse>("/api/lineage/flow/check", input, true);
  }

  getLineageSession(sessionId: string): Promise<LineageSessionResponse> {
    return this.get<LineageSessionResponse>(`/api/lineage/session/${encodeURIComponent(sessionId)}`, true);
  }

  listLineageIncidents(status?: string): Promise<LineageIncidentsResponse> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.get<LineageIncidentsResponse>(`/api/lineage/incidents${query}`, true);
  }

  simulateBlastRadius(input: SimulateBlastRadiusRequest): Promise<SimulateBlastRadiusResponse> {
    return this.post<SimulateBlastRadiusResponse>("/api/blast-radius/simulate", input, true);
  }

  runBlastRadiusScenario(input: RunBlastRadiusScenarioRequest): Promise<RunBlastRadiusScenarioResponse> {
    return this.post<RunBlastRadiusScenarioResponse>("/api/blast-radius/scenario", input, true);
  }

  checkMemoryPoisoning(input: CheckMemoryPoisoningRequest): Promise<CheckMemoryPoisoningResponse> {
    return this.post<CheckMemoryPoisoningResponse>("/api/memory/check", input, true);
  }

  storeSafeMemory(input: StoreSafeMemoryRequest): Promise<StoreSafeMemoryResponse> {
    return this.post<StoreSafeMemoryResponse>("/api/memory/store", input, true);
  }

  quarantineMemory(memoryRecordId: string): Promise<{ id: string; status: string }> {
    return this.post<{ id: string; status: string }>(`/api/memory/${encodeURIComponent(memoryRecordId)}/quarantine`, {}, true);
  }

  registerMcpServer(input: RegisterMcpServerRequest): Promise<RegisterMcpServerResponse> {
    return this.post<RegisterMcpServerResponse>("/api/mcp/servers/register", input, true);
  }

  snapshotMcpTools(input: SnapshotMcpToolsRequest): Promise<SnapshotMcpToolsResponse> {
    return this.post<SnapshotMcpToolsResponse>("/api/mcp/tools/snapshot", input, true);
  }

  listMcpDrifts(status?: string): Promise<McpDriftsResponse> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.get<McpDriftsResponse>(`/api/mcp/drifts${query}`, true);
  }

  checkLegalBoundary(input: CheckLegalBoundaryRequest): Promise<CheckLegalBoundaryResponse> {
    return this.post<CheckLegalBoundaryResponse>("/api/legal-boundary/check", input, true);
  }

  wrapTool<TArgs, TResult>(
    context: Omit<ToolExecutionContext<TArgs>, "args">,
    executor: ToolExecutor<TArgs, TResult>,
  ) {
    return async (args: TArgs): Promise<WrappedToolResult<TResult>> => {
      const content = context.content ?? JSON.stringify(args);
      const decision = await this.checkAgentAction({
        sessionId: context.sessionId,
        agentName: context.agentName,
        tool: context.tool,
        action: context.action,
        target: context.target,
        content,
        destination: context.destination,
        riskContext: context.riskContext,
        metadata: context.metadata,
      }).catch((caught) => {
        if (caught instanceof CyberRakshakRateLimitError) {
          return failClosedDecision("Agent Firewall rate limit hit. Do not execute the tool.", "HIGH");
        }
        if (caught instanceof CyberRakshakNetworkError) {
          return failClosedDecision("Agent Firewall unavailable. Fail-closed policy prevented tool execution.", "CRITICAL");
        }
        throw caught;
      });

      if (!shouldExecuteAgentDecision(decision)) {
        return { executed: false, decision };
      }
      const result = await executor(args, decision);
      return { executed: true, decision, result };
    };
  }

  wrapMcpTool<TArgs, TResult>(
    toolName: string,
    executor: ToolExecutor<TArgs, TResult>,
    defaults: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">> = {},
  ) {
    return this.wrapTool<TArgs, TResult>({
      tool: `mcp.${toolName}`,
      action: defaults.action ?? "mcp_tool_call",
      ...defaults,
    }, executor);
  }

  createOpenClawAdapter(options: { sessionId: string; agentName?: string }) {
    return {
      beforeToolCall: (input: AgentActionCheckRequest) => this.checkAgentAction({
        ...input,
        sessionId: input.sessionId ?? options.sessionId,
        agentName: input.agentName ?? options.agentName ?? "openclaw",
      }),
    };
  }

  createLangChainToolWrapper<TArgs, TResult>(
    toolName: string,
    executor: ToolExecutor<TArgs, TResult>,
    defaults: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">> = {},
  ) {
    return this.wrapTool<TArgs, TResult>({
      tool: `langchain.${toolName}`,
      action: defaults.action ?? "tool_call",
      ...defaults,
    }, executor);
  }

  createGenericChatbotWrapper(options: { sessionId?: string; agentName?: string }) {
    return {
      guardInput: (message: string) => this.guardInput({ message, userId: undefined }),
      checkAction: (input: AgentActionCheckRequest) => this.checkAgentAction({
        ...input,
        sessionId: input.sessionId ?? options.sessionId,
        agentName: input.agentName ?? options.agentName ?? "chatbot",
      }),
      checkData: (input: AgentDataCheckRequest) => this.checkDataEgress({
        ...input,
        sessionId: input.sessionId ?? options.sessionId,
      }),
      guardOutput: (aiResponse: string) => this.guardOutput({ aiResponse }),
    };
  }

  createExpressAgentMiddleware() {
    return async (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => {
      try {
        const body = req.body as Record<string, unknown> | undefined;
        const destination = body?.destination;
        const decision = await this.checkAgentAction({
          sessionId: typeof body?.sessionId === "string" ? body.sessionId : undefined,
          agentName: typeof body?.agentName === "string" ? body.agentName : undefined,
          tool: typeof body?.tool === "string" ? body.tool : "unknown",
          action: typeof body?.action === "string" ? body.action : "tool_call",
          target: typeof body?.target === "string" ? body.target : undefined,
          content: typeof body?.content === "string" ? body.content : undefined,
          destination: isAgentDestination(destination) ? destination : "unknown",
          metadata: asMetadata(body?.metadata),
        });
        return res.status(200).json(decision);
      } catch (caught) {
        if (next) return next(caught);
        const status = (caught as { status?: number }).status ?? 500;
        return res.status(status).json({ error: true, message: caught instanceof Error ? caught.message : "Agent Firewall request failed." });
      }
    };
  }

  createNextAgentHandler() {
    return async (request: Request) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: true, message: "Request body must be valid JSON." }, 400);
      }
      const parsed = body && typeof body === "object" ? body as Record<string, unknown> : {};
      try {
        const decision = await this.checkAgentAction({
          sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
          agentName: typeof parsed.agentName === "string" ? parsed.agentName : undefined,
          tool: typeof parsed.tool === "string" ? parsed.tool : "unknown",
          action: typeof parsed.action === "string" ? parsed.action : "tool_call",
          target: typeof parsed.target === "string" ? parsed.target : undefined,
          content: typeof parsed.content === "string" ? parsed.content : undefined,
          destination: isAgentDestination(parsed.destination) ? parsed.destination : "unknown",
          metadata: asMetadata(parsed.metadata),
        });
        return jsonResponse(decision, 200);
      } catch (caught) {
        const status = (caught as { status?: number }).status ?? 500;
        return jsonResponse({ error: true, message: caught instanceof Error ? caught.message : "Agent Firewall request failed." }, status);
      }
    };
  }

  private async post<T>(path: string, body: unknown, requireApiKey: boolean): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "cybersecurityguard-sdk/0.1",
      ...this.extraHeaders,
    };
    if (requireApiKey) headers["x-api-key"] = this.apiKey;
    const response = await this.fetchWithNetworkRetry(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    return this.handleResponse<T>(response);
  }

  private async get<T>(path: string, requireApiKey: boolean): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      "User-Agent": "cybersecurityguard-sdk/0.1",
      ...this.extraHeaders,
    };
    if (requireApiKey) headers["x-api-key"] = this.apiKey;
    const response = await this.fetchWithNetworkRetry(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
      try { data = JSON.parse(text); } catch {
        throw new CyberRakshakError("Server returned non-JSON response.", { status: response.status });
      }
    }
    if (!response.ok) {
      const message = (data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string")
        ? (data as { message: string }).message
        : `Request failed with status ${response.status}.`;
      if (response.status === 401 || response.status === 403) throw new CyberRakshakAuthError(message, response.status);
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0) || undefined;
        throw new CyberRakshakRateLimitError(message, response.status, retryAfter);
      }
      if (response.status === 400) throw new CyberRakshakValidationError(message, response.status, data);
      throw new CyberRakshakError(message, { status: response.status, details: data });
    }
    return data as T;
  }

  private async fetchWithNetworkRetry(url: string, init: RequestInit): Promise<Response> {
    let attempt = 0;
    for (;;) {
      try {
        return await this.fetchImpl(url, init);
      } catch (caught) {
        if (attempt >= this.maxRetries) {
          throw new CyberRakshakNetworkError(
            caught instanceof Error ? caught.message : "Network request failed.",
            caught,
          );
        }
        attempt += 1;
        await delay(this.retryBackoffMs * attempt);
      }
    }
  }
}

function asMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const metadata: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" || raw === null) metadata[key] = raw;
  }
  return metadata;
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldExecuteAgentDecision(decision: AgentActionCheckResponse) {
  return decision.decision === "ALLOW" || decision.decision === "READ_ONLY" || decision.decision === "REDACT";
}

function failClosedDecision(reason: string, riskLevel: AgentActionCheckResponse["riskLevel"]): AgentActionCheckResponse {
  return {
    decision: "BLOCK",
    riskLevel,
    reason,
    redactions: [],
    policyMatches: [{ id: "sdk.fail_closed", label: reason, severity: riskLevel }],
  };
}

function isAgentDestination(value: unknown): value is AgentActionCheckRequest["destination"] {
  return value === "external" || value === "internal" || value === "local" || value === "unknown";
}
