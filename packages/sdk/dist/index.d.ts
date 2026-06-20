export * from "./types";
export * from "./errors";
export type { SoterConfig, SoterProtectRequest, SoterProtectResult, SoterRiskLevel, SoterDetection, SoterContext, SoterPolicy, SoterRedactionResult, } from "./types";
export * from "./agent-passport";
export * from "./agent-intent";
export * from "./tool-chain";
export * from "./escrow";
export * from "./dry-run";
export * from "./semantic-egress";
export * from "./evidence-vault";
export * from "./soter";
export { CyberRakshakClient, GuardClient, SoterClient, createAgentFirewallClient, createCybersecurityGuardClient, createClient, normalizeDecision, } from "./client";
export type { CyberRakshakGuard as CyberRakshakGuardInterface } from "./client";
import { GuardClient } from "./client";
import type { AgentActionCheckRequest, AgentApprovalResolveRequest, AgentDataCheckRequest, AgentOutputCheckRequest, BrowserFormCheckRequest, CanaryCheckRequest, CheckContextFlowRequest, CheckLegalBoundaryRequest, CheckMemoryPoisoningRequest, ClientOptions, CreateCanaryRequest, MemoryCheckRequest, RagTrustScoreRequest, RegisterContextSourceRequest, RegisterMcpServerRequest, RunBlastRadiusScenarioRequest, ScanMcpToolsRequest, SimulateBlastRadiusRequest, SnapshotMcpToolsRequest, StartAgentSessionRequest, StoreSafeMemoryRequest, ToolExecutionContext, ToolExecutor } from "./types";
export declare function startAgentSession(options: ClientOptions, input: StartAgentSessionRequest): Promise<import("./types").StartAgentSessionResponse>;
export declare function checkAgentAction(options: ClientOptions, input: AgentActionCheckRequest): Promise<import("./types").AgentActionCheckResponse>;
export declare function checkToolUse(options: ClientOptions, input: AgentActionCheckRequest): Promise<import("./types").AgentActionCheckResponse>;
export declare function checkDataLeak(options: ClientOptions, input: AgentDataCheckRequest): Promise<import("./types").AgentActionCheckResponse>;
export declare function checkDataEgress(options: ClientOptions, input: AgentDataCheckRequest): Promise<import("./types").AgentActionCheckResponse>;
export declare function checkAgentOutput(options: ClientOptions, input: AgentOutputCheckRequest): Promise<import("./types").AgentActionCheckResponse>;
export declare function resolveAgentApproval(options: ClientOptions, input: AgentApprovalResolveRequest): Promise<import("./types").AgentApprovalResolveResponse>;
export declare function scanMcpTools(options: ClientOptions, input: ScanMcpToolsRequest): Promise<import("./types").ScanMcpToolsResponse>;
export declare function checkBrowserForm(options: ClientOptions, input: BrowserFormCheckRequest): Promise<import("./types").BrowserFormCheckResponse>;
export declare function checkMemory(options: ClientOptions, input: MemoryCheckRequest): Promise<import("./types").MemoryCheckResponse>;
export declare function scoreRagDocument(options: ClientOptions, input: RagTrustScoreRequest): Promise<import("./types").RagTrustScoreResponse>;
export declare function createCanary(options: ClientOptions, input: CreateCanaryRequest): Promise<import("./types").CreateCanaryResponse>;
export declare function checkCanaryLeak(options: ClientOptions, input: CanaryCheckRequest): Promise<import("./types").CanaryCheckResponse>;
export declare function getAgentReplay(options: ClientOptions, sessionId: string): Promise<import("./types").AgentReplayResponse>;
export declare function wrapTool<TArgs, TResult>(options: ClientOptions, context: Omit<ToolExecutionContext<TArgs>, "args">, executor: ToolExecutor<TArgs, TResult>): (args: TArgs) => Promise<import("./types").WrappedToolResult<TResult>>;
export declare function wrapMcpTool<TArgs, TResult>(options: ClientOptions, toolName: string, executor: ToolExecutor<TArgs, TResult>, defaults?: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">>): (args: TArgs) => Promise<import("./types").WrappedToolResult<TResult>>;
export declare function createOpenClawAdapter(options: ClientOptions, adapterOptions: {
    sessionId: string;
    agentName?: string;
}): {
    beforeToolCall: (input: AgentActionCheckRequest) => Promise<import("./types").AgentActionCheckResponse>;
};
export declare function createLangChainToolWrapper<TArgs, TResult>(options: ClientOptions, toolName: string, executor: ToolExecutor<TArgs, TResult>, defaults?: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">>): (args: TArgs) => Promise<import("./types").WrappedToolResult<TResult>>;
export declare function createExpressAgentMiddleware(options: ClientOptions): (req: import("./types").ExpressLikeRequest, res: import("./types").ExpressLikeResponse, next?: import("./types").ExpressLikeNext) => Promise<unknown>;
export declare function createGenericChatbotWrapper(options: ClientOptions, wrapperOptions?: {
    sessionId?: string;
    agentName?: string;
}): {
    guardInput: (message: string) => Promise<import("./types").GuardResult>;
    checkAction: (input: AgentActionCheckRequest) => Promise<import("./types").AgentActionCheckResponse>;
    checkData: (input: AgentDataCheckRequest) => Promise<import("./types").AgentActionCheckResponse>;
    guardOutput: (aiResponse: string) => Promise<import("./types").GuardResult>;
};
export declare function registerContextSource(options: ClientOptions, input: RegisterContextSourceRequest): Promise<import("./types").RegisterContextSourceResponse>;
export declare function checkContextFlow(options: ClientOptions, input: CheckContextFlowRequest): Promise<import("./types").CheckContextFlowResponse>;
export declare function getLineageSession(options: ClientOptions, sessionId: string): Promise<import("./types").LineageSessionResponse>;
export declare function listLineageIncidents(options: ClientOptions, status?: string): Promise<import("./types").LineageIncidentsResponse>;
export declare function simulateBlastRadius(options: ClientOptions, input: SimulateBlastRadiusRequest): Promise<import("./types").SimulateBlastRadiusResponse>;
export declare function runBlastRadiusScenario(options: ClientOptions, input: RunBlastRadiusScenarioRequest): Promise<import("./types").RunBlastRadiusScenarioResponse>;
export declare function checkMemoryPoisoning(options: ClientOptions, input: CheckMemoryPoisoningRequest): Promise<import("./types").CheckMemoryPoisoningResponse>;
export declare function storeSafeMemory(options: ClientOptions, input: StoreSafeMemoryRequest): Promise<import("./types").StoreSafeMemoryResponse>;
export declare function quarantineMemory(options: ClientOptions, memoryRecordId: string): Promise<{
    id: string;
    status: string;
}>;
export declare function registerMcpServer(options: ClientOptions, input: RegisterMcpServerRequest): Promise<import("./types").RegisterMcpServerResponse>;
export declare function snapshotMcpTools(options: ClientOptions, input: SnapshotMcpToolsRequest): Promise<import("./types").SnapshotMcpToolsResponse>;
export declare function listMcpDrifts(options: ClientOptions, status?: string): Promise<import("./types").McpDriftsResponse>;
export declare function checkLegalBoundary(options: ClientOptions, input: CheckLegalBoundaryRequest): Promise<import("./types").CheckLegalBoundaryResponse>;
export declare function createNextAgentHandler(options: ClientOptions): (request: Request) => Promise<Response>;
/** @deprecated Use Soter for new integrations. */
export declare class CyberRakshakGuard extends GuardClient {
    constructor(options: ClientOptions);
}
/** @deprecated Use Soter for new integrations. */
export declare class CybersecurityGuard extends GuardClient {
    constructor(options: ClientOptions);
}
//# sourceMappingURL=index.d.ts.map