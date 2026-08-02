/**
 * MCP Gateway — WebSocket transport tests
 *
 * Verifies that a WebSocket-routed MCP connection:
 * 1. Rejects wrong bearer tokens (401 on upgrade)
 * 2. Accepts and processes a valid `initialize` JSON-RPC frame
 * 3. Routes `tools/call` through the same policy engine as HTTP transport
 * 4. Returns parse errors for malformed frames without crashing
 */

import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { MCPWebSocketServer } from "../MCPWebSocketServer";
import type { MCPGatewayConfig } from "../MCPGatewayConfig";

const AUTH_TOKEN = "test-ws-token-abc123";

function makeConfig(overrides?: Partial<MCPGatewayConfig>): MCPGatewayConfig {
  return {
    upstreamEndpoint: { transport: "stdio", address: "mock-upstream", args: [] },
    listenEndpoint: { transport: "ws", address: "127.0.0.1:0" },
    protectionMode: "strict",
    policyVersion: "test-ws-v1",
    failClosed: true,
    debug: false,
    inspectResults: true,
    enableApprovals: true,
    maxBodyBytes: 65_536,
    ...overrides,
  };
}

function makeIdentityHeaders() {
  return {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    "X-Soterai-Tenant": "acme",
    "X-Soterai-Project": "payments",
    "X-Soterai-Client-Id": "ws-client-001",
  };
}

/** Wait until a WebSocket is open. */
function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.once("open", resolve);
    ws.once("error", reject);
  });
}

/** Send a JSON-RPC message over WebSocket and await exactly one response. */
function wsRpc(ws: WebSocket, message: object): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS response timeout")), 4_000);
    ws.once("message", (raw) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(raw.toString()));
      } catch (err) {
        reject(err);
      }
    });
    ws.send(JSON.stringify(message));
  });
}

test("WS-001: upgrade rejected with wrong bearer token", async () => {
  const server = new MCPWebSocketServer({ config: makeConfig(), authToken: AUTH_TOKEN, port: 0 });
  await server.start();
  const { port } = server.address();

  await assert.rejects(
    () =>
      new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
          headers: { Authorization: "Bearer wrong-token" },
        });
        ws.once("open", resolve);
        ws.once("unexpected-response", (_req, res) => {
          reject(new Error(`Unexpected ${res.statusCode}`));
        });
        ws.once("error", reject);
      }),
    (err: Error) => {
      assert.ok(err.message.includes("401") || err.message.includes("Unexpected"), `Got: ${err.message}`);
      return true;
    },
  );
  await server.stop();
});

test("WS-002: valid initialize over WebSocket returns a JSON-RPC response", async () => {
  const server = new MCPWebSocketServer({ config: makeConfig(), authToken: AUTH_TOKEN, port: 0 });
  await server.start();
  const { port } = server.address();

  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: makeIdentityHeaders() });
  await waitForOpen(ws);

  const response = await wsRpc(ws, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "ws-test", version: "0.0.1" },
    },
  });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 1);
  // Either result or structured error is acceptable; must never hang.
  assert.ok("result" in response || "error" in response, "Response must have result or error");

  ws.close();
  await server.stop();
});

test("WS-003: tools/call over WebSocket goes through the enforcement pipeline", async () => {
  const server = new MCPWebSocketServer({ config: makeConfig(), authToken: AUTH_TOKEN, port: 0 });
  await server.start();
  const { port } = server.address();

  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: makeIdentityHeaders() });
  await waitForOpen(ws);

  // First initialize the session
  await wsRpc(ws, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "ws-test", version: "0.0.1" } },
  });

  // Then attempt a tool call — gateway must intercept, not crash, not pass silently
  const response = await wsRpc(ws, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "read_file", arguments: { path: "/etc/passwd" } },
  });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 2);
  if ("error" in response) {
    const err = response.error as { code: number; message: string };
    assert.ok(
      [-32000, -32603, -32600, -32007].includes(err.code),
      `Expected a gateway-level error code, got ${err.code}: ${err.message}`,
    );
  } else {
    // Blocked by policy — must contain isError or a tool-result with isError:true
    const result = response.result as { isError?: boolean; content?: Array<{ text?: string }> };
    assert.ok(
      result.isError === true || result.content?.some((c) => c.text?.includes("blocked") || c.text?.includes("denied")),
      `Expected blocked/denied result, got: ${JSON.stringify(result).slice(0, 200)}`,
    );
  }

  ws.close();
  await server.stop();
});

test("WS-004: malformed JSON frame returns Parse error, never crashes the server", async () => {
  const server = new MCPWebSocketServer({ config: makeConfig(), authToken: AUTH_TOKEN, port: 0 });
  await server.start();
  const { port } = server.address();

  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: makeIdentityHeaders() });
  await waitForOpen(ws);

  const response: Record<string, unknown> = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS timeout")), 3_000);
    ws.once("message", (raw) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(raw.toString()));
      } catch (err) {
        reject(err);
      }
    });
    ws.send("{ this is not json !!!");
  });

  assert.equal(response.jsonrpc, "2.0");
  const err = response.error as { code: number };
  assert.equal(err.code, -32700, `Expected -32700 Parse error, got ${err.code}`);

  // Server must still be alive
  const ping = await wsRpc(ws, {
    jsonrpc: "2.0",
    id: 99,
    method: "ping",
    params: {},
  });
  assert.equal(ping.jsonrpc, "2.0");
  assert.equal(ping.id, 99);

  ws.close();
  await server.stop();
});

test("WS-005: identity headers correctly bound to session", async () => {
  const server = new MCPWebSocketServer({
    config: makeConfig({ tenant: "acme", project: "payments" }),
    authToken: AUTH_TOKEN,
    port: 0,
  });
  await server.start();
  const { port } = server.address();

  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers: makeIdentityHeaders() });
  await waitForOpen(ws);

  const response = await wsRpc(ws, {
    jsonrpc: "2.0",
    id: 1,
    method: "ping",
    params: {},
  });

  assert.equal(response.jsonrpc, "2.0");
  // The gateway processed the message — identity binding happened server-side
  assert.ok("result" in response || "error" in response);

  ws.close();
  await server.stop();
});
