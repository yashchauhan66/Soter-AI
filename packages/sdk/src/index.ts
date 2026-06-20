export * from "./types";
export * from "./errors";
export type {
  SoterConfig,
  SoterProtectRequest,
  SoterProtectResult,
  SoterRiskLevel,
  SoterDetection,
  SoterContext,
  SoterPolicy,
  SoterRedactionResult,
} from "./types";
export * from "./agent-passport";
export * from "./agent-intent";
export * from "./tool-chain";
export * from "./escrow";
export * from "./dry-run";
export * from "./semantic-egress";
export * from "./evidence-vault";
export * from "./soter";
export {
  CyberRakshakClient,
  GuardClient,
  SoterClient,
  createAgentFirewallClient,
  createCybersecurityGuardClient,
  createClient,
  normalizeDecision,
} from "./client";
export type { CyberRakshakGuard as CyberRakshakGuardInterface } from "./client";

import { GuardClient, createAgentFirewallClient } from "./client";
import type {
  AgentActionCheckRequest,
  AgentApprovalResolveRequest,
  AgentDataCheckRequest,
  AgentOutputCheckRequest,
  BrowserFormCheckRequest,
  CanaryCheckRequest,
  CheckContextFlowRequest,
  CheckLegalBoundaryRequest,
  CheckMemoryPoisoningRequest,
  ClientOptions,
  CreateCanaryRequest,
  MemoryCheckRequest,
  RagTrustScoreRequest,
  RegisterContextSourceRequest,
  RegisterMcpServerRequest,
  RunBlastRadiusScenarioRequest,
  ScanMcpToolsRequest,
  SimulateBlastRadiusRequest,
  SnapshotMcpToolsRequest,
  StartAgentSessionRequest,
  StoreSafeMemoryRequest,
  ToolExecutionContext,
  ToolExecutor,
} from "./types";

export function startAgentSession(options: ClientOptions, input: StartAgentSessionRequest) {
  return createAgentFirewallClient(options).startAgentSession(input);
}

export function checkAgentAction(options: ClientOptions, input: AgentActionCheckRequest) {
  return createAgentFirewallClient(options).checkAgentAction(input);
}

export function checkToolUse(options: ClientOptions, input: AgentActionCheckRequest) {
  return createAgentFirewallClient(options).checkToolUse(input);
}

export function checkDataLeak(options: ClientOptions, input: AgentDataCheckRequest) {
  return createAgentFirewallClient(options).checkDataLeak(input);
}

export function checkDataEgress(options: ClientOptions, input: AgentDataCheckRequest) {
  return createAgentFirewallClient(options).checkDataEgress(input);
}

export function checkAgentOutput(options: ClientOptions, input: AgentOutputCheckRequest) {
  return createAgentFirewallClient(options).checkAgentOutput(input);
}

export function resolveAgentApproval(options: ClientOptions, input: AgentApprovalResolveRequest) {
  return createAgentFirewallClient(options).resolveAgentApproval(input);
}

export function scanMcpTools(options: ClientOptions, input: ScanMcpToolsRequest) {
  return createAgentFirewallClient(options).scanMcpTools(input);
}

export function checkBrowserForm(options: ClientOptions, input: BrowserFormCheckRequest) {
  return createAgentFirewallClient(options).checkBrowserForm(input);
}

export function checkMemory(options: ClientOptions, input: MemoryCheckRequest) {
  return createAgentFirewallClient(options).checkMemory(input);
}

export function scoreRagDocument(options: ClientOptions, input: RagTrustScoreRequest) {
  return createAgentFirewallClient(options).scoreRagDocument(input);
}

export function createCanary(options: ClientOptions, input: CreateCanaryRequest) {
  return createAgentFirewallClient(options).createCanary(input);
}

export function checkCanaryLeak(options: ClientOptions, input: CanaryCheckRequest) {
  return createAgentFirewallClient(options).checkCanaryLeak(input);
}

export function getAgentReplay(options: ClientOptions, sessionId: string) {
  return createAgentFirewallClient(options).getAgentReplay(sessionId);
}

export function wrapTool<TArgs, TResult>(
  options: ClientOptions,
  context: Omit<ToolExecutionContext<TArgs>, "args">,
  executor: ToolExecutor<TArgs, TResult>,
) {
  return createAgentFirewallClient(options).wrapTool(context, executor);
}

export function wrapMcpTool<TArgs, TResult>(
  options: ClientOptions,
  toolName: string,
  executor: ToolExecutor<TArgs, TResult>,
  defaults: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">> = {},
) {
  return createAgentFirewallClient(options).wrapMcpTool(toolName, executor, defaults);
}

export function createOpenClawAdapter(options: ClientOptions, adapterOptions: { sessionId: string; agentName?: string }) {
  return createAgentFirewallClient(options).createOpenClawAdapter(adapterOptions);
}

export function createLangChainToolWrapper<TArgs, TResult>(
  options: ClientOptions,
  toolName: string,
  executor: ToolExecutor<TArgs, TResult>,
  defaults: Partial<Omit<ToolExecutionContext<TArgs>, "args" | "tool">> = {},
) {
  return createAgentFirewallClient(options).createLangChainToolWrapper(toolName, executor, defaults);
}

export function createExpressAgentMiddleware(options: ClientOptions) {
  return createAgentFirewallClient(options).createExpressAgentMiddleware();
}

export function createGenericChatbotWrapper(options: ClientOptions, wrapperOptions: { sessionId?: string; agentName?: string } = {}) {
  return createAgentFirewallClient(options).createGenericChatbotWrapper(wrapperOptions);
}

export function registerContextSource(options: ClientOptions, input: RegisterContextSourceRequest) {
  return createAgentFirewallClient(options).registerContextSource(input);
}

export function checkContextFlow(options: ClientOptions, input: CheckContextFlowRequest) {
  return createAgentFirewallClient(options).checkContextFlow(input);
}

export function getLineageSession(options: ClientOptions, sessionId: string) {
  return createAgentFirewallClient(options).getLineageSession(sessionId);
}

export function listLineageIncidents(options: ClientOptions, status?: string) {
  return createAgentFirewallClient(options).listLineageIncidents(status);
}

export function simulateBlastRadius(options: ClientOptions, input: SimulateBlastRadiusRequest) {
  return createAgentFirewallClient(options).simulateBlastRadius(input);
}

export function runBlastRadiusScenario(options: ClientOptions, input: RunBlastRadiusScenarioRequest) {
  return createAgentFirewallClient(options).runBlastRadiusScenario(input);
}

export function checkMemoryPoisoning(options: ClientOptions, input: CheckMemoryPoisoningRequest) {
  return createAgentFirewallClient(options).checkMemoryPoisoning(input);
}

export function storeSafeMemory(options: ClientOptions, input: StoreSafeMemoryRequest) {
  return createAgentFirewallClient(options).storeSafeMemory(input);
}

export function quarantineMemory(options: ClientOptions, memoryRecordId: string) {
  return createAgentFirewallClient(options).quarantineMemory(memoryRecordId);
}

export function registerMcpServer(options: ClientOptions, input: RegisterMcpServerRequest) {
  return createAgentFirewallClient(options).registerMcpServer(input);
}

export function snapshotMcpTools(options: ClientOptions, input: SnapshotMcpToolsRequest) {
  return createAgentFirewallClient(options).snapshotMcpTools(input);
}

export function listMcpDrifts(options: ClientOptions, status?: string) {
  return createAgentFirewallClient(options).listMcpDrifts(status);
}

export function checkLegalBoundary(options: ClientOptions, input: CheckLegalBoundaryRequest) {
  return createAgentFirewallClient(options).checkLegalBoundary(input);
}

export function createNextAgentHandler(options: ClientOptions) {
  return createAgentFirewallClient(options).createNextAgentHandler();
}

/** @deprecated Use Soter for new integrations. */
export class CyberRakshakGuard extends GuardClient {
  constructor(options: ClientOptions) {
    super(options);
  }
}

/** @deprecated Use Soter for new integrations. */
export class CybersecurityGuard extends GuardClient {
  constructor(options: ClientOptions) {
    super(options);
  }
}
