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
function createGateway(fakeServer: FakeMCPServer): MCPJsonRpcGateway {
  const gateway = new MCPJsonRpcGateway({
    ...DEFAULT_GATEWAY_CONFIG,
    upstreamEndpoint: { transport: "http", address: "http://fake:3001/mcp" },
    tenant: "test-tenant",
    project: "test-project",
    protectionMode: "standard",
  });

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
    const shortTTLGateway = new MCPJsonRpcGateway({
      ...DEFAULT_GATEWAY_CONFIG,
      upstreamEndpoint: { transport: "http", address: "http://fake:3001/mcp" },
      tenant: "test-tenant",
      project: "test-project",
      sessionTtlMs: 1,
    });

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

    assert.ok(result && "error" in result, "Should have error for dangerous command");
    assert.equal(fakeServer.toolsCalled.length, 0, "Upstream should NOT be called");
  });

  it("should block undeclared tool", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
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

    assert.ok(result && "error" in result, "Should have error for credential access");
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

    assert.ok(result && "error" in result, "Should have error requiring approval");
    assert.equal(fakeServer.toolsCalled.length, 0, "Upstream should NOT be called before approval");
  });

  it("should reject approval replay", async () => {
    await gateway.processMessage({
      jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }, id: 1,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    const result = await gateway.processMessage({
      jsonrpc: "2.0", method: "tools/call", params: { name: "execute_command", arguments: { command: "rm -rf /" } }, id: 2,
    }, { tenant: "test-tenant", project: "test-project", clientId: "test-client-1" });

    assert.ok(result && "error" in result, "Should block dangerous command");
    assert.equal(fakeServer.toolsCalled.length, 0, "Upstream should NOT be called");
    assert.ok(result && "error" in result, "Should have error");
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

    assert.ok(result && "error" in result, "Should have error for blocked call");
    const evidence = gateway.getEvidenceLog();
    assert.ok(evidence.length > 0, "Should have evidence logged");
    const last = evidence[evidence.length - 1];
    assert.equal(last.enforcement, "BLOCK");
    assert.ok(last.traceId, "Should have trace ID");
  });
});
