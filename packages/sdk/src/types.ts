export type GuardAction = "ALLOW" | "ALLOW_WITH_REDACTION" | "REWRITE" | "BLOCK" | "HUMAN_REVIEW";

/**
 * Normalized, integration-friendly decision derived from the server `action`.
 * `ALLOW_WITH_REDACTION` and `REWRITE` both collapse to `REDACT` because both
 * produce a `safeText`/`redactedText` the caller should forward instead of the
 * original text.
 */
export type GuardDecision = "ALLOW" | "REDACT" | "BLOCK" | "HUMAN_REVIEW";

export type GuardDirection = "INPUT" | "OUTPUT" | "ANALYZE";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskType =
  | "PROMPT_INJECTION"
  | "JAILBREAK"
  | "SYSTEM_PROMPT_LEAK_ATTEMPT"
  | "SYSTEM_PROMPT_LEAKAGE"
  | "PII_DETECTED"
  | "INDIA_PII_DETECTED"
  | "SECRET_DETECTED"
  | "UNSAFE_OUTPUT"
  | "RATE_LIMIT"
  | "TOKEN_ABUSE"
  | "LOW_RISK";

/** Alias kept for parity with the Python SDK / docs naming. */
export type GuardRiskType = RiskType;

export interface GuardFinding {
  type: RiskType;
  label: string;
  severity: Severity;
  score: number;
  message: string;
  matched?: string;
}

export interface GuardResult {
  allowed: boolean;
  action: GuardAction;
  /** Normalized decision derived from `action`. Populated by the SDK. */
  decision?: GuardDecision;
  riskScore: number;
  riskTypes: RiskType[];
  reason: string;
  redactedText?: string;
  safeText?: string;
  findings: GuardFinding[];
  metadata?: Record<string, unknown>;
}

export type MetadataValue = string | number | boolean | null;

export interface GuardInputRequest {
  /** Primary text to inspect. Alias of `message`; one of the two is required. */
  text?: string;
  /** Native API field. Alias of `text`; one of the two is required. */
  message?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface GuardOutputRequest {
  /** Primary text to inspect. Alias of `aiResponse`; one of the two is required. */
  text?: string;
  /** Native API field. Alias of `text`; one of the two is required. */
  aiResponse?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface AnalyzeRequest {
  text: string;
  direction: "INPUT" | "OUTPUT";
  metadata?: Record<string, MetadataValue>;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Optional project identifier, forwarded as request metadata. */
  projectId?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  /** Number of retry attempts for transient (5xx / network) failures. Default 0. */
  retries?: number;
  /**
   * When true, the SDK logs redacted diagnostics. The API key and raw text are
   * NEVER logged regardless of this flag.
   */
  debug?: boolean;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

/** Configuration for the primary Soter client. Explicit values override environment variables. */
export interface SoterConfig extends Omit<ClientOptions, "apiKey"> {
  apiKey?: string;
}

export type SoterRiskLevel = Severity;

export interface SoterDetection {
  type: RiskType;
  label: string;
  riskLevel: SoterRiskLevel;
  score: number;
  message: string;
}

export interface SoterContext {
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface SoterPolicy {
  id?: string;
  mode?: "MONITOR" | "ENFORCE";
}

export interface SoterProtectRequest {
  input: string;
  context?: SoterContext;
  policy?: SoterPolicy;
}

export interface SoterRedactionResult {
  redacted: boolean;
  text: string;
  categories: RiskType[];
}

export interface SoterProtectResult extends GuardResult {
  riskLevel: SoterRiskLevel;
  detections: SoterDetection[];
  redaction?: SoterRedactionResult;
}

/** Friendlier alias used throughout the docs and examples. */
export type CyberRakshakConfig = ClientOptions;

export interface SecureChatOptions {
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
  callLLM: (input: { safeInput: string; original: string; inputResult: GuardResult }) => Promise<string>;
  blockedResponse?: string;
}

export interface SecureChatResult {
  reply: string;
  blocked: boolean;
  inputResult: GuardResult;
  outputResult?: GuardResult;
}

/** Options for the combined guard conversation helper. */
export interface GuardConversationOptions {
  input: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
  callLLM: (safeInput: string) => Promise<string>;
  blockedResponse?: string;
}

export interface ProtectChatOptions {
  message: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
  callLLM: (safeMessage: string, context: { originalMessage: string; inputGuard: GuardResult }) => Promise<string>;
  blockedResponse?: string;
  outputBlockedResponse?: string;
}

export interface ProtectChatResult {
  allowed: boolean;
  blocked: boolean;
  inputAction: GuardAction;
  outputAction?: GuardAction;
  llmCalled: boolean;
  safeResponse: string;
  inputGuard: GuardResult;
  outputGuard?: GuardResult;
  latencyMs: number;
}

export interface RagSource {
  id?: string;
  text: string;
  metadata?: Record<string, MetadataValue>;
  citation?: string;
}

export interface SafeRagSource extends RagSource {
  safeText: string;
  guard: GuardResult;
}

export interface ProtectRagOptions<TSource extends RagSource = RagSource> {
  query: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, MetadataValue>;
  retrieve: (safeQuery: string) => Promise<TSource[]>;
  callLLM: (input: { safeQuery: string; safeContext: string; sources: SafeRagSource[] }) => Promise<string>;
  blockedResponse?: string;
  outputBlockedResponse?: string;
}

export interface ProtectRagResult {
  allowed: boolean;
  blocked: boolean;
  inputAction: GuardAction;
  outputAction?: GuardAction;
  llmCalled: boolean;
  retrieved: number;
  usedSources: SafeRagSource[];
  excludedSources: Array<{ source: RagSource; guard: GuardResult }>;
  safeResponse: string;
  inputGuard: GuardResult;
  outputGuard?: GuardResult;
  latencyMs: number;
}

export interface ExpressLikeRequest {
  body?: {
    message?: unknown;
    userId?: unknown;
    sessionId?: unknown;
    metadata?: unknown;
  };
}

export interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  json(body: unknown): unknown;
}

export type ExpressLikeNext = (error?: unknown) => unknown;

export type AgentType = "computer_use" | "browser_agent" | "mcp_agent" | "rag_agent" | "chatbot" | "custom";
export type AgentDecision = "ALLOW" | "BLOCK" | "REDACT" | "ASK_APPROVAL" | "SANDBOX_ONLY" | "READ_ONLY";
export type AgentRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AgentDestination = "external" | "internal" | "local" | "unknown";

export interface AgentRiskContext {
  userApproved?: boolean;
  externalDestination?: boolean;
  canModifyData?: boolean;
  canDeleteData?: boolean;
  canSendMessage?: boolean;
  canRunCode?: boolean;
  canAccessFiles?: boolean;
  canReadSecrets?: boolean;
  canMakePayment?: boolean;
  canDisableSecurity?: boolean;
}

export interface StartAgentSessionRequest {
  agentName: string;
  agentType: AgentType;
  userId?: string;
  projectId?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface AgentPolicySnapshot {
  allowedDomains: string[];
  blockedDomains: string[];
  allowedWorkspaceDir?: string;
  blockedFilePatterns: string[];
  toolsRequiringApproval: string[];
  toolsAlwaysBlocked: string[];
  piiMode: "redact" | "approval" | "block";
  secretsMode: "redact" | "approval" | "block";
  failClosed: boolean;
  maxRiskWithoutApproval: AgentRiskLevel;
}

export interface StartAgentSessionResponse {
  sessionId: string;
  policy: AgentPolicySnapshot;
  allowedTools: string[];
  blockedTools: string[];
  approvalRequiredTools: string[];
}

export interface AgentActionCheckRequest {
  sessionId?: string;
  agentName?: string;
  tool: string;
  action: string;
  target?: string;
  content?: string;
  destination?: AgentDestination;
  riskContext?: AgentRiskContext;
  metadata?: Record<string, MetadataValue>;
}

export interface AgentRedaction {
  type: string;
  label: string;
  severity: AgentRiskLevel;
}

export interface AgentPolicyMatch {
  id: string;
  label: string;
  severity: AgentRiskLevel;
}

export interface AgentActionCheckResponse {
  decision: AgentDecision;
  riskLevel: AgentRiskLevel;
  reason: string;
  safeContent?: string;
  redactions: AgentRedaction[];
  requiredApproval?: {
    message: string;
    approvalToken: string;
    approvalId?: string;
  };
  policyMatches: AgentPolicyMatch[];
  auditId?: string;
}

export interface AgentDataCheckRequest {
  sessionId?: string;
  content: string;
  source?: "rag_context" | "browser" | "file" | "email" | "clipboard" | "terminal" | "memory" | "custom";
  destination?: AgentDestination;
  target?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface AgentOutputCheckRequest {
  sessionId?: string;
  content: string;
  destination?: AgentDestination;
  metadata?: Record<string, MetadataValue>;
}

export interface AgentApprovalResolveRequest {
  approvalToken: string;
  decision: "APPROVED" | "DENIED";
  editedContent?: string;
  resolvedBy?: string;
  metadata?: Record<string, MetadataValue>;
}

export interface AgentApprovalResolveResponse {
  approvalId: string;
  status: "APPROVED" | "DENIED";
  decision: "ALLOW" | "BLOCK";
  safeContent?: string;
  message: string;
}

export interface ToolExecutionContext<TArgs> {
  sessionId?: string;
  agentName?: string;
  tool: string;
  action: string;
  target?: string;
  args: TArgs;
  content?: string;
  destination?: AgentDestination;
  riskContext?: AgentRiskContext;
  metadata?: Record<string, MetadataValue>;
}

export type ToolExecutor<TArgs, TResult> = (args: TArgs, decision: AgentActionCheckResponse) => Promise<TResult>;

export interface WrappedToolResult<TResult> {
  executed: boolean;
  decision: AgentActionCheckResponse;
  result?: TResult;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface ScanMcpToolsRequest {
  serverName: string;
  tools: McpToolDefinition[];
}

export interface ScanMcpToolsResponse {
  serverRiskLevel: AgentRiskLevel;
  tools: Array<{
    tool: string;
    riskLevel: AgentRiskLevel;
    capabilities: string[];
    reasons: string[];
    recommendedDecision: "ALLOW" | "ASK_APPROVAL" | "BLOCK";
  }>;
  recommendedManifest: { allowedTools: string[]; approvalRequired: string[]; blocked: string[] };
}

export interface BrowserFormCheckRequest {
  sessionId?: string;
  url?: string;
  domain?: string;
  formFields: Array<{ name: string; value?: string; type?: string }>;
  pageText?: string;
  destination?: AgentDestination;
}

export interface BrowserFormCheckResponse {
  decision: AgentDecision | "TAKEOVER_REQUIRED";
  riskLevel: AgentRiskLevel;
  reason: string;
  safeFields: Array<{ name: string; value?: string; type?: string }>;
  findings: unknown[];
}

export interface MemoryCheckRequest {
  sessionId?: string;
  memoryAction: "STORE" | "READ" | "UPDATE" | "DELETE";
  content?: string;
  memoryType?: "short_term" | "long_term" | "user_profile" | "tool_memory" | "custom";
}

export interface MemoryCheckResponse {
  decision: AgentDecision;
  riskLevel: AgentRiskLevel;
  reason: string;
  safeContent: string;
  redactions: unknown[];
}

export interface RagTrustScoreRequest {
  projectId?: string;
  documentId: string;
  content: string;
  source?: "upload" | "url" | "email" | "api" | "unknown";
  metadata?: Record<string, unknown>;
}

export interface RagTrustScoreResponse {
  trustScore: number;
  trustLevel: "TRUSTED" | "SUSPICIOUS" | "QUARANTINED" | "NEEDS_REVIEW";
  findings: unknown[];
  recommendedAction: "INDEX" | "QUARANTINE" | "REVIEW" | "REDACT_AND_INDEX";
}

export interface CreateCanaryRequest {
  scope: "SYSTEM_PROMPT" | "RAG_CONTEXT" | "TOOL_OUTPUT" | "PRIVATE_CONTEXT";
  label?: string;
}

export interface CreateCanaryResponse {
  canaryToken: string;
  instructions: string;
}

export interface CanaryCheckRequest {
  sessionId?: string;
  content: string;
  location?: "agent_output" | "tool_call" | "email" | "api_request" | "browser_form" | "external_post";
}

export interface CanaryCheckResponse {
  leakDetected: boolean;
  matchedCanaries: Array<{ id?: string; tokenLabel?: string; scope?: string }>;
  decision: "BLOCK" | "ALLOW";
  riskLevel: AgentRiskLevel;
  reason: string;
}

export interface AgentReplayResponse {
  sessionId: string;
  summary: string;
  riskLevel: AgentRiskLevel;
  timeline: Array<Record<string, unknown>>;
}

// --- Advanced AI Security MVP 1: Context Lineage Firewall ---

export type LineageSourceType =
  | "USER_PROMPT" | "RAG_DOCUMENT" | "BROWSER_PAGE" | "EMAIL" | "FILE" | "MCP_TOOL"
  | "API_RESPONSE" | "MEMORY" | "CLIPBOARD" | "TERMINAL" | "SYSTEM_PROMPT" | "PRIVATE_CONTEXT" | "CUSTOM";
export type LineageSourceTrustLevel = "TRUSTED" | "INTERNAL" | "UNKNOWN" | "UNTRUSTED" | "MALICIOUS";
export type LineageSensitivityLevel = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SECRET" | "REGULATED";
export type LineageDestinationType =
  | "LLM" | "TOOL" | "EXTERNAL_API" | "EMAIL" | "BROWSER_FORM" | "FILE_WRITE"
  | "MEMORY" | "FINAL_OUTPUT" | "WEBHOOK" | "CUSTOM";
export type LineageDestinationTrustLevel = "TRUSTED" | "INTERNAL" | "UNKNOWN" | "EXTERNAL" | "BLOCKED";
export type LineageDecision = "ALLOW" | "BLOCK" | "REDACT" | "ASK_APPROVAL" | "REVIEW";

export interface RegisterContextSourceRequest {
  sessionId?: string;
  sourceType: LineageSourceType;
  sourceName?: string;
  sourceTrustLevel: LineageSourceTrustLevel;
  sensitivityLevel: LineageSensitivityLevel;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisterContextSourceResponse {
  sourceId: string;
  contentHash: string;
  sensitivityLevel: LineageSensitivityLevel;
  findings: Array<{ type: string; label: string; severity: string }>;
}

export interface CheckContextFlowRequest {
  sessionId?: string;
  sourceIds?: string[];
  destinationType: LineageDestinationType;
  destinationName?: string;
  destinationTrustLevel: LineageDestinationTrustLevel;
  action?: string;
  content?: string;
  regulatedEgress?: "BLOCK" | "ASK_APPROVAL";
  metadata?: Record<string, unknown>;
}

export interface CheckContextFlowResponse {
  decision: LineageDecision;
  riskLevel: AgentRiskLevel;
  reason: string;
  safeContent: string;
  redactions: string[];
  lineageIncidentId: string | null;
  policyMatches: string[];
}

export interface LineageSessionResponse {
  sessionId: string;
  sources: Array<Record<string, unknown>>;
  flows: Array<Record<string, unknown>>;
  incidents: Array<Record<string, unknown>>;
}

export interface LineageIncidentsResponse {
  incidents: Array<Record<string, unknown>>;
}

// --- Advanced AI Security MVP 1: Agent Blast Radius Simulator ---

export interface BlastRadiusDataSource {
  type: string;
  sensitivity?: LineageSensitivityLevel;
}

export interface SimulateBlastRadiusRequest {
  agentName: string;
  agentType?: string;
  tools?: string[];
  permissions?: Record<string, string>;
  dataSources?: BlastRadiusDataSource[];
  externalDestinations?: string[];
  memoryAccess?: { longTermMemory?: boolean; projectMemory?: boolean };
  policies?: Record<string, boolean>;
}

export interface SimulateBlastRadiusResponse {
  blastRadiusScore: number;
  riskLevel: AgentRiskLevel;
  findings: string[];
  recommendations: string[];
  scenarioResults: Array<Record<string, unknown>>;
}

export interface RunBlastRadiusScenarioRequest extends SimulateBlastRadiusRequest {
  scenarioName: string;
}

export interface RunBlastRadiusScenarioResponse {
  scenarioName: string;
  baselineScore: number;
  blastRadiusScore: number;
  riskLevel: AgentRiskLevel;
  narrative: string;
  findings: string[];
  recommendations: string[];
}

// --- Advanced AI Security MVP 2: Memory Poisoning Detector ---

export type MemoryPoisoningDecision = "ALLOW" | "BLOCK" | "REDACT" | "QUARANTINE" | "REVIEW";
export type MemoryScope = "USER" | "PROJECT" | "AGENT" | "TOOL" | "GLOBAL";
export type MemoryRecordType = "PREFERENCE" | "FACT" | "INSTRUCTION" | "TOOL_CONFIG" | "POLICY_HINT" | "CUSTOM";

export interface MemoryPoisoningFinding {
  findingType: string;
  riskLevel: AgentRiskLevel;
  reason: string;
  recommendedAction: string;
}

export interface CheckMemoryPoisoningRequest {
  agentName: string;
  memoryScope?: MemoryScope;
  memoryType?: MemoryRecordType;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface CheckMemoryPoisoningResponse {
  decision: MemoryPoisoningDecision;
  riskLevel: AgentRiskLevel;
  reason: string;
  safeContent: string;
  findings: MemoryPoisoningFinding[];
}

export interface StoreSafeMemoryRequest extends CheckMemoryPoisoningRequest {
  userId?: string;
  previousContent?: string;
}

export interface StoreSafeMemoryResponse {
  memoryRecordId: string;
  stored: boolean;
  status: "ACTIVE" | "QUARANTINED" | "NEEDS_REVIEW";
  decision: MemoryPoisoningDecision;
  riskLevel: AgentRiskLevel;
  reason: string;
  safeContent: string;
  findings: MemoryPoisoningFinding[];
  diff: Record<string, boolean> | null;
}

// --- Advanced AI Security MVP 2: MCP Tool Drift Monitor ---

export interface RegisterMcpServerRequest {
  serverName: string;
  serverUrl?: string;
  trustLevel?: "TRUSTED" | "INTERNAL" | "UNKNOWN" | "UNTRUSTED";
  metadata?: Record<string, unknown>;
}

export interface RegisterMcpServerResponse {
  serverId: string;
  serverName: string;
  status: string;
  trustLevel: string;
}

export interface SnapshotMcpToolsRequest {
  serverName: string;
  tools: Array<{ name: string; description?: string; inputSchema?: unknown; outputSchema?: unknown; endpoint?: string }>;
}

export interface SnapshotMcpToolsResponse {
  serverRiskLevel: AgentRiskLevel;
  serverStatus: string;
  snapshotsCreated: number;
  drifts: Array<{ toolName: string; driftType: string; riskBefore: AgentRiskLevel; riskAfter: AgentRiskLevel; recommendation: string }>;
  tools: Array<{ tool: string; riskLevel: AgentRiskLevel; capabilities: string[]; reasons: string[] }>;
}

export interface McpDriftsResponse {
  drifts: Array<Record<string, unknown>>;
}

// --- Advanced AI Security MVP 3: Agent Legal Boundary Guard ---

export type LegalActionCategory =
  | "READ_ONLY" | "LOGIN" | "FORM_SUBMIT" | "MESSAGE_SEND" | "PURCHASE" | "PAYMENT"
  | "BOOKING" | "SCRAPING" | "ACCOUNT_CHANGE" | "TERMS_ACCEPTANCE" | "DATA_UPLOAD" | "UNKNOWN";
export type LegalDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL" | "TAKEOVER_REQUIRED" | "REVIEW";

export interface CheckLegalBoundaryRequest {
  sessionId?: string;
  agentName: string;
  websiteUrl?: string;
  domain?: string;
  action?: string;
  actionCategory?: LegalActionCategory;
  content?: string;
  userConsentProvided?: boolean;
  metadata?: {
    loggedIn?: boolean;
    paymentInvolved?: boolean;
    personalDataInvolved?: boolean;
    termsAcceptance?: boolean;
    domainTrusted?: boolean;
    bypassDetected?: boolean;
    scrapeCount?: number;
  };
}

export interface CheckLegalBoundaryResponse {
  decision: LegalDecision;
  riskLevel: AgentRiskLevel;
  reason: string;
  requiredUserMessage: string;
  evidence: string[];
  auditId: string;
}
