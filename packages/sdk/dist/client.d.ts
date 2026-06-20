import type { AnalyzeRequest, AgentActionCheckRequest, AgentActionCheckResponse, AgentApprovalResolveRequest, AgentApprovalResolveResponse, AgentDataCheckRequest, AgentOutputCheckRequest, AgentReplayResponse, BrowserFormCheckRequest, BrowserFormCheckResponse, CanaryCheckRequest, CanaryCheckResponse, CheckContextFlowRequest, CheckContextFlowResponse, CheckLegalBoundaryRequest, CheckLegalBoundaryResponse, CheckMemoryPoisoningRequest, CheckMemoryPoisoningResponse, ClientOptions, CreateCanaryRequest, CreateCanaryResponse, ExpressLikeNext, ExpressLikeRequest, ExpressLikeResponse, GuardAction, GuardConversationOptions, GuardDecision, GuardInputRequest, GuardOutputRequest, GuardResult, LineageIncidentsResponse, LineageSessionResponse, McpDriftsResponse, MemoryCheckRequest, MemoryCheckResponse, ProtectChatOptions, ProtectChatResult, ProtectRagOptions, ProtectRagResult, RagSource, RagTrustScoreRequest, RagTrustScoreResponse, RegisterContextSourceRequest, RegisterContextSourceResponse, RegisterMcpServerRequest, RegisterMcpServerResponse, RunBlastRadiusScenarioRequest, RunBlastRadiusScenarioResponse, ScanMcpToolsRequest, ScanMcpToolsResponse, SecureChatOptions, SecureChatResult, SimulateBlastRadiusRequest, SimulateBlastRadiusResponse, SnapshotMcpToolsRequest, SnapshotMcpToolsResponse, StartAgentSessionRequest, StartAgentSessionResponse, StoreSafeMemoryRequest, StoreSafeMemoryResponse, ToolExecutionContext, ToolExecutor, WrappedToolResult } from "./types";
export declare function normalizeDecision(action: GuardAction): GuardDecision;
/** @deprecated Use the Soter class for new integrations. */
export interface CyberRakshakGuard {
    input(message: string, options?: Omit<GuardInputRequest, "message" | "text">): Promise<GuardResult>;
    output(aiResponse: string, options?: Omit<GuardOutputRequest, "aiResponse" | "text">): Promise<GuardResult>;
    analyze(text: string, direction: AnalyzeRequest["direction"]): Promise<GuardResult>;
    analyze(input: AnalyzeRequest): Promise<GuardResult>;
    guardInput(input: GuardInputRequest): Promise<GuardResult>;
    guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
    protectChat(input: ProtectChatOptions): Promise<ProtectChatResult>;
    protectRag(input: ProtectRagOptions): Promise<ProtectRagResult>;
    secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
    guardConversation(input: GuardConversationOptions): Promise<SecureChatResult>;
    shouldCallLLM(result: GuardResult): boolean;
    isAllowed(result: GuardResult): boolean;
    shouldBlock(result: GuardResult): boolean;
    getSafeInput(result: GuardResult, originalMessage: string): string;
    getSafeOutput(result: GuardResult, originalOutput: string): string;
    getSafeText(result: GuardResult, fallback?: string): string | undefined;
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
    quarantineMemory(memoryRecordId: string): Promise<{
        id: string;
        status: string;
    }>;
    registerMcpServer(input: RegisterMcpServerRequest): Promise<RegisterMcpServerResponse>;
    snapshotMcpTools(input: SnapshotMcpToolsRequest): Promise<SnapshotMcpToolsResponse>;
    listMcpDrifts(status?: string): Promise<McpDriftsResponse>;
    checkLegalBoundary(input: CheckLegalBoundaryRequest): Promise<CheckLegalBoundaryResponse>;
    wrapTool<TArgs, TResult>(context: Omit<ToolExecutionContext<TArgs>, "args">, executor: ToolExecutor<TArgs, TResult>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
    wrapMcpTool<TArgs, TResult>(toolName: string, executor: ToolExecutor<TArgs, TResult>, defaults?: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
    createOpenClawAdapter(options: {
        sessionId: string;
        agentName?: string;
    }): {
        beforeToolCall: (input: AgentActionCheckRequest) => Promise<AgentActionCheckResponse>;
    };
    createLangChainToolWrapper<TArgs, TResult>(toolName: string, executor: ToolExecutor<TArgs, TResult>, defaults?: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
    createGenericChatbotWrapper(options: {
        sessionId?: string;
        agentName?: string;
    }): {
        guardInput: (message: string) => Promise<GuardResult>;
        checkAction: (input: AgentActionCheckRequest) => Promise<AgentActionCheckResponse>;
        checkData: (input: AgentDataCheckRequest) => Promise<AgentActionCheckResponse>;
        guardOutput: (aiResponse: string) => Promise<GuardResult>;
    };
    createExpressAgentMiddleware(): (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => Promise<unknown>;
    createNextAgentHandler(): (request: Request) => Promise<Response>;
}
export declare function createClient(options: ClientOptions): CyberRakshakGuard;
export declare function createAgentFirewallClient(options: ClientOptions): CyberRakshakGuard;
/** @deprecated Use new Soter(options) for new integrations. */
export declare function createCybersecurityGuardClient(options: ClientOptions): CyberRakshakGuard;
/** @deprecated Use Soter for new integrations. GuardClient remains supported. */
export declare class GuardClient implements CyberRakshakGuard {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly projectId?;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly retryBackoffMs;
    private readonly debug;
    private readonly fetchImpl;
    private readonly extraHeaders;
    constructor(options: ClientOptions);
    input(message: string, options?: Omit<GuardInputRequest, "message" | "text">): Promise<GuardResult>;
    output(aiResponse: string, options?: Omit<GuardOutputRequest, "aiResponse" | "text">): Promise<GuardResult>;
    guardInput(input: GuardInputRequest): Promise<GuardResult>;
    guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
    analyze(textOrInput: string | AnalyzeRequest, direction?: AnalyzeRequest["direction"]): Promise<GuardResult>;
    shouldCallLLM(result: GuardResult): boolean;
    isAllowed(result: GuardResult): boolean;
    shouldBlock(result: GuardResult): boolean;
    getSafeInput(result: GuardResult, originalMessage: string): string;
    getSafeOutput(result: GuardResult, originalOutput: string): string;
    getSafeText(result: GuardResult, fallback?: string): string | undefined;
    protectChat(input: ProtectChatOptions): Promise<ProtectChatResult>;
    protectRag<TSource extends RagSource = RagSource>(input: ProtectRagOptions<TSource>): Promise<ProtectRagResult>;
    secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
    guardConversation(input: GuardConversationOptions): Promise<SecureChatResult>;
    createExpressMiddleware(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">): (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => Promise<unknown>;
    createNextHandler(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">): (request: Request) => Promise<Response>;
    startAgentSession(input: StartAgentSessionRequest): Promise<StartAgentSessionResponse>;
    checkAgentAction(input: AgentActionCheckRequest): Promise<AgentActionCheckResponse>;
    checkToolUse(input: AgentActionCheckRequest): Promise<AgentActionCheckResponse>;
    checkDataLeak(input: AgentDataCheckRequest): Promise<AgentActionCheckResponse>;
    checkDataEgress(input: AgentDataCheckRequest): Promise<AgentActionCheckResponse>;
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
    quarantineMemory(memoryRecordId: string): Promise<{
        id: string;
        status: string;
    }>;
    registerMcpServer(input: RegisterMcpServerRequest): Promise<RegisterMcpServerResponse>;
    snapshotMcpTools(input: SnapshotMcpToolsRequest): Promise<SnapshotMcpToolsResponse>;
    listMcpDrifts(status?: string): Promise<McpDriftsResponse>;
    checkLegalBoundary(input: CheckLegalBoundaryRequest): Promise<CheckLegalBoundaryResponse>;
    wrapTool<TArgs, TResult>(context: Omit<ToolExecutionContext<TArgs>, "args">, executor: ToolExecutor<TArgs, TResult>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
    wrapMcpTool<TArgs, TResult>(toolName: string, executor: ToolExecutor<TArgs, TResult>, defaults?: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
    createOpenClawAdapter(options: {
        sessionId: string;
        agentName?: string;
    }): {
        beforeToolCall: (input: AgentActionCheckRequest) => Promise<AgentActionCheckResponse>;
    };
    createLangChainToolWrapper<TArgs, TResult>(toolName: string, executor: ToolExecutor<TArgs, TResult>, defaults?: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">>): (args: TArgs) => Promise<WrappedToolResult<TResult>>;
    createGenericChatbotWrapper(options: {
        sessionId?: string;
        agentName?: string;
    }): {
        guardInput: (message: string) => Promise<GuardResult>;
        checkAction: (input: AgentActionCheckRequest) => Promise<AgentActionCheckResponse>;
        checkData: (input: AgentDataCheckRequest) => Promise<AgentActionCheckResponse>;
        guardOutput: (aiResponse: string) => Promise<GuardResult>;
    };
    createExpressAgentMiddleware(): (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => Promise<unknown>;
    createNextAgentHandler(): (request: Request) => Promise<Response>;
    private post;
    private get;
    private handleResponse;
    private fetchWithNetworkRetry;
    private decisionOf;
    private withProjectMetadata;
    private log;
}
/** @deprecated Use Soter for new integrations. */
export { GuardClient as CyberRakshakClient };
/** Soter-branded client alias. */
export { GuardClient as SoterClient };
//# sourceMappingURL=client.d.ts.map