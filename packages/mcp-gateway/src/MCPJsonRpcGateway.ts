/**
 * MCP Gateway — Core JSON-RPC Proxy with Policy Enforcement
 *
 * The central enforcement point that sits between MCP clients and MCP servers.
 * Intercepts `tools/call` before execution, enforces policy, and inspects results.
 *
 * Flow:
 *   MCP Client → parse JSON-RPC → session/identity check → capability validation
 *   → argument inspection → policy enforcement → ALLOW/REDACT/BLOCK/REQUIRE_APPROVAL
 *   → forward to upstream MCP server → inspect result → return to client
 */
import { randomUUID } from "crypto";
import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcMessage,
  JsonRpcId,
  ToolCallParams,
  ToolCallResult,
  ToolDefinition,
  GatewayEnforcement,
  MCPSession,
  MCPClientIdentity,
  MCPEndpoint,
  ServerCapabilities,
  ToolCallEvidence,
} from "./MCPJsonRpcTypes";
import {
  SUPPORTED_MCP_METHODS,
  ENFORCED_MCP_METHODS,
  PASSTHROUGH_MCP_METHODS,
  isJsonRpcRequest,
  isJsonRpcNotification,
  createJsonRpcError,
  createJsonRpcSuccess,
  JSON_RPC_ERRORS,
  fingerprintToolArgs,
} from "./MCPJsonRpcTypes";
import { SessionManager } from "./MCPSessionManager";
import { ApprovalManager } from "./MCPApprovalManager";
import { MCPResultInspector } from "./MCPResultInspector";
import { DEFAULT_GATEWAY_CONFIG } from "./MCPGatewayConfig";
import type { MCPGatewayConfig } from "./MCPGatewayConfig";

export interface GatewayDeps {
  fetchImpl?: typeof fetch;
  spawnImpl?: (command: string, args: string[], options?: { env?: Record<string, string> }) => {
    stdin: { write: (data: string) => void; end: () => void };
    stdout: { on: (event: string, handler: (data: string) => void) => void };
    stderr: { on: (event: string, handler: (data: string) => void) => void };
    on: (event: string, handler: (code: number) => void) => void;
    kill: () => void;
  };
  logger?: (message: string, metadata?: Record<string, unknown>) => void;
  evaluatePolicy?: (request: {
    serverName: string;
    toolName: string;
    args: Record<string, unknown>;
    protectionMode?: string;
  }) => {
    action: string;
    riskScore: number;
    reasonCodes: string[];
    categories: string[];
    explanation: string;
    redactedArgsPreview: string;
  };
}

export class MCPJsonRpcGateway {
  private readonly config: MCPGatewayConfig;
  private readonly sessionManager: SessionManager;
  private readonly approvalManager: ApprovalManager;
  private readonly resultInspector: MCPResultInspector;
  private readonly deps: Required<GatewayDeps>;
  private readonly evidenceLog: ToolCallEvidence[] = [];
  private circuitState: "closed" | "open" | "half-open" = "closed";
  private circuitFailureCount = 0;
  private circuitLastFailure = 0;
  private readonly requestTimestamps: number[] = [];

  constructor(config: MCPGatewayConfig, deps: GatewayDeps = {}) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.sessionManager = new SessionManager({
      sessionTtlMs: this.config.sessionTtlMs,
      maxSessionsTotal: this.config.maxConcurrentSessions,
    });
    this.approvalManager = new ApprovalManager();
    this.resultInspector = new MCPResultInspector({
      maxResultBytes: this.config.maxResultBytes,
    });
    this.deps = {
      fetchImpl: deps.fetchImpl ?? globalThis.fetch.bind(globalThis),
      spawnImpl: deps.spawnImpl ?? this.defaultSpawnImpl.bind(this),
      logger: deps.logger ?? (() => {}),
      evaluatePolicy: deps.evaluatePolicy ?? this.defaultEvaluatePolicy.bind(this),
    };
  }

  private defaultSpawnImpl(
    _command: string,
    _args: string[],
    _options?: { env?: Record<string, string> },
  ): {
    stdin: { write: (data: string) => void; end: () => void };
    stdout: { on: (event: string, handler: (data: string) => void) => void };
    stderr: { on: (event: string, handler: (data: string) => void) => void };
    on: (event: string, handler: (code: number) => void) => void;
    kill: () => void;
  } {
    throw new Error("Stdio transport not supported in this environment");
  }

  private defaultEvaluatePolicy(_request: {
    serverName: string;
    toolName: string;
    args: Record<string, unknown>;
    protectionMode?: string;
  }): {
    action: string;
    riskScore: number;
    reasonCodes: string[];
    categories: string[];
    explanation: string;
    redactedArgsPreview: string;
  } {
    return {
      action: "ALLOW",
      riskScore: 0,
      reasonCodes: [],
      categories: [],
      explanation: "No policy engine configured",
      redactedArgsPreview: "",
    };
  }

  start(): void {
    this.sessionManager.start();
    this.deps.logger("MCP Gateway started", {
      listenEndpoint: this.config.listenEndpoint,
      upstreamEndpoint: this.config.upstreamEndpoint,
      protectionMode: this.config.protectionMode,
    });
  }

  stop(): void {
    this.sessionManager.stop();
    this.sessionManager.closeAll();
    this.approvalManager.clear();
    this.deps.logger("MCP Gateway stopped");
  }

  async processMessage(
    message: unknown,
    clientIdentity: MCPClientIdentity,
  ): Promise<JsonRpcMessage | null> {
    if (!this.checkRateLimit()) {
      return createJsonRpcError(null, -32000, "Rate limit exceeded");
    }
    if (this.circuitState === "open") {
      if (
        Date.now() - this.circuitLastFailure >
        (this.config.circuitBreakerCooldownMs ?? 30000)
      ) {
        this.circuitState = "half-open";
      } else {
        return createJsonRpcError(
          null,
          -32001,
          "Circuit breaker open - upstream unavailable",
        );
      }
    }
    if (isJsonRpcRequest(message)) {
      return this.handleRequest(message as JsonRpcRequest, clientIdentity);
    } else if (isJsonRpcNotification(message)) {
      await this.handleNotification(
        message as JsonRpcNotification,
        clientIdentity,
      );
      return null;
    } else {
      return createJsonRpcError(
        null,
        JSON_RPC_ERRORS.INVALID_REQUEST.code,
        JSON_RPC_ERRORS.INVALID_REQUEST.message,
      );
    }
  }

  private async handleRequest(
    request: JsonRpcRequest,
    clientIdentity: MCPClientIdentity,
  ): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
    const { method, id } = request;
    if (!SUPPORTED_MCP_METHODS.has(method)) {
      return createJsonRpcError(
        id,
        JSON_RPC_ERRORS.METHOD_NOT_FOUND.code,
        "Method not supported: " + method,
      );
    }
    const bodyStr = JSON.stringify(request);
    if (bodyStr.length > (this.config.maxBodyBytes ?? 1048576)) {
      return createJsonRpcError(id, -32002, "Request body exceeds maximum size");
    }
    if (PASSTHROUGH_MCP_METHODS.has(method)) {
      return this.handlePassthrough(request, clientIdentity);
    }
    if (ENFORCED_MCP_METHODS.has(method)) {
      return this.handleEnforcedCall(request, clientIdentity);
    }
    return this.forwardToUpstream(request, clientIdentity);
  }

  private async handleNotification(
    notification: JsonRpcNotification,
    clientIdentity: MCPClientIdentity,
  ): Promise<void> {
    const { method } = notification;
    if (method === "notifications/initialized") {
      const session = this.findSession(clientIdentity);
      if (session && session.state === "initializing") {
        session.state = "active";
        this.deps.logger("Session initialized", {
          sessionId: session.id,
          client: clientIdentity.clientId,
        });
      }
    } else if (method === "notifications/cancelled") {
      this.deps.logger("Request cancelled", {
        method,
        client: clientIdentity.clientId,
      });
    }
  }

  private async handlePassthrough(
    request: JsonRpcRequest,
    clientIdentity: MCPClientIdentity,
  ): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
    const { method, id } = request;
    if (method === "initialize") {
      return this.handleInitialize(request, clientIdentity);
    }
    try {
      const response = await this.forwardToUpstream(request, clientIdentity);
      if (response && "result" in response) {
        if (method === "tools/list") {
          const result = response.result as { tools: ToolDefinition[] };
          if (result?.tools) {
            const session = this.findSession(clientIdentity);
            if (session) {
              this.sessionManager.setToolInventory(session.id, result.tools);
            }
          }
        }
      }
      return response;
    } catch (error) {
      return this.handleUpstreamError(id, error);
    }
  }

  private async handleInitialize(
    request: JsonRpcRequest,
    clientIdentity: MCPClientIdentity,
  ): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
    const { id } = request;
    try {
      const session = this.sessionManager.createSession(
        clientIdentity,
        this.config.upstreamEndpoint,
      );
      const upstreamResponse = await this.forwardToUpstream(
        request,
        clientIdentity,
      );
      if (upstreamResponse && "result" in upstreamResponse) {
        const result = upstreamResponse.result as {
          protocolVersion: string;
          capabilities: ServerCapabilities;
          serverInfo: { name: string; version: string };
        };
        this.sessionManager.initializeSession(
          session.id,
          result.capabilities,
          result.serverInfo.name,
          result.protocolVersion,
        );
        this.deps.logger("Session initialized", {
          sessionId: session.id,
          server: result.serverInfo.name,
          capabilities: Object.keys(result.capabilities),
        });
      }
      return upstreamResponse;
    } catch (error) {
      return this.handleUpstreamError(id, error);
    }
  }

  private async handleEnforcedCall(
    request: JsonRpcRequest,
    clientIdentity: MCPClientIdentity,
  ): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
    const { params, id } = request;
    const toolParams = params as ToolCallParams;
    const traceId = "mcp_" + randomUUID().replace(/-/g, "").slice(0, 20);

    let session = this.findSession(clientIdentity);
    if (!session) {
      try {
        session = this.sessionManager.createSession(
          clientIdentity,
          this.config.upstreamEndpoint,
        );
        session.state = "active";
      } catch {
        return createJsonRpcError(id, -32003, "Failed to create session");
      }
    }
    if (session.state !== "active") {
      return createJsonRpcError(id, -32004, "Session is not active");
    }
    if (
      session.serverIdentity &&
      !this.sessionManager.verifyServerIdentity(session.id, session.serverIdentity)
    ) {
      return createJsonRpcError(id, -32005, "Server identity mismatch");
    }
    if (
      session.toolInventory &&
      !this.sessionManager.isToolDeclared(session.id, toolParams.name)
    ) {
      return createJsonRpcError(
        id,
        -32006,
        'Tool "' + toolParams.name + '" is not declared in server inventory',
      );
    }
    if (!this.sessionManager.hasCapability(session.id, "tools")) {
      return createJsonRpcError(
        id,
        -32007,
        "Tools capability was not negotiated during initialization",
      );
    }
    const args = toolParams.arguments ?? {};
    const argsStr = JSON.stringify(args);
    if (argsStr.length > (this.config.maxArgLength ?? 100000)) {
      return createJsonRpcError(id, -32008, "Tool arguments exceed maximum length");
    }
    const argsFingerprint = fingerprintToolArgs(toolParams.name, args);

    const policyDecision = this.deps.evaluatePolicy({
      serverName: session.serverIdentity ?? "unknown",
      toolName: toolParams.name,
      args,
      protectionMode: this.config.protectionMode,
    });
    const enforcement = this.mapToCanonicalEnforcement(policyDecision.action);
    const riskScore = policyDecision.riskScore;

    if (enforcement === "REQUIRE_APPROVAL" && this.config.enableApprovals) {
      try {
        const approval = this.approvalManager.createApproval({
          sessionId: session.id,
          toolName: toolParams.name,
          args,
          argsFingerprint,
          displayArgs: args,
          tenant: clientIdentity.tenant,
          project: clientIdentity.project,
          clientId: clientIdentity.clientId,
          userId: clientIdentity.userId,
          traceId,
          riskScore,
          reason: policyDecision.explanation,
          scope: "once",
        });
        return createJsonRpcSuccess(id, {
          content: [
            {
              type: "text",
              text:
                'Approval required for tool "' +
                toolParams.name +
                '". Approval ID: ' +
                approval.id +
                ". Risk score: " +
                riskScore +
                ". Reason: " +
                policyDecision.explanation,
            },
          ],
          isError: true,
        });
      } catch {
        return this.createBlockedResponse(
          id,
          toolParams.name,
          "Approval system unavailable",
        );
      }
    }
    if (enforcement === "REQUIRE_APPROVAL") {
      const existingApproval = this.approvalManager.checkApproval({
        sessionId: session.id,
        toolName: toolParams.name,
        argsFingerprint,
        tenant: clientIdentity.tenant,
      });
      if (!existingApproval) {
        return this.createBlockedResponse(
          id,
          toolParams.name,
          "Approval required but not granted",
        );
      }
      this.approvalManager.consumeApproval({
        sessionId: session.id,
        toolName: toolParams.name,
        argsFingerprint,
        tenant: clientIdentity.tenant,
      });
    }
    switch (enforcement) {
      case "BLOCK":
      case "QUARANTINE":
        this.recordEvidence({
          traceId,
          sessionId: session.id,
          tenant: clientIdentity.tenant,
          project: clientIdentity.project,
          clientId: clientIdentity.clientId,
          userId: clientIdentity.userId,
          agentId: clientIdentity.agentId,
          serverIdentity: session.serverIdentity ?? "unknown",
          toolName: toolParams.name,
          argCategories: policyDecision.categories,
          riskScore,
          enforcement,
          reason: policyDecision.explanation,
          policyVersion: this.config.policyVersion ?? "mcp-gateway-v1",
          serverCapabilities: Array.from(session.negotiatedCapabilities),
          decisionTimestamp: new Date().toISOString(),
        });
        return this.createBlockedResponse(
          id,
          toolParams.name,
          policyDecision.explanation,
        );
      case "REDACT":
      case "TRANSFORM": {
        const redactedRequest: JsonRpcRequest = {
          ...request,
          params: {
            ...toolParams,
            arguments: policyDecision.redactedArgsPreview
              ? { _redacted: policyDecision.redactedArgsPreview }
              : args,
          },
        };
        return this.forwardAndInspect(
          redactedRequest,
          session,
          clientIdentity,
          traceId,
        );
      }
      case "ALLOW":
        return this.forwardAndInspect(
          request,
          session,
          clientIdentity,
          traceId,
        );
      default:
        return this.createBlockedResponse(
          id,
          toolParams.name,
          "Unknown enforcement: " + enforcement,
        );
    }
  }

  private async forwardAndInspect(
    request: JsonRpcRequest,
    session: MCPSession,
    clientIdentity: MCPClientIdentity,
    traceId: string,
  ): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
    const { id } = request;
    const toolParams = request.params as ToolCallParams;
    try {
      const upstreamResponse = await this.forwardToUpstream(
        request,
        clientIdentity,
      );
      if (upstreamResponse && "result" in upstreamResponse) {
        const result = upstreamResponse.result as ToolCallResult;
        if (this.config.inspectResults) {
          const inspection = this.resultInspector.inspect(result, traceId);
          this.recordEvidence({
            traceId,
            sessionId: session.id,
            tenant: clientIdentity.tenant,
            project: clientIdentity.project,
            clientId: clientIdentity.clientId,
            userId: clientIdentity.userId,
            agentId: clientIdentity.agentId,
            serverIdentity: session.serverIdentity ?? "unknown",
            toolName: toolParams.name,
            argCategories: [],
            riskScore: inspection.riskScore,
            enforcement: inspection.enforcement,
            reason: inspection.reason,
            policyVersion: this.config.policyVersion ?? "mcp-gateway-v1",
            serverCapabilities: Array.from(session.negotiatedCapabilities),
            decisionTimestamp: new Date().toISOString(),
            executionTimestamp: new Date().toISOString(),
            resultRiskScore: inspection.riskScore,
            resultEnforcement: inspection.enforcement,
          });
          switch (inspection.enforcement) {
            case "BLOCK":
              return this.createBlockedResponse(
                id,
                toolParams.name,
                inspection.reason,
              );
            case "REDACT":
            case "TRANSFORM":
              if (inspection.redactedResult) {
                return createJsonRpcSuccess(id, inspection.redactedResult);
              }
              return upstreamResponse;
            default:
              return upstreamResponse;
          }
        }
        return upstreamResponse;
      }
      return upstreamResponse;
    } catch (error) {
      return this.handleUpstreamError(id, error);
    }
  }

  private async forwardToUpstream(
    message: JsonRpcRequest | JsonRpcNotification,
    _clientIdentity: MCPClientIdentity,
  ): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
    const endpoint = this.config.upstreamEndpoint;
    switch (endpoint.transport) {
      case "http":
      case "sse":
        return this.forwardViaHttp(message, endpoint);
      case "stdio":
        return this.forwardViaStdio(message, endpoint);
      default:
        throw new Error("Unsupported transport: " + endpoint.transport);
    }
  }

  private async forwardViaHttp(
    message: JsonRpcRequest | JsonRpcNotification,
    endpoint: MCPEndpoint,
  ): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs ?? 60000,
    );
    try {
      const response = await this.deps.fetchImpl(endpoint.address, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Upstream returned status " + response.status);
      }
      const result = (await response.json()) as
        | JsonRpcSuccessResponse
        | JsonRpcErrorResponse;
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async forwardViaStdio(
    message: JsonRpcRequest | JsonRpcNotification,
    endpoint: MCPEndpoint,
  ): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
    return new Promise((resolve, reject) => {
      const proc = this.deps.spawnImpl(
        endpoint.address,
        endpoint.args ?? [],
        { env: endpoint.env },
      );
      let responseData = "";
      let errorData = "";
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error("Upstream stdio timeout"));
      }, this.config.requestTimeoutMs ?? 60000);
      proc.stdout.on("data", (data: string) => {
        responseData += data;
        try {
          const parsed = JSON.parse(responseData);
          clearTimeout(timeout);
          proc.kill();
          resolve(parsed as JsonRpcSuccessResponse | JsonRpcErrorResponse);
        } catch {
          // Incomplete JSON, wait for more data
        }
      });
      proc.stderr.on("data", (data: string) => {
        errorData += data;
      });
      proc.on("close", (code: number) => {
        clearTimeout(timeout);
        if (code !== 0 && !responseData) {
          reject(
            new Error(
              "Upstream stdio exited with code " + code + ": " + errorData,
            ),
          );
        }
      });
      proc.stdin.write(JSON.stringify(message) + "\n");
      proc.stdin.end();
    });
  }

  private handleUpstreamError(
    id: JsonRpcId,
    _error: unknown,
  ): JsonRpcErrorResponse {
    this.circuitFailureCount++;
    this.circuitLastFailure = Date.now();
    if (
      this.circuitFailureCount >= (this.config.circuitBreakerThreshold ?? 5)
    ) {
      this.circuitState = "open";
      this.deps.logger("Circuit breaker opened", {
        failures: this.circuitFailureCount,
      });
    }
    return createJsonRpcError(id, -32010, "Upstream server error");
  }

  private createBlockedResponse(
    id: JsonRpcId,
    _toolName: string,
    reason: string,
  ): JsonRpcSuccessResponse {
    return createJsonRpcSuccess(id, {
      content: [
        {
          type: "text",
          text:
            "Tool call blocked by SoterAI MCP Gateway: " + reason,
        },
      ],
      isError: true,
    });
  }

  private findSession(
    clientIdentity: MCPClientIdentity,
  ): MCPSession | null {
    for (const session of this.sessionManager.getActiveSessions()) {
      if (
        this.sessionManager.verifyClientIdentity(session.id, clientIdentity)
      ) {
        return session;
      }
    }
    return null;
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowMs = 60000;
    while (
      this.requestTimestamps.length > 0 &&
      this.requestTimestamps[0] < now - windowMs
    ) {
      this.requestTimestamps.shift();
    }
    if (this.requestTimestamps.length >= (this.config.rateLimitPerMinute ?? 120)) {
      return false;
    }
    this.requestTimestamps.push(now);
    return true;
  }

  private mapToCanonicalEnforcement(action: string): GatewayEnforcement {
    switch (action) {
      case "ALLOW":
      case "ALLOW_ONCE":
      case "ALLOW_WITH_TRANSFORMATION":
      case "ALLOW_IN_SANDBOX":
        return "ALLOW";
      case "ASK":
        return "REQUIRE_APPROVAL";
      case "DENY":
        return "BLOCK";
      case "QUARANTINE":
        return "QUARANTINE";
      default:
        return "BLOCK";
    }
  }

  private recordEvidence(evidence: ToolCallEvidence): void {
    this.evidenceLog.push(evidence);
    this.deps.logger("Tool call evidence", {
      traceId: evidence.traceId,
      toolName: evidence.toolName,
      enforcement: evidence.enforcement,
      riskScore: evidence.riskScore,
    });
  }

  getEvidenceLog(): ToolCallEvidence[] {
    return [...this.evidenceLog];
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }
}
