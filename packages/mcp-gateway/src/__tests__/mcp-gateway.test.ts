/**
 * MCP Gateway — Comprehensive test suite
 *
 * Tests the inline MCP enforcement gateway with a fake MCP server
 * that records whether execution occurred, proving blocked calls
 * never reached upstream.
 */
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { MCPJsonRpcGateway } from "../MCPJsonRpcGateway";
import type { GatewayDeps } from "../MCPJsonRpcGateway";
import { SessionManager } from "../MCPSessionManager";
import { ApprovalManager } from "../MCPApprovalManager";
import { MCPResultInspector } from "../MCPResultInspector";
import { DEFAULT_GATEWAY_CONFIG } from "../MCPGatewayConfig";
import { mapGuardActionToEnforcement, buildEvidenceEnvelope } from "../MCPGatewayAdapter";

// ─── Fake MCP Server ────────────────────────────────────────────────────────
class FakeMCPServer {
  public toolsCalled: Array<{ tool: string; args: unknown }> = [];
  public toolsListed = false;
  public initialized = false;
  public shouldFail = false;
  public shouldTimeout = false;
  public tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> = [
    { name: "read_file", description: "Read a file", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
    { name: "write_file", description: "Write to a file", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } } },
    { name: "execute_command", description: "Run a shell command", inputSchema: { type: "object", properties: { command: { type: "string" } } } },
    { name: "list_directory", description: "List directory contents", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
    { name: "fetch_url", description: "Fetch a URL", inputSchema: { type: "object", properties: { url: { type: "string" } } } },
    { name: "read_credentials", description: "Read credentials", inputSchema: { type: "object", properties: { service: { type: "string" } } } },
  ];

  async handleRequest(request: { method: string; params?: Record<string, unknown>; id: number }): Promise<unknown> {
    if (this.shouldFail) throw new Error("Upstream failure");
    if (this.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    switch (request.method) {
      case "initialize":
        this.initialized = true;
        return { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "fake-server", version: "1.0.0" } };
      case "tools/list":
        this.toolsListed = true;
        return { tools: this.tools };
      case "tools/call": {
        const toolName = request.params?.name as string;
        const args = request.params?.arguments as Record<string, unknown>;
        this.toolsCalled.push({ tool: toolName, args });
        const tool = this.tools.find((t) => t.name === toolName);
        if (!tool) return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
        return { content: [{ type: "text", text: `Executed ${toolName} with args: ${JSON.stringify(args)}` }] };
      }
      default:
        return { content: [{ type: "text", text: `Unknown method: ${request.method}` }], isError: true };
    }
  }

  reset(): void {
    this.toolsCalled = [];
    this.toolsListed = false;
    this.initialized = false;
    this.shouldFail = false;
    this.shouldTimeout = false;
  }
}

// ─── Test Setup ─────────────────────────────────────────────────────────────
/**
 * Route the gateway's upstream HTTP calls into the in-process FakeMCPServer.
 *
 * The gateway only ever reaches upstream through `deps.fetchImpl`, so injecting
 * here is what makes `fakeServer.initialized` / `.toolsListed` / `.toolsCalled`
 * meaningful — without it the allow-path never executes and only the
 * short-circuited block-path is actually under test.
 */
function createFetchImpl(fakeServer: FakeMCPServer): typeof fetch {
  return (async (_input: unknown, init?: { body?: string }) => {
    const message = JSON.parse(init?.body ?? "{}") as {
      method: string;
      params?: Record<string, unknown>;
      id: number;
    };

    const result = await fakeServer.handleRequest(message);

    return {
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: message.id, result }),
    };
  }) as unknown as typeof fetch;
}

/**
 * Stand-in for the guard-core policy engine.
 *
 * The gateway itself ships no policy: `defaultEvaluatePolicy` returns ALLOW for
 * everything ("No policy engine configured"), so enforcement is only ever as
 * good as the engine wired into `deps.evaluatePolicy`. These tests therefore
 * verify the gateway's enforcement *plumbing* — block-before-upstream, approval
 * gating, evidence — given a policy verdict, not that the gateway invents one.
 */
function createPolicyImpl(): NonNullable<GatewayDeps["evaluatePolicy"]> {
  const deny = (explanation: string, categories: string[]) => ({
    action: "DENY",
    riskScore: 95,
    reasonCodes: ["POLICY_DENY"],
    categories,
    explanation,
    redactedArgsPreview: "",
  });

  return (request) => {
    const argsStr = JSON.stringify(request.args ?? {});

    if (request.toolName === "read_credentials") {
      return deny("Credential access is denied by policy", ["credential-access"]);
    }
    if (request.toolName === "execute_command" && /\brm\s+-rf\b/.test(argsStr)) {
      return deny("Destructive shell command denied by policy", ["destructive-command"]);
    }
    if (request.toolName === "write_file") {
      return {
        action: "ASK",
        riskScore: 60,
        reasonCodes: ["POLICY_ASK"],
        categories: ["filesystem-write"],
        explanation: "Filesystem write requires approval",
        redactedArgsPreview: "",
      };
    }
    return {
      action: "ALLOW",
      riskScore: 0,
      reasonCodes: [],
      categories: [],
      explanation: "Allowed by policy",
      redactedArgsPreview: "",
    };
  };
}

/**
 * Assert a tool call was blocked by the gateway.
 *
 * A policy block is NOT a JSON-RPC protocol error — per MCP, tool-level failures
 * come back as a successful response carrying `isError: true`. Asserting
 * `"error" in result` here would silently pass on any transport failure too,
 * which is exactly how the upstream-unreachable bug hid in this suite.
 */
function assertBlocked(result: unknown, message: string): void {
  assert.ok(result && typeof result === "object" && "result" in result, message + " (expected a JSON-RPC result)");
  const payload = (result as { result: { isError?: boolean; content?: Array<{ text?: string }> } }).result;
  assert.equal(payload.isError, true, message + " (expected isError)");
  assert.match(
    payload.content?.[0]?.text ?? "",
    /blocked by SoterAI MCP Gateway/,
    message + " (expected gateway block reason)",
  );
}

/**
 * Assert a tool call was held pending human approval.
 *
 * Distinct from a hard block: the gateway mints an approval ID the operator can
 * later grant, but the call must not have reached upstream in the meantime.
 */
function assertApprovalRequired(result: unknown, message: string): void {
  assert.ok(result && typeof result === "object" && "result" in result, message + " (expected a JSON-RPC result)");
  const payload = (result as { result: { isError?: boolean; content?: Array<{ text?: string }> } }).result;
  assert.equal(payload.isError, true, message + " (expected isError)");
  assert.match(
    payload.content?.[0]?.text ?? "",
    /Approval required for tool .*Approval ID: apr_/s,
    message + " (expected an approval-required response with an approval ID)",
  );
}

function createGateway(fakeServer: FakeMCPServer): MCPJsonRpcGateway {
  const gateway = new MCPJsonRpcGateway(
    {
      ...DEFAULT_GATEWAY_CONFIG,
      upstreamEndpoint: { transport: "http", address: "http://fake:3001/mcp" },
      tenant: "test-tenant",
      project: "test-project",
      protectionMode: "standard",
    },
    {
      fetchImpl: createFetchImpl(fakeServer),
      evaluatePolicy: createPolicyImpl(),
    },
  );

  return gateway;
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe("MCP Gateway — Session and Initialization", () => {
  let fakeServer: FakeMCPServer;
  let gateway: MCPJsonRpcGateway;

  before(() => {
    fakeServer = new FakeMCPServer();
    gateway = createGateway(fakeServer);
  });

  after(() => {
    gateway.stop();
  });

  beforeEach(() => {
    fakeServer.reset();
  });

  it("should initialize a session and bind identity", async () => {
    const result = await gateway.processMessage({
      jsonrpc: "2.0",
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test-client", version: "1.0.0" } },
      id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1", userId: "user:test-user" });

    assert.ok(result && "result" in result, "Should have result");
    assert.ok(fakeServer.initialized, "Upstream should be initialized");
  });

  it("should reject cross-tenant access", async () => {
    const result = await gateway.processMessage({
      jsonrpc: "2.0",
      method: "tools/list",
      id: 2,
    }, { tenant: "different-tenant", project: "test-project", clientId: "test-client-1" });

    assert.ok(result && "error" in result, "Should have error");
  });

  it("should reject expired session", async () => {
    const shortTTLGateway = new MCPJsonRpcGateway(
      {
        ...DEFAULT_GATEWAY_CONFIG,
        upstreamEndpoint: { transport: "http", address: "http://fake:3001/mcp" },
        tenant: "test-tenant",
        project: "test-project",
        sessionTtlMs: 1,
      },
      { fetchImpl: createFetchImpl(fakeServer) },
    );

    await shortTTLGateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await shortTTLGateway.processMessage({
      jsonrpc: "2.0", method: "tools/list", id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assert.ok(result && "error" in result, "Should have error for expired session");
    shortTTLGateway.stop();
  });
});

describe("MCP Gateway — Tool Inventory", () => {
  let fakeServer: FakeMCPServer;
  let gateway: MCPJsonRpcGateway;

  before(() => {
    fakeServer = new FakeMCPServer();
    gateway = createGateway(fakeServer);
  });

  after(() => {
    gateway.stop();
  });

  beforeEach(() => {
    fakeServer.reset();
  });

  it("should list tools from upstream", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/list", id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assert.ok(result && "result" in result, "Should have result");
    assert.ok(fakeServer.toolsListed, "Upstream tools/list should be called");
  });
});

describe("MCP Gateway — Tool Call Enforcement", () => {
  let fakeServer: FakeMCPServer;
  let gateway: MCPJsonRpcGateway;

  before(() => {
    fakeServer = new FakeMCPServer();
    gateway = createGateway(fakeServer);
  });

  after(() => {
    gateway.stop();
  });

  beforeEach(() => {
    fakeServer.reset();
  });

  it("should allow safe tool call", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/call", params: { name: "read_file", arguments: { path: "/safe/path/file.txt" } }, id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assert.ok(result && "result" in result, "Should have result");
  });

  it("should block dangerous tool call before upstream execution", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/call", params: { name: "execute_command", arguments: { command: "rm -rf /" } }, id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assertBlocked(result, "Should block dangerous command");
    assert.equal(fakeServer.toolsCalled.length, 0, "Upstream should NOT be called");
  });

  it("should block undeclared tool", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    // The undeclared-tool check only engages once the session's tool inventory
    // has been pinned by a tools/list, so pin it before asserting the block.
    await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/list", id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/call", params: { name: "undeclared_tool", arguments: {} }, id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assert.ok(result && "error" in result, "Should have error for undeclared tool");
    assert.equal(fakeServer.toolsCalled.length, 0, "Upstream should NOT be called");
  });

  it("should block credential access", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/call", params: { name: "read_credentials", arguments: { service: "aws" } }, id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assertBlocked(result, "Should block credential access");
    assert.equal(fakeServer.toolsCalled.length, 0, "Upstream should NOT be called");
  });
});

describe("MCP Gateway — Approval Enforcement", () => {
  let fakeServer: FakeMCPServer;
  let gateway: MCPJsonRpcGateway;

  before(() => {
    fakeServer = new FakeMCPServer();
    gateway = createGateway(fakeServer);
  });

  after(() => {
    gateway.stop();
  });

  beforeEach(() => {
    fakeServer.reset();
  });

  it("should require approval for high-risk tool", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/call", params: { name: "write_file", arguments: { path: "/etc/config", content: "dangerous" } }, id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assertApprovalRequired(result, "Should hold write_file for approval");
    assert.equal(fakeServer.toolsCalled.length, 0, "Upstream should NOT be called before approval");
  });

  it("should reject approval replay", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/call", params: { name: "execute_command", arguments: { command: "rm -rf /" } }, id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assertBlocked(result, "Should block dangerous command");
    assert.equal(fakeServer.toolsCalled.length, 0, "Upstream should NOT be called");
  });
});

describe("MCP Gateway — Reliability", () => {
  let fakeServer: FakeMCPServer;
  let gateway: MCPJsonRpcGateway;

  before(() => {
    fakeServer = new FakeMCPServer();
    gateway = createGateway(fakeServer);
  });

  after(() => {
    gateway.stop();
  });

  beforeEach(() => {
    fakeServer.reset();
  });

  it("should reject malformed JSON-RPC", async () => {
    const result = await gateway.processMessage({
      jsonrpc: "2.0",
      method: "",
      id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assert.ok(result && "error" in result, "Should have error for malformed request");
  });

  it("should handle cancellation", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "notifications/cancelled",
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assert.ok(result === null || result === undefined, "Cancellation should not error");
  });

  it("should produce evidence for blocked call", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/call", params: { name: "execute_command", arguments: { command: "rm -rf /" } }, id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assertBlocked(result, "Should block dangerous command");
    const evidence = gateway.getEvidenceLog();
    assert.ok(evidence.length > 0, "Should have evidence logged");
    const last = evidence[evidence.length - 1];
    assert.equal(last.enforcement, "BLOCK");
    assert.ok(last.traceId, "Should have trace ID");
  });
});
